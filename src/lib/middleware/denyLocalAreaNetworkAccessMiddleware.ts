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
    File Name: denyLocalAreaNetworkAccessMiddleware.ts
    Description: Denies access to the local area network if enabled.
    Written by: Nikita Petko
*/

import '@lib/extensions/express/request';
import '@lib/extensions/express/response';

import logger from '@lib/logger';
import environment from '@lib/environment';

import net from '@mfdlabs/net';
import htmlEncode from 'escape-html';
import { NextFunction, Request, Response } from 'express';

const denyLocalAreaNetworkAccessLogger = new logger(
  'deny-local-area-network-access-middleware',
  environment.logLevel,
  environment.logToFileSystem,
  environment.logToConsole,
  environment.loggerCutPrefix,
);

export default class DenyLocalAreaNetworkAccessMiddleware {
  /**
   * Invokes the middleware.
   * @param {Request} request The request object.
   * @param {Response} response The response object.
   * @param {NextFunction} next The next function to call.
   * @returns {void} Nothing.
   */
  public static invoke(request: Request, response: Response, next: NextFunction): void {
    if (!environment.hateLocalAreaNetworkAccess) return next();

    const hostname = request.context.get('hostname');

    // We assume these request context variables are set before, as the last middleware
    // should exit the context if they're malformed.
    const resolvedAddress = request.context.get('resolvedAddress');

    if (this._isUniqueLocalAddress(resolvedAddress)) {
      this._handleLocalAreaNetworkAccess(hostname, resolvedAddress, request, response);
      return;
    }

    if (this._isIp(hostname)) {
      if (this._isUniqueLocalAddress(hostname)) {
        this._handleLocalAreaNetworkAccess(hostname, hostname, request, response);
        return;
      }
    }

    next();
  }

  private static _handleLocalAreaNetworkAccess(
    hostname: string,
    resolvedAddres: string,
    request: Request,
    response: Response,
  ): void {
    denyLocalAreaNetworkAccessLogger.warning("Request to '%s' or '%s' is from a LAN, responding with LAN access error", hostname, resolvedAddres);
    request.fireEvent('localAreaNetworkAccessDenied');

    let message = '';

    if (hostname === resolvedAddres) {
      message = `Access to that address is forbidden.`;
    } else {
      message = `Access to the address that ${htmlEncode(hostname)} resolved to is forbidden.`;
    }

    response.status(403);
    response.contentType('text/html');
    response.noCache();
    response.send(`<html><body><h1>403 Forbidden</h1><p>${message}</p></body></html>`);
  }

  private static _isUniqueLocalAddress(address: string): boolean {
    return (
      net.isIPv4RFC1918(address) ||
      net.isIPv6RFC4193(address) ||
      net.isIPv6RFC3879(address) ||
      net.isIPv4LinkLocal(address) ||
      net.isIPv6LinkLocal(address)
    );
  }

  private static _isIp(address: string): boolean {
    return net.isIPv4(address) || net.isIPv6(address);
  }
}
