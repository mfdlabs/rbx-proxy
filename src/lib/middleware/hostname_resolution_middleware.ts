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
    File Name: hostname_resolution_middleware.ts
    Description: Resolves the downstream client's hostname to a valid IP address, and transforms it if it's a roblox test domain.
    Written by: Nikita Petko
*/

import '@lib/extensions/express/request';
import '@lib/extensions/express/response';

import hostnameEnvironment from '@lib/environment/hostname_environment';
import loadBalancerResponder from '@lib/responders/load_balancer_responder';
import hardcodedResponseWriter from '@lib/writers/hardcoded_response_writer';
import hostnameResolutionMiddlewareLogger from '@lib/loggers/middleware/hostname_resolution_middleware_logger';
import * as hostnameResolutionMiddlewareMetrics from '@lib/metrics/middleware/hostname_resolution_middleware_metrics';

import net from '@mfdlabs/net';
import { NextFunction, Request, Response } from 'express';

export default class HostnameResolutionMiddleware {
  /**
   * Invokes the middleware.
   * @param {Request} request The request object.
   * @param {Response} response The response object.
   * @param {NextFunction} next The next function to call.
   * @returns {void} Nothing.
   */
  public static async invoke(request: Request, response: Response, next: NextFunction): Promise<void> {
    if (hardcodedResponseWriter.hasRule(request)) return next();

    let hostname = hostnameEnvironment.singleton.hostnameResolutionMiddlewareStripPortFromHostHeader
      ? this._stripPort(request.headers.host)
      : request.headers.host;

    if (typeof hostname !== 'string' || this._notTruthy(hostname)) {
      this._handleInvalidHostHeader(request, response);
      return;
    }

    hostname = this._transformHostname(hostname);

    if (typeof hostname !== 'string' || this._notTruthy(hostname)) {
      this._handleInvalidHostHeader(request, response); // Just in case
      return;
    }

    const resolvedHostname = await net.resolveHostname(hostname);

    hostnameResolutionMiddlewareLogger.debug(
      "Resolved hostname for '%s' to '%s'.",
      hostname,
      resolvedHostname || '<unknown>',
    );

    if (typeof resolvedHostname !== 'string' || this._notTruthy(resolvedHostname)) {
      this._handleNxDomain(hostname, request, response);
      return;
    }

    request.context.set('hostname', hostname);
    request.context.set('resolvedAddress', resolvedHostname);

    if (request.headers.origin) {
      const origin = request.headers.origin.replace(request.headers.host, hostname);
      request.context.set('transformedOrigin', origin);
    }
    if (request.headers.referer) {
      const referer = request.headers.referer.replace(request.headers.host, hostname);
      request.context.set('transformedReferer', referer);
    }

    next();
  }

  private static _handleNxDomain(hostname: string, request: Request, response: Response) {
    hostnameResolutionMiddlewareLogger.warning(
      "Resolved host for '%s' is undefined or null, responding with invalid hostname error",
      hostname,
    );
    request.fireEvent('NXDomain');

    hostnameResolutionMiddlewareMetrics.hostnamesThatDidNotResolve.inc({ hostname });

    loadBalancerResponder.sendMessage(
      `Cannot satisfy request because the hostname ${request.hostname} could not be resolved.`,
      request,
      response,
      503,
    );
  }

  private static _transformHostname(hostname: string): string {
    if (typeof hostname !== 'string' || this._notTruthy(hostname)) return hostname;

    hostname = hostname.replace(/^https?:?\/\//, '');

    const match = hostnameEnvironment.singleton.robloxTestSiteDomainRegex.exec(hostname);

    if (match === null) return hostname;

    // If group 2 is undefined, but group 3 is not, that means we have an apex domain (domain without subdomain)
    if (match !== null && match[2] === undefined && match[3] !== undefined) {
      return hostnameEnvironment.singleton.robloxProductionApexDomain;
    }

    const subdomain = match[2];

    return `${subdomain}.${hostnameEnvironment.singleton.robloxProductionApexDomain}`;
  }

  private static _handleInvalidHostHeader(request: Request, response: Response) {
    hostnameResolutionMiddlewareLogger.warning('Request had no host header present, responding with a 400.');
    request.fireEvent('InvalidHostname');

    hostnameResolutionMiddlewareMetrics.requestThatHadNoHostname.inc({
      method: request.method,
      endpoint: request.path,
      caller: request.ip,
    });

    loadBalancerResponder.sendMessage(
      `Cannot satisfy request because the host header is missing.`,
      request,
      response,
      400,
    );
  }

  private static _stripPort(hostname: string): string {
    if (!hostname) return hostname;

    // check if IPv6:
    if (hostname.startsWith('[') && hostname.indexOf(']') !== -1) {
      const split = hostname.split(']');

      return split[0] + ']'; // [IPv6]
    }

    const portIndex = hostname.indexOf(':');

    if (portIndex === -1) {
      return hostname;
    }

    return hostname.substring(0, portIndex);
  }

  private static _notTruthy(value: unknown): boolean {
    return value === undefined || value === null || value === '';
  }
}
