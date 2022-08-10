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
    File Name: denyLoopbackAttackMiddleware.ts
    Description: Denies access to addresses that correlate to the current machine.
    Written by: Nikita Petko
*/

import '@lib/extensions/express/request';
import '@lib/extensions/express/response';

import logger from '@lib/logger';
import environment from '@lib/environment';

import net from '@mfdlabs/net';
import htmlEncode from 'escape-html';
import { NextFunction, Request, Response } from 'express';

const denyLoopbackAttackLogger = new logger(
  'deny-loopback-attack-middleware',
  environment.logLevel,
  environment.logToFileSystem,
  environment.logToConsole,
  environment.loggerCutPrefix,
);

export default class DenyLoopbackAttackMiddleware {
  /**
   * Invokes the middleware.
   * @param {Request} request The request object.
   * @param {Response} response The response object.
   * @param {NextFunction} next The next function to call.
   * @returns {void} Nothing.
   */
  public static invoke(request: Request, response: Response, next: NextFunction): void {
    const hostname = request.context.get('hostname');
    const resolvedAddress = request.context.get('resolvedAddress');

    if (this._isConsideredLoopback(resolvedAddress, request.publicIp)) {
      this._handleLoopbackAttack(hostname, resolvedAddress, request, response);
      return;
    }

    if (this._isIp(hostname)) {
      if (this._isConsideredLoopback(hostname, request.publicIp)) {
        this._handleLoopbackAttack(hostname, hostname, request, response);
        return;
      }
    }

    next();
  }

  private static _handleLoopbackAttack(
    hostname: string,
    resolvedAddress: string,
    request: Request,
    response: Response,
  ): void {
    denyLoopbackAttackLogger.warning("Request to '%s' or '%s' is a loopback, responding with loopback error", hostname, resolvedAddress);
    request.fireEvent('LoopbackAttack');

    const encodedClientIp = htmlEncode(request.ip);
    const encodedHostname = htmlEncode(hostname);

    response.status(403);
    response.contentType('text/html');
    response.noCache();
    response.send(
      `<html><body><h1>403 Forbidden</h1><p>Loopback detected from upstream client '${encodedClientIp}' to downstream server '${encodedHostname}'.</p></body></html>`,
    );
  }

  private static _isConsideredLoopback(address: string, publicIp: string): boolean {
    return (
      net.isIPv4Loopback(address) ||
      net.isIPv6Loopback(address) ||
      address === net.getLocalIPv4() ||
      address === net.getLocalIPv6() ||
      address === publicIp
    );
  }

  private static _isIp(address: string): boolean {
    return net.isIPv4(address) || net.isIPv6(address);
  }
}
