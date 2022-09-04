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
    File Name: send_axios_request_middleware.ts
    Description: Sends the actual proxied request to the target server.
    Written by: Nikita Petko
*/

import '@lib/extensions/express/request';

import logger from '@lib/logger';
import environment from '@lib/environment';
import webUtility from '@lib/utility/web_utility';

import * as https from 'https';
import htmlEncode from 'escape-html';
import { NextFunction, Request, Response } from 'express';
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';

const sendAxiosRequestLogger = new logger(
  'send-axios-request-middleware',
  environment.logLevel,
  environment.logToFileSystem,
  environment.logToConsole,
  environment.loggerCutPrefix,
);

export default class SendAxiosRequestMiddleware {
  /**
   * Invokes the middleware.
   * @param {Request} request The request object.
   * @param {Response} response The response object.
   * @param {NextFunction} next The next function to call.
   * @returns {void} Nothing.
   */
  public static invoke(request: Request, response: Response, next: NextFunction): void {
    const url = request.originalUrl;
    const port = request.localPort;
    const hostname = request.context.get('hostname') as string;

    const uri = `${request.protocol}://${hostname}:${port}${url}`;

    sendAxiosRequestLogger.debug(
      'Proxy request \'%s\' from client \'%s\' on upstream hostname \'%s\' to downstream URI \'%s\'',
      request.method,
      request.ip,
      hostname,
      uri,
    );

    if (environment.sendAxiosRequestWithForwardedHeaders) {
      delete request.headers[environment.forwardingHeaderName];
      delete request.headers[environment.forwardingPortHeaderName];
      delete request.headers[environment.forwardingSchemeHeaderName];
      delete request.headers[environment.forwardingTransformedHostHeaderName];
      delete request.headers['x-forwarded-server'];
      delete request.headers['x-real-ip'];
    }

    if (request.body instanceof Buffer) {
      request.body = this._bufferToString(request.body);
    }

    const configuration = {
      data: request.body,
      headers: {
        ...request.headers,

        host: hostname,
      } as unknown,

      method: request.method,

      responseType: 'stream',

      url: uri,

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      validateStatus: (_status: number): boolean => true,

      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      maxRedirects: 0,

      timeout: environment.sendAxiosRequestTimeout,
    } as AxiosRequestConfig;

    if (environment.sendAxiosRequestWithForwardedHeaders) {
      configuration.headers['X-Forwarded-For'] = request.ip;
      configuration.headers['X-Forwarded-Host'] = request.headers.host;
      configuration.headers['X-Forwarded-Port'] = port.toString();
      configuration.headers['X-Forwarded-Proto'] = request.protocol;
      configuration.headers['X-Forwarded-Server'] = this._getMachineName();
      configuration.headers['X-Real-IP'] = request.realIp;
    }

    const transformedOrigin = request.context.get('transformedOrigin') as string;
    if (transformedOrigin) {
      configuration.headers.origin = transformedOrigin;
    }

    const transformedReferer = request.context.get('transformedReferer') as string;
    if (transformedReferer) {
      configuration.headers.referer = transformedReferer;
    }

    if (!environment.enableCertificateValidation) {
      configuration.httpsAgent = new https.Agent({
        rejectUnauthorized: false,
      });
    }

    if (environment.debugEchoRequestConfig) {
      sendAxiosRequestLogger.debug('!!! DEBUG VARIABLE ENABLED !!! Respond to upstream with Axios Configuration...');

      response.header('x-debug-axios-response', 'true');

      response.status(200);
      response.contentType('application/json');
      response.noCache();
      response.send(JSON.stringify(configuration, null, 2));
      return;
    }

    axios
      .request(configuration)
      .then((axiosResponse) => this._handleAxiosResponse(hostname, axiosResponse, request, response, next))
      .catch((axiosError) => this._handleAxiosError(hostname, axiosError, request, response, next));
  }

  private static _bufferToString(buffer: Buffer): string {
    return buffer.toString('utf8');
  }

  private static _machineNameCached = undefined;

  private static _getMachineName(): string {
    if (this._machineNameCached === undefined) {
      this._machineNameCached = webUtility.getMachineID();
    }

    return this._machineNameCached;
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
      const cookie = this._parseCookie(header);
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
    return header.map((cookie) => this._transformSetCookieHeader(cookie, testHost, host)) as string[];
  }

  private static _extractBaseHost(host: string): string {
    // Extracts just hostname.tld from subdomain.hostname.tld etc
    return host.split('.').slice(-2).join('.');
  }

  private static _handleAxiosError(
    hostname: string,
    error: AxiosError,
    request: Request,
    response: Response,
    next: NextFunction,
  ): void {
    const timing = Date.now() - (request.context.get('startTime') as number);
    const uri = error.config.url;

    // Check if error is a timeout
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      sendAxiosRequestLogger.warning(
        'Proxy timed out from downstream URI \'%s\' on upstream hostname \'%s\' after %dms.',
        uri,
        hostname,
        timing,
      );
      request.fireEvent(
        'ProxyTimeout',
        `Proxy timeout from downstream URI '${uri}' on upstream hostname '${hostname}' after ${timing}ms`,
      );

      response.status(504);

      response.header({
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'x-downstream-timing': `${timing}ms`,
      });

      response.noCache();
      response.contentType('text/html');

      response.send(
        `<html><body><h1>504 Gateway Timeout</h1><p>The downstream URI '${htmlEncode(
          uri,
        )}' timed out after ${timing}ms.</p></body></html>`,
      );

      return;
    }

