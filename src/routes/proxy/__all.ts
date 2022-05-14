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
    TODO: [RBXPRR-27] Support WebSockets.
*/

import logger from '@lib/utility/logger';
import corsWriter from '@lib/proxy/corsWriter';
import webUtility from '@lib/utility/webUtility';
import environment from '@lib/utility/environment';
import googleAnalytics from '@lib/utility/googleAnalytics';
import sphynxServiceRewriteReader from '@lib/proxy/sphynxServiceRewriteReader';
import loadBalancerInfoResponder from '@lib/responders/loadBalancerInfoResponder';

////////////////////////////////////////////////////////////////////////////////////////////////////
// Type imports.
////////////////////////////////////////////////////////////////////////////////////////////////////

import Route from '@lib/setup/contracts/route';
import { RoutingMethod } from '@lib/setup/customTypes/routingMethod';

////////////////////////////////////////////////////////////////////////////////////////////////////
// Third-party imports.
////////////////////////////////////////////////////////////////////////////////////////////////////

import * as tls from 'tls';
import * as net from 'net';
import htmlEncode from 'escape-html';
import netHelper from '@mfdlabs/net';
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
class AllCatchRoute implements Route {
  public requestMethod = 'ALL' as RoutingMethod;

  private static _getLocalPort(request: Request): number {
    return AllCatchRoute._getSocket(request).localPort;
  }

  private static _getSocket(request: Request): net.Socket | tls.TLSSocket {
    // spdy does some weird stuff with the raw socket, as in it puts the actual TLSSocket in a nested property
    return ((request.socket as any)?._spdyState?.parent as tls.TLSSocket) ?? request.socket;
  }

  private static _transformRequestHost(host: string): string {
    if (host === undefined || host === null) return null;

    // Remove the http(s)://
    host = host.replace(/^https?:\/\//, '');

    const testSiteRegex =
      /(([a-z0-9]{0,255})\.)?((site|game)test[1-5])\.(roblox(labs)?|simul(ping|pong|prod))\.(com|local)/gi;
    const testSiteMatch = testSiteRegex.exec(host);

    // Capture group 2 is the subdomain
    if (testSiteMatch && testSiteMatch[2]) {
      return host.replace(testSiteRegex, `${testSiteMatch[2]}.roblox.com`);
    }

    return host;
  }

  private static _parseCookie(cookie: string): { [key: string]: string } {
    const cookieObject: { [key: string]: string } = {};

    if (cookie === undefined || cookie === null) return cookieObject;

    const cookieArray = cookie.split(';');

    for (const cookiePair of cookieArray) {
      const cookiePairArray = cookiePair.split('=');

      if (cookiePairArray.length === 2) {
        cookieObject[decodeURIComponent(cookiePairArray[0].trim())] = decodeURIComponent(cookiePairArray[1].trim());
      }
    }

    return cookieObject;
  }

  private static _transformSetCookieHeader(
    header: string | string[],
    testHost: string,
    host: string,
  ): string | string[] {
    if (header === undefined || header === null) return undefined;

    if (typeof header === 'string') {
      // Parse cookie string, then update it's domain key and reencode it
      const cookie = AllCatchRoute._parseCookie(header);
      if (cookie.domain.includes(testHost)) {
        if (cookie.domain.startsWith('.')) {
          cookie.domain = `.${host}`;
        } else {
          cookie.domain = host;
        }
      }
      return Object.keys(cookie)
        .map((key) => `${key}=${cookie[key]}`)
        .join('; ');
    }

    // If it's an array, update each cookie's domain key and reencode it
    return header.map((cookie) => AllCatchRoute._transformSetCookieHeader(cookie, testHost, host)) as string[];
  }

  private static _extractBaseHost(host: string): string {
    // Extracts just hostname.tld from subdomain.hostname.tld etc
    return host.split('.').slice(-2).join('.');
  }

  private static _arrayBufferToString(buffer: ArrayBuffer): string {
    return AllCatchRoute._textDecoder.decode(AllCatchRoute._cleanArrayBuffer(buffer));
  }

  private static _cleanArrayBuffer(buffer: ArrayBuffer): ArrayBuffer {
    // This gets rid of the random characters that are added to the beginning of the buffer
    if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
      // UTF-8 BOM
      return buffer.slice(3);
    }

    return buffer;
  }

