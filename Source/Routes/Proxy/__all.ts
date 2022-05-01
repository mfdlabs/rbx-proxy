/*
   Copyright 2022 Nikita Petko <petko@vmminfra.net>

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

/*
    File Name: __all.ts
    Description: This route will proxy all requests to the server. The __all part will treat this as a middleware instead of a direct route.
    Written by: Nikita Petko
*/

import { Logger } from 'Library/Util/Logger';
import { WebUtility } from 'Library/Util/WebUtility';
import { LBInfoHandler } from 'Library/Handlers/LBInfoHandler';
import { GlobalEnvironment } from 'Library/Util/GlobalEnvironment';
import Route from 'Library/Setup/Interfaces/Route';
import { RoutingMethod } from 'Library/Setup/Types/RoutingMethod';
import { GoogleAnalyticsHelper } from 'Library/Util/GoogleAnalyticsHelper';

import net from '@mfdlabs/net';
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

class RoutingMiddleware implements Route {
    public requestMethod = 'ALL' as RoutingMethod;

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

    // private static StringToArrayBuffer(string: string): ArrayBuffer {
    //     const buffer = new ArrayBuffer(string.length);
    //     const view = new Uint8Array(buffer);
    //     for (let i = 0; i < string.length; i++) {
    //         view[i] = string.charCodeAt(i);
    //     }
    //     return buffer;
    // }

    // private static TransformResponseUrls(response: ArrayBuffer, responseUrl: string): ArrayBuffer {
    //     // Basically convert response to a string, and then replace all the urls with the responseUrl
    //     // and then convert it back to an arraybuffer
    //     const responseString = String.fromCharCode.apply(null, new Uint16Array(response));

    //     const responseStringWithUrls = responseString.replace(/https?:\/\/[^\s]+/g, responseUrl);

    //     return RoutingMiddleware.StringToArrayBuffer(responseStringWithUrls);
    // }