    sendAxiosRequestLogger.error(
      'Proxy error \'%s\' from downstream URI \'%s\' at upstream hostname \'%s\' in %dms',
      error.message,
      uri,
      hostname,
      timing,
    );
    request.fireEvent(
      'ProxyErrorUnknown',
      `Proxy error '${error.message}' from downstream URI '${uri}' at upstream hostname '${hostname}' in ${timing}ms`,
    );

    next(error); // We didn't get a response so it'll just pass it onto upstream error handler
  }

  /* This should hit for any status, the only way to hit the exception handler is if we have a timeout or abortion. */
  private static _handleAxiosResponse(
    hostname: string,
    axiosResponse: AxiosResponse,
    request: Request,
    response: Response,
    next: NextFunction,
  ): void {
    try {
      const timing = Date.now() - (request.context.get('startTime') as number);

      sendAxiosRequestLogger.debug(
        'Proxy response %d (%s) from downstream URI \'%s\' at upstream hostname \'%s\' in %dms',
        axiosResponse.status,
        axiosResponse.statusText,
        axiosResponse.config.url,
        hostname,
        timing,
      );
      request.fireEvent(
        'ProxyResponse',
        `Proxy response ${axiosResponse.status} (${axiosResponse.statusText}) from downstream URI '${axiosResponse.config.url}' at upstream hostname '${hostname}' in ${timing}ms`,
      );

      // Check for a redirect.
      if (axiosResponse.headers.location) {
        const location = axiosResponse.headers.location;
        sendAxiosRequestLogger.debug('Transforming redirect location');

        // If the request is a domain, then replace this request hostname with the current transformed hostname
        if (location.startsWith('http://') || location.startsWith('https://')) {
          axiosResponse.headers.location = location.replace(hostname, request.headers.host);
        }
      }

      const allowCorsHeaderOverwrite = request.context.get('allowCorsHeaderOverwrite');
      if (allowCorsHeaderOverwrite) {
        const allowedHeaders = axiosResponse.headers['access-control-allow-headers'];
        const allowedMethods = axiosResponse.headers['access-control-allow-methods'];
        const maxAge = axiosResponse.headers['access-control-max-age'];
        const exposeHeaders = axiosResponse.headers['access-control-expose-headers'];

        if (allowedHeaders) {
          response.removeHeader('access-control-allow-headers');
        }

        if (allowedMethods) {
          response.removeHeader('access-control-allow-methods');
        }

        if (maxAge) {
          response.removeHeader('access-control-max-age');
        }

        if (exposeHeaders) {
          response.removeHeader('access-control-expose-headers');
        }
      }

      delete axiosResponse.headers.server;
      delete axiosResponse.headers.date;
      delete axiosResponse.headers.connection;
      delete axiosResponse.headers['x-powered-by'];

      axiosResponse.headers['set-cookie'] = this._transformSetCookieHeader(
        axiosResponse.headers['set-cookie'],
        this._extractBaseHost(hostname),
        this._extractBaseHost(request.headers.host),
      ) as string[];

      axiosResponse.headers['x-downstream-timing'] = `${timing}ms`;

      if (axiosResponse['set-cookie'] === undefined) delete axiosResponse.headers['set-cookie'];

      delete axiosResponse.headers.expires;

      // The response is a stream, so we need to pipe it to a string.

      const responseString = new Promise<string>((resolve, reject) => {
        let r = '';
        axiosResponse.data.on('data', (chunk) => {
          r += chunk;
        });
        axiosResponse.data.on('end', () => {
          resolve(r);
        });
        axiosResponse.data.on('error', (error) => {
          reject(error);
        });
      });

      responseString
        .then((r) => {
          delete axiosResponse.headers['content-length'];
          axiosResponse.headers['content-length'] = Buffer.byteLength(r).toString();

          response.status(axiosResponse.status);
          response.set(axiosResponse.headers);
          response.end(r);
        })
        .catch((error) => {
          if (error.code === 'ECONNRESET') {
            // This is an unknown issue where the connection will reset on some TLS connections.
            // We'll respond with a 504 Gateway Timeout.
            // Please read RBXPRR-35 for more information.

            sendAxiosRequestLogger.error(
              'Proxy error \'%s\' from downstream URI \'%s\' at upstream hostname \'%s\' in %dms',
              error.message,
              axiosResponse.config.url,
              hostname,
              timing,
            );
            request.fireEvent(
              'ProxyErrorUnknown',
              `Proxy error '${error.message}' from downstream URI '${axiosResponse.config.url}' at upstream hostname '${request.headers.host}' in ${timing}ms`,
            );

            response.status(502);
            response.header({
              // eslint-disable-next-line @typescript-eslint/naming-convention
              'x-downstream-timing': `${timing}ms`,
            });
            response.noCache();
            response.contentType('text/html');

            response.send(
              `<html><body><h1>502 Bad Gateway</h1><p>The downstream response from URI '${htmlEncode(
                axiosResponse.config.url,
              )}' was aborted.</p><p><b>This is a known issue, and there's Jira ticket (<a href="https://mfdlabs.atlassian.net/browse/RBXPRR-35">RBXPRR-35</a>) that attempts to resolve this issue.</b></p></body></html>`,
            );

            return;
          }

          sendAxiosRequestLogger.error('Error in response stream', error);
          request.fireEvent('ProxyResponseError', error);

          next(error);
        });
    } catch (error) {
      sendAxiosRequestLogger.error('Error while proxying response: %s', error.message);
      request.fireEvent('ProxyResponseError', `Error while proxying response: ${error.message}`);
      next(error);
    }
  }
}