  private static _isOriginAllowed(allowedOrigins: (string | RegExp)[], origin: string): boolean {
    for (const allowedOrigin of allowedOrigins as RegExp[]) {
      if (allowedOrigin.test(origin)) return true;
      if (allowedOrigin.toString() === '/^\\*$/') {
        // Replace the /^\*$/ regex with '*'
        allowedOrigins.splice(allowedOrigins.indexOf(allowedOrigin), 1, /^\*$/);
        allowedOrigins.push('*');
        return true;
      }
    }

    return false;
  }

  private static _applyCorsHeaders(origin: string, request: Request, response: Response): boolean {
    const corsRule = corsWriter.getRule(request);

    if (corsRule) {
      if (
        AllCatchRoute._isOriginAllowed(corsRule.allowedOrigins as RegExp[], origin) ||
        corsRule.allowRequestOriginIfNoAllowedOrigins ||
        environment.corsApplyHeadersRegardlessOfOrigin
      ) {
        if (corsRule.allowedOrigins.includes('*')) response.setHeader('Access-Control-Allow-Origin', '*');
        else {
          if (origin !== undefined) {
            response.setHeader('Access-Control-Allow-Origin', origin);
          }
        }

        if (corsRule.allowedHeaders.length > 0)
          response.setHeader('Access-Control-Allow-Headers', corsRule.allowedHeaders.join(', '));
        if (corsRule.allowedMethods.length > 0)
          response.setHeader('Access-Control-Allow-Methods', corsRule.allowedMethods.join(', '));
        if (corsRule.exposedHeaders.length > 0)
          response.setHeader('Access-Control-Expose-Headers', corsRule.exposedHeaders.join(', '));
        if (corsRule.maxAge !== undefined) response.setHeader('Access-Control-Max-Age', corsRule.maxAge.toString());
        if (corsRule.allowCredentials) response.setHeader('Access-Control-Allow-Credentials', 'true');

        response.setHeader('Vary', 'Origin');
      }

      return corsRule.allowResponseHeadersOverwrite;
    }

    return true;
  }

  private static _publicIp: string;
  private static _textDecoder: TextDecoder = new TextDecoder();