    private static ApplyCorsHeaders(origin: string, response: Response) {
        response.setHeader('Access-Control-Allow-Origin', origin);
        response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token');
        response.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    private static PublicIP: string;

    public async invoke(request: Request, response: Response, next: NextFunction) {
        const gaCategory = `Proxy_${WebUtility.GenerateUUIDV4()}`;

        let baseGaString = '';
        const headersAsString = Object.keys(request.headers)
            .map((key) => `${key}: ${request.headers[key]}`)
            .join('\n');
        const httpVersion = request.httpVersion;

        if (!GlobalEnvironment.GA4DisableLoggingIPs)
            baseGaString = `Client ${request.ip}\n${request.method} ${request.originalUrl} ${httpVersion}\n${headersAsString}\n`;
        else baseGaString = `Client [redacted]\n${request.method} ${request.originalUrl} ${httpVersion}\n${headersAsString}\n`;

        if (!GlobalEnvironment.GA4DisableLoggingBody) {
            const body = request.body.toString();

            if (body !== '[object Object]') {
                let truncatedBody = body.substring(0, 500);

                // if the length is less than the actual body length, add an ellipsis
                if (truncatedBody.length < body.length) truncatedBody += '...';

                baseGaString += `\n${truncatedBody}\n`;
            }
        }

        GoogleAnalyticsHelper.FireServerEventGA4(gaCategory, 'Request', baseGaString);

        if (RoutingMiddleware.PublicIP === undefined) {
            RoutingMiddleware.PublicIP = await net.getPublicIP();

            Logger.Info("Public IP Initialized as '%s'", RoutingMiddleware.PublicIP);

            if (!GlobalEnvironment.GA4DisableLoggingIPs)
                /* This may be cause controversy */
                GoogleAnalyticsHelper.FireServerEventGA4(gaCategory, 'PublicIPInitalized', RoutingMiddleware.PublicIP);
        }

        const startTime = Date.now();

        const origin = request.headers.origin ?? request.headers.referer;
        const transformedOrigin = `${request.secure ? 'https' : 'http'}://${RoutingMiddleware.TransformRequestHost(origin)}`;

        if (origin) {
            Logger.Info('Origin is present, setting CORS headers');
            GoogleAnalyticsHelper.FireServerEventGA4(
                gaCategory,
                'ApplyCorsHeaders',
                `Original Origin: ${origin}\nTransformed Origin: ${transformedOrigin}`,
            );

            RoutingMiddleware.ApplyCorsHeaders(origin, response);
        }

        if (request.method === 'OPTIONS') {
            Logger.Info('Request is an OPTIONS request, responding with empty body');
            GoogleAnalyticsHelper.FireServerEventGA4(gaCategory, 'OptionsRequest', 'Empty Response');

            response.send();

            return;
        }

        // If the url is /, /health or /checkhealth then show the health check page
        if (request.url === '/_lb/_/health' || request.url === '/_lb/_/checkhealth') {
            Logger.Info('Request is a health check request, responding with health check page');
            GoogleAnalyticsHelper.FireServerEventGA4(gaCategory, 'HealthCheckRequest', baseGaString);

            LBInfoHandler.Invoke(response, true, true, true);
            return;
        }

        // Proxy will transform all test site urls to the production site url (it will try find subdomain and will inject the url directly)
        // It will forward all headers to the server and forward the raw request body using axios
        // It will forward all response headers and response body to the client
        // It will forward all errors to the client

        const hostname: string = (request.headers['x-forwarded-host'] as string) ?? (request.headers.host as string);

        if (hostname === undefined || hostname === null || hostname === '') {
            Logger.Warn('Hostname is undefined or null, responding with invalid hostname error');
            GoogleAnalyticsHelper.FireServerEventGA4(gaCategory, 'InvalidHostname', baseGaString);

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

        const resolvedHost = await net.resolveHostname(host);

        if (resolvedHost === undefined || resolvedHost === null) {
            Logger.Warn("Resolved host for '%s' is undefined or null, responding with invalid hostname error", host);
            GoogleAnalyticsHelper.FireServerEventGA4(gaCategory, 'NXDomain', baseGaString);

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

        Logger.Debug("Host '%s' resolved to '%s'", host, resolvedHost);

        if (
            GlobalEnvironment.HateLANAccess &&
            (net.isIPv4RFC1918(resolvedHost) ||
                net.isIPv6RFC4193(resolvedHost) ||
                net.isIPv6RFC3879(resolvedHost) ||
                net.isIPv4RFC1918(host) ||
                net.isIPv6RFC4193(host) ||
                net.isIPv6RFC3879(host))
        ) {
            Logger.Warn("Request to '%s' or '%s' is from a LAN, responding with LAN access error", host, resolvedHost);
            GoogleAnalyticsHelper.FireServerEventGA4(gaCategory, 'LANAccess', baseGaString);

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
            net.isIPv4Loopback(host) ||
            net.isIPv6Loopback(host) ||
            net.isIPv4Loopback(resolvedHost) ||
            net.isIPv6Loopback(resolvedHost) ||
            resolvedHost === net.getLocalIPv4() ||
            host === net.getLocalIPv4() ||
            resolvedHost === net.getLocalIPv6() ||
            host === net.getLocalIPv6() ||
            host === RoutingMiddleware.PublicIP ||
            resolvedHost === RoutingMiddleware.PublicIP
        ) {
            Logger.Warn("Request to '%s' or '%s' is a loopback, responding with loopback error", host, resolvedHost);
            GoogleAnalyticsHelper.FireServerEventGA4(gaCategory, 'LoopbackDetected', baseGaString);

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

        Logger.Debug("Proxy request '%s' from client '%s' on host '%s' to upstream uri '%s'", request.method, request.ip, hostname, uri);

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

                const timing = Date.now() - startTime;

                Logger.Debug(
                    "Proxy response %d (%s) from upstream uri '%s' at downstream host '%s' in %dms",
                    res.status,
                    res.statusText,
                    uri,
                    host,
                    timing,
                );
                GoogleAnalyticsHelper.FireServerEventGA4(
                    gaCategory,
                    'ProxyResponse',
                    `Proxy response ${res.status} (${res.statusText}) from upstream '${uri}' at downstream host '${host}' in ${timing}ms`,
                );

                if (origin !== undefined) res.headers['access-control-allow-origin'] = origin;

                res.headers['x-upstream-timing'] = `${timing}ms`;

                response.status(res.status).header(res.headers).send(res.data);
            })
            .catch((err) => {
                const timing = Date.now() - startTime;

                if (err.response !== undefined) {
                    Logger.Warn(
                        "Proxy error response %d (%s) from upstream uri '%s' at downstream host '%s' in %dms",
                        err.response.status,
                        err.response.statusText,
                        uri,
                        host,
                        timing,
                    );
                    GoogleAnalyticsHelper.FireServerEventGA4(
                        gaCategory,
                        'ProxyErrorResponse',
                        `Proxy error response ${err.response.status} (${err.response.statusText}) from upstream '${uri}' at downstream host '${host}' in ${timing}ms`,
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
                    Logger.Warn("Proxy timed out from upstream '%s' on downstream host '%s' after %dms.", uri, hostname, timing);
                    GoogleAnalyticsHelper.FireServerEventGA4(
                        gaCategory,
                        'ProxyTimeout',
                        `Proxy timeout from upstream '${uri}' on downstream host '${hostname}' after ${timing}ms`,
                    );

                    response.status(504);

                    response.header({
                        'x-upstream-timing': `${timing}ms`,
                    });

                    response.send(
                        `<html><body><h1>504 Gateway Timeout</h1><p>The upstream server '${uri}' timed out after ${timing}ms.</p></body></html>`,
                    );

                    return;
                }

                Logger.Error("Proxy error '%s' from upstream uri '%s' at downstream host '%s' in %dms", err.message, uri, hostname, timing);
                GoogleAnalyticsHelper.FireServerEventGA4(
                    gaCategory,
                    'ProxyErrorUnknown',
                    `Proxy error '${err.message}' from upstream '${uri}' at downstream host '${hostname}' in ${timing}ms`,
                );

                next(); // We didn't get a response so it'll just pass it onto upstream error handler
            });
    }
}

export = new RoutingMiddleware();
