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
    Description: Resolves the upstream client's hostname to a valid IP address, and transforms it if it's a roblox test domain.
    Written by: Nikita Petko
*/

import '@lib/extensions/express/request';
import '@lib/extensions/express/response';

import logger from '@lib/logger';
import environment from '@lib/environment';

import net from '@mfdlabs/net';
import htmlEncode from 'escape-html';
import { NextFunction, Request, Response } from 'express';

const hostnameResolutionLogger = new logger(
  'hostname-resolution-middleware',
  environment.logLevel,
  environment.logToFileSystem,
  environment.logToConsole,
  environment.loggerCutPrefix,
);

export default class HostnameResolutionMiddleware {
  /**
   * Invokes the middleware.
   * @param {Request} request The request object.
   * @param {Response} response The response object.
   * @param {NextFunction} next The next function to call.
   * @returns {void} Nothing.
   */
  public static async invoke(request: Request, response: Response, next: NextFunction): Promise<void> {
    let hostname = environment.hostnameResolutionMiddlewareStripPortFromHostHeader
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

    hostnameResolutionLogger.debug("Resolved hostname for '%s' to '%s'.", hostname, resolvedHostname || '<unknown>');

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
    hostnameResolutionLogger.warning(
      "Resolved host for '%s' is undefined or null, responding with invalid hostname error",
      hostname,
    );
    request.fireEvent('NXDomain');

    response.status(503);
    response.contentType('text/html');
    response.noCache();
    response.send(
      `<html><body><h1>503 Service Unavailable</h1><p>Cannot satisfy request because the hostname ${htmlEncode(
        hostname,
      )} could not be resolved.</p></body></html>`,
    );
  }

  private static _transformHostname(hostname: string): string {
    if (typeof hostname !== 'string' || this._notTruthy(hostname)) return hostname;

    hostname = hostname.replace(/^https?:?\/\//, '');

    const match = environment.robloxTestSiteDomainRegex.exec(hostname);

    if (match === null) return hostname;

    // If group 2 is undefined, but group 3 is not, that means we have an apex domain (domain without subdomain)
    if (match !== null && match[2] === undefined && match[3] !== undefined) {
      return environment.robloxProductionApexDomain;
    }

    const subdomain = match[2];

    return `${subdomain}.${environment.robloxProductionApexDomain}`;
  }

  private static _handleInvalidHostHeader(request: Request, response: Response) {
    hostnameResolutionLogger.warning('Request had no host header present, responding with a 400.');
    request.fireEvent('InvalidHostname');

    response.status(400);
    response.contentType('text/html');
    response.noCache();
    response.send(
      `<html><body><h1>400 Bad Request</h1><p>Cannot satisfy request because the host header is missing.</p></body></html>`,
    );
  }

  private static _stripPort(hostname: string): string {
    if (!hostname) return hostname;

    const portIndex = hostname.indexOf(':');

    if (portIndex === -1) {
      return hostname;
    }

    return hostname.substring(0, portIndex);
  }

  private static _notTruthy(value: any): boolean {
    return value === undefined || value === null || value === '';
  }
}