  public async invoke(request: Request, response: Response, next: NextFunction) {
    const gaCategory = `Proxy_${webUtility.generateUUIDV4()}`;

    let baseGaString = '';
    const headersAsString = Object.keys(request.headers)
      .map((key) => `${key}: ${request.headers[key]}`)
      .join('\n');
    const httpVersion = request.httpVersion;

    if (!environment.ga4DisableLoggingIPs)
      baseGaString = `Client ${request.ip}\n${request.method} ${request.originalUrl} ${httpVersion}\n${headersAsString}\n`;
    else
      baseGaString = `Client [redacted]\n${request.method} ${request.originalUrl} ${httpVersion}\n${headersAsString}\n`;

    if (!environment.ga4DisableLoggingBody) {
      const body = request.body.toString();

      if (body !== '[object Object]') {
        let truncatedBody = body.substring(0, 500);

        // if the length is less than the actual body length, add an ellipsis
        if (truncatedBody.length < body.length) truncatedBody += '...';

        baseGaString += `\n${truncatedBody}\n`;
      }
    }

    googleAnalytics.fireServerEventGA4(gaCategory, 'Request', baseGaString);

    if (AllCatchRoute._publicIp === undefined) {
      AllCatchRoute._publicIp = await netHelper.getPublicIP();

      logger.information("Public IP Initialized as '%s'", AllCatchRoute._publicIp);

      if (!environment.ga4DisableLoggingIPs)
        /* This may be cause controversy */
        googleAnalytics.fireServerEventGA4(gaCategory, 'PublicIPInitalized', AllCatchRoute._publicIp);
    }

    const startTime = Date.now();

    const origin = request.headers.origin;
    const transformedOrigin = `${request.secure ? 'https' : 'http'}://${AllCatchRoute._transformRequestHost(origin)}`;

    // If the url is /, /health or /checkhealth then show the health check page
    if (request.originalUrl === '/_lb/_/health' || request.originalUrl === '/_lb/_/checkhealth') {
      logger.information('Request is a health check request, responding with health check page');
      googleAnalytics.fireServerEventGA4(gaCategory, 'HealthCheckRequest', baseGaString);

      loadBalancerInfoResponder.invoke(response, true, true, true);
      return;
    }

    // Proxy will transform all test site urls to the production site url (it will try find subdomain and will inject the url directly)
    // It will forward all headers to the server and forward the raw request body using axios
    // It will forward all response headers and response body to the client
    // It will forward all errors to the client

    const hostname: string = request.headers.host as string;

    if (hostname === undefined || hostname === null || hostname === '') {
      logger.warning('Hostname is undefined or null, responding with invalid hostname error');
      googleAnalytics.fireServerEventGA4(gaCategory, 'InvalidHostname', baseGaString);

      response
        .status(400)
        .header({
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Connection: 'close',
          Expires: '0',
          Pragma: 'no-cache',
        })
        .send(
          `<html><body><h1>400 Bad Request</h1><p>Cannot satisfy request because the host header is missing.</p></body></html>`,
        );
      return;
    }

    const host = AllCatchRoute._transformRequestHost(hostname);

    // We have to be careful here to not allow loopback requests or requests to the proxy itself as they will cause an infinite loop

    const resolvedHost = await netHelper.resolveHostname(host);

    if (resolvedHost === undefined || resolvedHost === null) {
      logger.warning("Resolved host for '%s' is undefined or null, responding with invalid hostname error", host);
      googleAnalytics.fireServerEventGA4(gaCategory, 'NXDomain', baseGaString);

      response
        .status(503)
        .header({
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Connection: 'close',
          Expires: '0',
          Pragma: 'no-cache',
        })
        .send(
          `<html><body><h1>503 Service Unavailable</h1><p>Cannot satisfy request because the hostname ${htmlEncode(
            host,
          )} could not be resolved.</p></body></html>`,
        );
      return;
    }

    logger.debug("Host '%s' resolved to '%s'", host, resolvedHost);

    if (
      environment.hateLocalAreaNetworkAccess &&
      (netHelper.isIPv4RFC1918(resolvedHost) ||
        netHelper.isIPv6RFC4193(resolvedHost) ||
        netHelper.isIPv6RFC3879(resolvedHost) ||
        netHelper.isIPv4RFC1918(host) ||
        netHelper.isIPv6RFC4193(host) ||
        netHelper.isIPv6RFC3879(host))
    ) {
      logger.warning("Request to '%s' or '%s' is from a LAN, responding with LAN access error", host, resolvedHost);
      googleAnalytics.fireServerEventGA4(gaCategory, 'LANAccess', baseGaString);

      response
        .status(403)
        .header({
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Connection: 'close',
          Expires: '0',
          Pragma: 'no-cache',
        })
        .send(
          `<html><body><h1>403 Forbidden</h1><p>Access to the address that ${htmlEncode(
            host,
          )} resolved to is forbidden.</p></body></html>`,
        );

      return;
    }

    if (
      netHelper.isIPv4Loopback(host) ||
      netHelper.isIPv6Loopback(host) ||
      netHelper.isIPv4Loopback(resolvedHost) ||
      netHelper.isIPv6Loopback(resolvedHost) ||
      resolvedHost === netHelper.getLocalIPv4() ||
      host === netHelper.getLocalIPv4() ||
      resolvedHost === netHelper.getLocalIPv6() ||
      host === netHelper.getLocalIPv6() ||
      host === AllCatchRoute._publicIp ||
      resolvedHost === AllCatchRoute._publicIp
    ) {
      logger.warning("Request to '%s' or '%s' is a loopback, responding with loopback error", host, resolvedHost);
      googleAnalytics.fireServerEventGA4(gaCategory, 'LoopbackDetected', baseGaString);

      // LB level error
      response
        .status(403)
        .header({
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Connection: 'close',
          Expires: '0',
          Pragma: 'no-cache',
        })
        .send(
          `<html><body><h1>403 Forbidden</h1><p>Loopback detected from upstream client '${htmlEncode(
            request.ip,
          )}' to downstream server '${htmlEncode(resolvedHost)}'.</p></body></html>`,
        );
      return;
    }

    let allowCorsHeaderOverwrite = true;

    if (origin || environment.corsApplyHeadersRegardlessOfOriginHeader) {
      logger.information('Origin is present, setting CORS headers');
      googleAnalytics.fireServerEventGA4(
        gaCategory,
        'ApplyCorsHeaders',
        `Original Origin: ${origin}\nTransformed Origin: ${transformedOrigin}`,
      );

      allowCorsHeaderOverwrite = AllCatchRoute._applyCorsHeaders(origin, request, response);
    }

    if (host === environment.sphynxDomain) {
      logger.information('Request is for sphynx');
      googleAnalytics.fireServerEventGA4(gaCategory, 'SphynxRequest', baseGaString);

      // Check if there is a hardcoded redirect for the sphynx domain
      const hardcodedResponse = sphynxServiceRewriteReader.getHardcodedResponse(request.method, request.originalUrl);

      if (hardcodedResponse) {
        logger.information('Found hardcoded response for sphynx request, responding with it');
        googleAnalytics.fireServerEventGA4(gaCategory, 'HardcodedResponse', baseGaString);

        response.header('x-hardcoded-response-template', hardcodedResponse.template.toString());

        const body =
          hardcodedResponse.body instanceof Object ? JSON.stringify(hardcodedResponse.body) : hardcodedResponse.body;

        response.header('content-length', body.length);

        response.header(hardcodedResponse.headers);
        response.contentType(hardcodedResponse.contentType ?? 'text/html');
        response.status(hardcodedResponse.statusCode);
        response.getHeaderNames().forEach((headerName: string) => {
          const headerValue = response.getHeader(headerName);
          response.removeHeader(headerName);
          response.setHeader(headerName.toLowerCase(), headerValue);
        });
        response.end(body);

        return;
      }

      logger.information('No hardcoded response found for sphynx request, try and transform service path');
      googleAnalytics.fireServerEventGA4(gaCategory, 'NoHardcodedResponse', baseGaString);

      request.originalUrl = sphynxServiceRewriteReader.transformUrl(request.originalUrl);
    }

    const url = request.originalUrl;
    const port = AllCatchRoute._getLocalPort(request);
    const uri = `${request.secure ? 'https' : 'http'}://${host}:${port}${url}`;

    logger.debug(
      "Proxy request '%s' from client '%s' on upstream hostname '%s' to downstream URI '%s'",
      request.method,
      request.ip,
      hostname,
      uri,
    );

    axios
      .request({
        data: request.body,

        headers: {
          ...request.headers,

          'X-Forwarded-For': request.ip,
          'X-Forwarded-Host': hostname,
          'X-Forwarded-Proto': request.protocol,

          // Rewrite the host header to the target host
          host,
          // We also have to rewrite the origin and referer headers to the target host
          origin: transformedOrigin,
          referer: transformedOrigin,
        } as any,

        method: request.method as Method,

        // We want the raw response body as buffer
        responseType: 'arraybuffer',

        url: uri,

        // Override validateStatus to allow for 0-399 status codes
        validateStatus: (status) => status >= 0 && status < 400,

        // Allow no redirects
        maxRedirects: 0,
      })
      .then((res) => {
        try {
          const timing = Date.now() - startTime;

          logger.debug(
            "Proxy response %d (%s) from downstream URI '%s' at upstream hostname '%s' in %dms",
            res.status,
            res.statusText,
            uri,
            hostname,
            timing,
          );
          googleAnalytics.fireServerEventGA4(
            gaCategory,
            'ProxyResponse',
            `Proxy response ${res.status} (${res.statusText}) from downstream URI '${uri}' at upstream hostname '${hostname}' in ${timing}ms`,
          );

          // Check the location header to see if we need to redirect
          if (res.headers.location) {
            const location = res.headers.location;
            logger.debug("Redirecting to '%s'", location);

            // If the request is a domain, then replace this request hostname with the current transformed hostname
            if (location.startsWith('http://') || location.startsWith('https://')) {
              res.headers.location = location.replace(host, hostname);
            }
          }

          if (allowCorsHeaderOverwrite) {
            if (
              res.headers['access-control-allow-headers'] !== undefined &&
              res.headers['access-control-allow-headers'].length > 0
            ) {
              response.removeHeader('access-control-allow-headers');
            }
            if (
              res.headers['access-control-allow-methods'] !== undefined &&
              res.headers['access-control-allow-methods'].length > 0
            ) {
              response.removeHeader('access-control-allow-methods');
            }
            if (res.headers['access-control-max-age'] !== undefined) {
              response.removeHeader('access-control-max-age');
            }
            if (
              res.headers['access-control-expose-headers'] !== undefined &&
              res.headers['access-control-expose-headers'].length > 0
            ) {
              response.removeHeader('access-control-expose-headers');
            }
          }

          delete res.headers.server;
          delete res.headers.date;
          delete res.headers.connection;
          delete res.headers['x-powered-by'];
          res.headers['set-cookie'] = AllCatchRoute._transformSetCookieHeader(
            res.headers['set-cookie'],
            AllCatchRoute._extractBaseHost(host),
            AllCatchRoute._extractBaseHost(hostname),
          ) as any;
          res.headers['x-downstream-timing'] = `${timing}ms`;

          if (res.headers['set-cookie'] === undefined) delete res.headers['set-cookie'];

          const body = AllCatchRoute._arrayBufferToString(res.data);

          // set the content-length header
          delete res.headers['content-length'];
          res.headers['content-length'] = body.length.toString();

          response.status(res.status);
          response.header(res.headers);
          response.getHeaderNames().forEach((headerName: string) => {
            const headerValue = response.getHeader(headerName);
            response.removeHeader(headerName);
            response.setHeader(headerName.toLowerCase(), headerValue);
          });
          response.end(body, 'utf-8');
        } catch (e) {
          logger.error('Error while proxying response: %s', e.message);
          googleAnalytics.fireServerEventGA4(
            gaCategory,
            'ProxyResponseError',
            `Error while proxying response: ${e.message}`,
          );
          next(e);
        }
      })
      .catch((err) => {
        try {
          const timing = Date.now() - startTime;

          if (err.response !== undefined) {
            logger.warning(
              "Proxy error response %d (%s) from downstream URI '%s' at upstream hostname '%s' in %dms",
              err.response.status,
              err.response.statusText,
              uri,
              hostname,
              timing,
            );
            googleAnalytics.fireServerEventGA4(
              gaCategory,
              'ProxyErrorResponse',
              `Proxy error response ${err.response.status} (${err.response.statusText}) from downstream URI '${uri}' at upstream hostname '${hostname}' in ${timing}ms`,
            );

            // Check the location header to see if we need to redirect (this is unlikely as this header is not really going to be on anything other than a 3xx response)
            if (err.response.headers.location) {
              const location = err.response.headers.location;
              logger.debug("Redirecting to '%s'", location);

              // If the request is a domain, then replace this request hostname with the current transformed hostname
              if (location.startsWith('http://') || location.startsWith('https://')) {
                err.response.headers.location = location.replace(host, hostname);
              }
            }

            if (allowCorsHeaderOverwrite) {
              if (
                err.response.headers['access-control-allow-headers'] !== undefined &&
                err.response.headers['access-control-allow-headers'].length > 0
              ) {
                response.removeHeader('access-control-allow-headers');
              }
              if (
                err.response.headers['access-control-allow-methods'] !== undefined &&
                err.response.headers['access-control-allow-methods'].length > 0
              ) {
                response.removeHeader('access-control-allow-methods');
              }
              if (err.response.headers['access-control-max-age'] !== undefined) {
                response.removeHeader('access-control-max-age');
              }
              if (
                err.response.headers['access-control-expose-headers'] !== undefined &&
                err.response.headers['access-control-expose-headers'].length > 0
              ) {
                response.removeHeader('access-control-expose-headers');
              }
            }

            delete err.response.headers.server;
            delete err.response.headers.date;
            delete err.response.headers.connection;
            delete err.response.headers['x-powered-by'];
            err.response.headers['set-cookie'] = AllCatchRoute._transformSetCookieHeader(
              err.response.headers['set-cookie'],
              AllCatchRoute._extractBaseHost(host),
              AllCatchRoute._extractBaseHost(hostname),
            ) as any;
            err.response.headers['x-downstream-timing'] = `${timing}ms`;

            if (err.response.headers['set-cookie'] === undefined) delete err.response.headers['set-cookie'];

            const body = AllCatchRoute._arrayBufferToString(err.response.data);

            // set the content-length header
            delete err.response.headers['content-length'];
            err.response.headers['content-length'] = body.length.toString();

            response.status(err.response.status);
            response.header(err.response.headers);
            response.getHeaderNames().forEach((headerName: string) => {
              const headerValue = response.getHeader(headerName);
              response.removeHeader(headerName);
              response.setHeader(headerName.toLowerCase(), headerValue);
            });
            response.end(body, 'utf-8');
            return;
          }

          // Check if error is a timeout
          if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
            logger.warning(
              "Proxy timed out from downstream URI '%s' on upstream hostname '%s' after %dms.",
              uri,
              hostname,
              timing,
            );
            googleAnalytics.fireServerEventGA4(
              gaCategory,
              'ProxyTimeout',
              `Proxy timeout from downstream URI '${uri}' on upstream hostname '${hostname}' after ${timing}ms`,
            );

            response.status(504);

            response.header({
              'x-downstream-timing': `${timing}ms`,
            });

            response.send(
              `<html><body><h1>504 Gateway Timeout</h1><p>The downstream URI '${htmlEncode(
                uri,
              )}' timed out after ${timing}ms.</p></body></html>`,
            );

            return;
          }

          logger.error(
            "Proxy error '%s' from downstream URI '%s' at upstream hostname '%s' in %dms",
            err.message,
            uri,
            hostname,
            timing,
          );
          googleAnalytics.fireServerEventGA4(
            gaCategory,
            'ProxyErrorUnknown',
            `Proxy error '${err.message}' from downstream URI '${uri}' at upstream hostname '${hostname}' in ${timing}ms`,
          );

          next(); // We didn't get a response so it'll just pass it onto upstream error handler
        } catch (e) {
          logger.error('Error while proxying response: %s', e.message);
          googleAnalytics.fireServerEventGA4(
            gaCategory,
            'ProxyResponseError',
            `Error while proxying response: ${e.message}`,
          );
          next(e);
        }
      });
  }
}

export = new AllCatchRoute();
