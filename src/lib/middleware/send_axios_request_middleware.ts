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

import webUtility from '@lib/utility/web_utility';
import proxyEnvironment from '@lib/environment/proxy_environment';
import axiosEnvironment from '@lib/environment/axios_environment';
import hostnameEnvironment from '@lib/environment/hostname_environment';
import proxyRawRequestsLogger from '@lib/loggers/proxy_raw_requests_logger';
import proxyRawResponsesLogger from '@lib/loggers/proxy_raw_responses_logger';
import sendAxiosRequestMiddlewareLogger from '@lib/loggers/middleware/send_axios_request_middleware_logger';
import * as sendAxiosRequestMiddlewareMetrics from '@lib/metrics/middleware/send_axios_request_middleware_metrics';

import * as http from 'http';
import * as https from 'https';
import htmlEncode from 'escape-html';
import { NextFunction, Request, Response } from 'express';
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';

const knownSitetestDatacenters = ['RA', 'AWA', 'SNC1', 'SNC2', 'SNC3'];
const knownProductionDatacenters = ['CHI1', 'CHI2'];

const knownLoadBalancerTypes = ['lb', 'rlb-spx'];

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
    const hostname = request.context.get('hostname') as string;
    const resolvedAddress = request.context.get('resolvedAddress') as string;

    let port = request.localPort;

    if (port === undefined) {
      port = request.protocol === 'https' ? 443 : 80;
    }

    const uri = `${request.protocol}://${resolvedAddress}:${port}${url}`;

    sendAxiosRequestMiddlewareLogger.debug(
      "Proxy request '%s' from client '%s' on downstream '%s' to upstream '%s'",
      request.method,
      request.ip,
      request.hostname,
      hostname,
    );

    sendAxiosRequestMiddlewareMetrics.totalProxyRequests.inc({
      method: request.method,
      upstream: hostname,
      downstream: request.hostname,
      caller: request.ip,
    });

    if (axiosEnvironment.singleton.sendAxiosRequestWithForwardedHeaders) {
      sendAxiosRequestMiddlewareMetrics.requestsWithForwardedHeaders.inc({
        method: request.method,
        upstream: hostname,
        downstream: request.hostname,
        caller: request.ip,
      });

      delete request.headers[proxyEnvironment.singleton.forwardingPortHeaderName.toLowerCase()];
      delete request.headers[proxyEnvironment.singleton.forwardingSchemeHeaderName.toLowerCase()];
      delete request.headers[proxyEnvironment.singleton.forwardingTransformedHostHeaderName.toLowerCase()];
      delete request.headers[proxyEnvironment.singleton.forwardingServerNameHeaderName.toLowerCase()];
      delete request.headers[proxyEnvironment.singleton.forwardingRealClientIPHeaderName.toLowerCase()];
    }

    if (request.body instanceof Buffer) {
      sendAxiosRequestMiddlewareMetrics.requestsWithBody.inc({
        method: request.method,
        upstream: hostname,
        downstream: request.hostname,
        caller: request.ip,
      });

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

      validateStatus: (_status: number): boolean => true,

      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      maxRedirects: 0,

      timeout: axiosEnvironment.singleton.sendAxiosRequestTimeout,
    } as AxiosRequestConfig;

    if (axiosEnvironment.singleton.sendAxiosRequestWithForwardedHeaders) {
      const xForwardedFor = request.headers[proxyEnvironment.singleton.forwardingHeaderName.toLowerCase()] as string;

      if (xForwardedFor !== undefined) {
        // First IP is the client IP, everything else is the proxy chain.
        // We are a proxy, so we add ourselves to the chain.
        configuration.headers[
          proxyEnvironment.singleton.forwardingHeaderName.toLowerCase()
        ] = `${xForwardedFor}, ${request.realIp}`;
      } else {
        configuration.headers[proxyEnvironment.singleton.forwardingHeaderName.toLowerCase()] = request.realIp;
      }

      configuration.headers[proxyEnvironment.singleton.forwardingTransformedHostHeaderName.toLowerCase()] =
        request.headers.host;
      configuration.headers[proxyEnvironment.singleton.forwardingPortHeaderName.toLowerCase()] = port.toString();
      configuration.headers[proxyEnvironment.singleton.forwardingSchemeHeaderName.toLowerCase()] = request.protocol;
      configuration.headers[proxyEnvironment.singleton.forwardingServerNameHeaderName.toLowerCase()] =
        this._getMachineName();
      configuration.headers[proxyEnvironment.singleton.forwardingRealClientIPHeaderName.toLowerCase()] = request.realIp;
    }

    const transformedOrigin = request.context.get('transformedOrigin') as string;
    if (transformedOrigin) {
      sendAxiosRequestMiddlewareMetrics.requestsWithTransformedOrigin.inc({
        method: request.method,
        upstream: hostname,
        downstream: request.hostname,
        actual_origin: request.headers.origin,
        transformed_origin: transformedOrigin,
        caller: request.ip,
      });

      configuration.headers['origin'] = transformedOrigin;
    }

    const transformedReferer = request.context.get('transformedReferer') as string;
    if (transformedReferer) {
      sendAxiosRequestMiddlewareMetrics.requestsWithTransformedReferer.inc({
        method: request.method,
        upstream: hostname,
        downstream: request.hostname,
        actual_referer: request.headers.referer,
        transformed_referer: transformedReferer,
        caller: request.ip,
      });

      configuration.headers['referer'] = transformedReferer;
    }

    if (!axiosEnvironment.singleton.enableCertificateValidation) {
      sendAxiosRequestMiddlewareMetrics.requestsWithoutCertificateVerification.inc({
        method: request.method,
        upstream: hostname,
        downstream: request.hostname,
        caller: request.ip,
      });

      configuration.httpsAgent = new https.Agent({
        rejectUnauthorized: false,
      });
    }

    if (axiosEnvironment.singleton.debugEchoRequestConfig) {
      sendAxiosRequestMiddlewareLogger.debug(
        '!!! DEBUG VARIABLE ENABLED !!! Respond to downstream with Axios Configuration...',
      );

      sendAxiosRequestMiddlewareMetrics.totalDebugProxyRequests.inc({
        method: request.method,
        upstream: hostname,
        downstream: request.hostname,
        caller: request.ip,
      });

      response.header('x-debug-axios-response', 'true');

      response.status(200);
      response.contentType('application/json');
      response.noCache();
      response.send(JSON.stringify(configuration, null, 2));
      return;
    }

    proxyRawRequestsLogger.debug('Configuration for downstream request: %s', JSON.stringify(configuration));

    request.context.set('startTime', Date.now());

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

  private static _parseCookie(cookie: string): { [key: string]: any } {
    const cookieObject: { [key: string]: any } = {};

    if (cookie === undefined || cookie === null) return cookieObject;

    const cookieArray = cookie.split(';');

    for (const cookiePair of cookieArray) {
      const cookiePairArray = cookiePair.split('=');

      if (cookiePairArray.length === 2) {
        cookieObject[decodeURIComponent(cookiePairArray[0].trim())] = decodeURIComponent(cookiePairArray[1].trim());
      } else {
        cookieObject[decodeURIComponent(cookiePairArray[0].trim())] = true;
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
      if (cookie.domain?.includes(testHost)) {
        if (cookie.domain?.startsWith('.')) {
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
    const timing = Date.now() - (request.context.get('startTime') as number) || 0;
    const uri = error.config.url;

    proxyRawResponsesLogger.error('Error while proxying request to %s: %s', uri, error.message);

    sendAxiosRequestMiddlewareMetrics.proxyRequestDuration
      .labels(request.method, hostname, request.hostname, request.ip)
      .observe(timing);

    // Check if error is a timeout
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      sendAxiosRequestMiddlewareLogger.warning(
        "Proxy timed out on upstream '%s' from downstream '%s' after %dms.",
        hostname,
        request.hostname,
        timing,
      );
      request.fireEvent(
        'ProxyTimeout',
        `Proxy timeout from upstream '${hostname}' on downstream '${request.hostname}' after ${timing}ms`,
      );

      sendAxiosRequestMiddlewareMetrics.timedOutProxyRequests.inc({
        method: request.method,
        upstream: hostname,
        downstream: request.hostname,
        caller: request.ip,
      });

      response.sendMessage(
        [
          `The upstream timed out.\nHost: <b>${htmlEncode(hostname)}</b>\nAfter: <b>${htmlEncode(
            timing.toString(),
          )}ms</b>`,
          undefined,
          true,
        ],
        504,
        undefined,
        true,
        {
          'x-upstream-timing': `${timing}ms`,
        },
      );

      return;
    }

    sendAxiosRequestMiddlewareLogger.error(
      "Proxy error '%s' from upstream '%s' at downstream '%s' in %dms",
      error.message,
      hostname,
      request.hostname,
      timing,
    );
    request.fireEvent(
      'ProxyErrorUnknown',
      `Proxy error '${error.message}' from upstream '${hostname}' at downstream '${request.hostname}' in ${timing}ms`,
    );

    sendAxiosRequestMiddlewareMetrics.unknownProxyErrors.inc({
      method: request.method,
      upstream: hostname,
      downstream: request.hostname,
      caller: request.ip,
    });

    next(error); // We didn't get a response so it'll just pass it onto downstream error handler
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
      const timing = Date.now() - (request.context.get('startTime') as number) || 0;

      sendAxiosRequestMiddlewareLogger.debug(
        "Proxy response %d (%s) from upstream '%s' at downstream '%s' in %dms",
        axiosResponse.status,
        axiosResponse.statusText,
        hostname,
        request.hostname,
        timing,
      );
      request.fireEvent(
        'ProxyResponse',
        `Proxy response ${axiosResponse.status} (${axiosResponse.statusText}) from upstream '${hostname}' at downstream '${request.hostname}' in ${timing}ms`,
      );

      sendAxiosRequestMiddlewareMetrics.proxySuccessfulRequests.inc({
        method: request.method,
        upstream: hostname,
        downstream: request.hostname,
        status: axiosResponse.status,
        caller: request.ip,
      });

      sendAxiosRequestMiddlewareMetrics.proxyRequestDuration
        .labels(request.method, hostname, request.hostname, request.ip)
        .observe(timing);

      // Check for a redirect.
      if (axiosResponse.headers.location) {
        const location = axiosResponse.headers.location;

        // If the request is a domain, then replace this request hostname with the current transformed hostname
        if (location.startsWith('http://') || location.startsWith('https://')) {
          sendAxiosRequestMiddlewareLogger.debug(
            'Transforming redirect location from %s to %s',
            location,
            location.replace(hostname, request.headers.host),
          );

          sendAxiosRequestMiddlewareMetrics.proxyRequestsWithTransformedRedirectLocation.inc({
            method: request.method,
            upstream: hostname,
            downstream: request.hostname,
            actual_redirect_location: location,
            transformed_redirect_location: location.replace(hostname, request.headers.host),
            caller: request.ip,
          });

          axiosResponse.headers.location = location.replace(hostname, request.headers.host);
        }
      }

      const allowCorsHeaderOverwrite = request.context.get('allowCorsHeaderOverwrite');
      if (allowCorsHeaderOverwrite) {
        sendAxiosRequestMiddlewareMetrics.proxyRequestsWithCorsOverride.inc({
          method: request.method,
          upstream: hostname,
          downstream: request.hostname,
          caller: request.ip,
        });

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

      axiosResponse.headers['x-upstream-timing'] = `${timing}ms`;

      if (axiosResponse['set-cookie'] === undefined) delete axiosResponse.headers['set-cookie'];

      delete axiosResponse.headers.expires;

      // Shuffle the roblox-machine-id header.
      const machineId = axiosResponse.headers['roblox-machine-id'];
      if (machineId) {
        // In the form of "roblox-machine-id: ${DATA_CENTER_NAME}-${MACHINE_TYPE}{MACHINE_ID}"
        const machineIdParts = machineId.split('-');

        axiosResponse.headers['x-rblx-origin'] =
          knownLoadBalancerTypes[Math.floor(Math.random() * knownLoadBalancerTypes.length)];

        const matches = hostnameEnvironment.singleton.robloxTestSiteDomainRegex.exec(request.hostname);
        const environment = matches ? matches?.['groups']?.['environment'] : 'prod';

        const randomDc =
          environment !== 'prod'
            ? knownSitetestDatacenters[Math.floor(Math.random() * knownSitetestDatacenters.length)]
            : knownProductionDatacenters[Math.floor(Math.random() * knownProductionDatacenters.length)];

        // If the environment is sitetestX change to stX and if it's gametestX change to gtX
        if (environment !== 'prod') {
          axiosResponse.headers['x-rblx-env'] = environment;
          axiosResponse.headers['x-rblx-pop'] = `${axiosResponse.headers['x-rblx-env']}-${randomDc.toLowerCase()}`;
        }

        axiosResponse.headers['roblox-machine-id'] = `${randomDc}-${machineIdParts[1]}`;
      }

      // The response is a stream, so we need to pipe it to a string.

      const responseStringTask = this._getResponseStringAsync(axiosResponse);

      responseStringTask
        .then((responseString) => {
          delete axiosResponse.headers['content-length'];
          axiosResponse.headers['content-length'] = Buffer.byteLength(responseString).toString();

          proxyRawResponsesLogger.debug(
            'Proxy response from %s: %s',
            axiosResponse.config.url,
            JSON.stringify({
              status: axiosResponse.status,
              statusText: axiosResponse.statusText,
              headers: axiosResponse.headers,
              data: responseString,
            }),
          );

          response.status(axiosResponse.status);
          response.set(axiosResponse.headers);
          response.end(responseString);
        })
        .catch((error) => {
          if (error && error.code === 'ECONNRESET') {
            sendAxiosRequestMiddlewareMetrics.proxyRequestsThatHadAbortedResponses.inc({
              method: request.method,
              upstream: hostname,
              downstream: request.hostname,
              caller: request.ip,
            });

            // This is an unknown issue where the connection will reset on some TLS connections.
            // We'll respond with a 504 Gateway Timeout.

            sendAxiosRequestMiddlewareLogger.error(
              "Proxy error '%s' from upstream '%s' at downstream '%s' in %dms",
              error.message,
              hostname,
              request.hostname,
              timing,
            );
            request.fireEvent(
              'ProxyErrorUnknown',
              `Proxy error '${error.message}' from upstream '${hostname}' at downstream hostname '${request.hostname}' in ${timing}ms`,
            );

            request.context.set('errorContext', [
              `The upstream response was aborted. This is a known issue, please be patient while we look for a fix.`,
            ]);
          }

          sendAxiosRequestMiddlewareLogger.error('Error in response stream', error);
          request.fireEvent('ProxyResponseError', error);

          next(error);
        });
    } catch (error) {
      sendAxiosRequestMiddlewareMetrics.unknownProxyErrors.inc({
        method: request.method,
        upstream: hostname,
        downstream: request.hostname,
        caller: request.ip,
      });

      sendAxiosRequestMiddlewareLogger.error('Error while proxying response: %s', error.message);
      request.fireEvent('ProxyResponseError', `Error while proxying response: ${error.message}`);
      next(error);
    }
  }

  private static async _getResponseStringAsync(axiosResponse: AxiosResponse<http.IncomingMessage>): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let responseString = '';
      axiosResponse.data.on('data', (chunk: string) => {
        responseString += chunk;
      });
      axiosResponse.data.on('end', () => {
        resolve(responseString);
      });
      axiosResponse.data.on('error', (error: Error) => {
        reject(error);
      });
    });
  }
}
