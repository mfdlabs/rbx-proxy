import { LBInfoHandler } from 'Assemblies/Handlers/LBInfoHandler';
import { IRoutingController } from 'Assemblies/Setup/Interfaces/IRoutingController';
import { GlobalEnvironment } from 'Assemblies/Util/GlobalEnvironment';
import { Logger } from 'Assemblies/Util/LoggingUtility';
import { NetworkingUtility } from 'Assemblies/Util/NetworkingUtility';
import axios, { Method } from 'axios';
import { Request, Response, NextFunction } from 'express';

/*
There are 5 forms of loopback we can do here.
1. Loopback -> Loopback, this one signifies that the local client is connecting to the local server.
2. LAN -> LAN, this one signifies that the local client is connecting to itself through an rfc1918 address.
3. Gateway -> LAN, this one signifies that an NATed client is connecting to it's own NATed address.
4. Public -> Public, this one only applies for forwarded hosts, and is used to signify that a remote client is forwarding a host that matches the public NATed address of the local client.
5. Link-Local -> LAN, while this one isn't technically a loopback and is very rare, it is used to signify that a client is somehow connecting to itself through a link-local address.
*/

class RoutingMiddleware implements IRoutingController {
    public RequestMethod: string = 'ALL';

    private static TransformRequestHost(host: string): string {
        if (host === undefined || host === null) return null;

        // Remove the http(s)://
        host = host.replace(/^https?:\/\//, '');

        const testSiteRegex = /(([a-z0-9]+)\.)?((site|game)test[1-5])\.(roblox(labs)?|simul(ping|pong|prod))\.(com|local)/gi;
        const testSiteMatch = testSiteRegex.exec(host);

        // Capture group 2 is the subdomain
        if (testSiteMatch && testSiteMatch[2]) {
            return host.replace(testSiteRegex, `${testSiteMatch[2]}.roblox.com`);
        }

        return host;
    }

    private static ApplyCorsHeaders(origin: string, response: Response) {
        response.setHeader('Access-Control-Allow-Origin', origin);
        response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token');
        response.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    private static PublicIP: string;

    public async Callback(request: Request, response: Response, next: NextFunction) {
        if (RoutingMiddleware.PublicIP === undefined) {
            RoutingMiddleware.PublicIP = await NetworkingUtility.GetPublicIP();
        }

        const startTime = Date.now();

        const origin = request.headers.origin ?? request.headers.referer;
        const transformedOrigin = `${request.secure ? 'https' : 'http'}://${RoutingMiddleware.TransformRequestHost(origin)}`;

        if (origin) {
            RoutingMiddleware.ApplyCorsHeaders(origin, response);
        }

        if (request.method === 'OPTIONS') {
            response.send();

            return;
        }

        // If the url is /, /health or /checkhealth then show the health check page
        if (request.url === '/_lb/_/health' || request.url === '/_lb/_/checkhealth') {
            LBInfoHandler.Invoke(response, true, true, true);
            return;
        }

        // Proxy will transform all test site urls to the production site url (it will try find subdomain and will inject the url directly)
        // It will forward all headers to the server and forward the raw request body using axios
        // It will forward all response headers and response body to the client
        // It will forward all errors to the client

        const hostname: string = (request.headers['x-forwarded-host'] as string) ?? (request.headers.host as string);

        if (hostname === undefined || hostname === null || hostname === '') {
            response
                .status(400)
                .header({
                    'Content-Type': 'text/html',
                    Pragma: 'no-cache',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    Expires: '0',
                    Connection: 'close',
                })
                .send(
                    `<html><body><h1>400 Bad Request</h1><p>Cannot satisfy request because the host header is missing.</p></body></html>`,
                );
            return;
        }

        const host = RoutingMiddleware.TransformRequestHost(hostname);

        // We have to be careful here to not allow loopback requests or requests to the proxy itself as they will cause an infinite loop

        const resolvedHost = await NetworkingUtility.ResolveHostname(host);

        if (resolvedHost === undefined || resolvedHost === null) {
            response
                .status(503)
                .header({
                    'Content-Type': 'text/html',
                    Pragma: 'no-cache',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    Expires: '0',
                    Connection: 'close',
                })
                .send(
                    `<html><body><h1>503 Service Unavailable</h1><p>Cannot satisfy request because the hostname ${host} could not be resolved.</p></body></html>`,
                );
            return;
        }

        Logger.Debug(`Host '${host}' resolved to '${resolvedHost}'`);

        if (
            GlobalEnvironment.HateLANAccess &&
            (NetworkingUtility.IsIPv4Rfc1918(resolvedHost) ||
                NetworkingUtility.IsIPv6Rfc4193(resolvedHost) ||
                NetworkingUtility.IsIPv6Rfc3879(resolvedHost) ||
                NetworkingUtility.IsIPv4Rfc1918(host) ||
                NetworkingUtility.IsIPv6Rfc4193(host) ||
                NetworkingUtility.IsIPv6Rfc3879(host))
        ) {
            response
                .status(403)
                .header({
                    'Content-Type': 'text/html',
                    Pragma: 'no-cache',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    Expires: '0',
                    Connection: 'close',
                })
                .send(
                    `<html><body><h1>403 Forbidden</h1><p>Access to the address that ${host} resolved to is forbidden.</p></body></html>`,
                );

            return;
        }

        if (
            host === 'localhost' ||
            NetworkingUtility.IsIPv4Loopback(host) ||
            NetworkingUtility.IsIPv6Loopback(host) ||
            host === NetworkingUtility.GetLocalIP() ||
            NetworkingUtility.IsIPv4Loopback(resolvedHost) ||
            NetworkingUtility.IsIPv6Loopback(resolvedHost) ||
            resolvedHost === NetworkingUtility.GetLocalIP() ||
            host === RoutingMiddleware.PublicIP ||
            resolvedHost === RoutingMiddleware.PublicIP
        ) {
            Logger.Warn(`Rejecting request to ${host}`);

            // LB level error
            response
                .status(403)
                .header({
                    'Content-Type': 'text/html',
                    Pragma: 'no-cache',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    Expires: '0',
                    Connection: 'close',
                })
                .send(
                    `<html><body><h1>403 Forbidden</h1><p>Loopback detected from downstream client '${request.ip}' to upstream server '${resolvedHost}'.</p></body></html>`,
                );
            return;
        }

        const url = request.url;

        const forwardedPort = request.headers['x-forwarded-port'] as string;

        const port = forwardedPort ? parseInt(forwardedPort, 10) : request.socket.localPort;

        const uri = `${request.secure ? 'https' : 'http'}://${host}:${port}${url}`;

        Logger.Debug(`Proxy request '${request.method}' from client '${request.ip}' on host '${hostname}' to upstream uri '${uri}'`);

        axios
            .request({
                url: uri,
                method: request.method as Method,
                headers: <any>{
                    'X-Forwarded-For': request.ip,
                    'X-Forwarded-Host': hostname,
                    'X-Forwarded-Proto': request.protocol,
                    ...request.headers,
                    // Rewrite the host header to the target host
                    host: host,
                    // We also have to rewrite the origin and referer headers to the target host
                    origin: transformedOrigin,
                    referer: transformedOrigin,
                },
                data: request.body,
                // We want the raw response body as buffer
                responseType: 'arraybuffer',
            })
            .then((res) => {
                // We need to do some magic and transform CORs headers to the client
                // Do this by finding Access-Control-Allow-Origin and transform it to the original referrer or origin we had (if set)
                // Else if the origin or referer header is set, then we can use that

                Logger.Debug(
                    `Proxy response ${res.status} ('${res.statusText}') from upstream uri '${uri}' at downstream host '${hostname}'`,
                );

                if (origin !== undefined) res.headers['access-control-allow-origin'] = origin;

                const timing = Date.now() - startTime;

                res.headers['x-upstream-timing'] = `${timing}ms`;

                response.status(res.status).header(res.headers).send(res.data);
            })
            .catch((err) => {
                const timing = Date.now() - startTime;

                if (err.response !== undefined) {
                    Logger.Warn(
                        `Proxy error response ${err.response.status} ('${err.response.statusText}') from upstream '${uri}' on downstream host '${hostname}'.`,
                    );

                    if (origin !== undefined) err.response.headers['access-control-allow-origin'] = origin;

                    err.response.headers['x-upstream-timing'] = `${timing}ms`;

                    response.status(err.response.status);
                    response.header(err.response.headers);
                    response.send(err.response.data);
                    return;
                }

                // Check if error is a timeout
                if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
                    Logger.Warn(`Proxy timed out from upstream '${uri}' on downstream host '${hostname}' after ${timing}ms.`);

                    response.status(504);

                    response.header({
                        'x-upstream-timing': `${timing}ms`,
                    });

                    response.send(
                        `<html><body><h1>504 Gateway Timeout</h1><p>The upstream server '${uri}' timed out after ${timing}ms.</p></body></html>`,
                    );

                    return;
                }

                Logger.Error(`Proxy error '${err.message}' from upstream url '${uri}' on downstream host '${hostname}'.`);

                next(); // We didn't get a response so it'll just pass it onto upstream error handler
            });
    }
}

export = new RoutingMiddleware();
