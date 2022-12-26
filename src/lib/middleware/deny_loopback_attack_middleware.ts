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
    File Name: deny_loopback_attack_middleware.ts
    Description: Denies access to addresses that correlate to the current machine.
    Written by: Nikita Petko
*/

import '@lib/extensions/express/request';
import '@lib/extensions/express/response';

import loadBalancerResponder from '@lib/responders/load_balancer_responder';
import hardcodedResponseWriter from '@lib/writers/hardcoded_response_writer';
import denyLoopbackAttackMiddlewareLogger from '@lib/loggers/middleware/deny_loopback_attack_middleware_logger';
import * as denyLoopbackAttackMiddlewareMetrics from '@lib/metrics/middleware/deny_loopback_attack_middleware_metrics';

import net from '@mfdlabs/net';
import { NextFunction, Request, Response } from 'express';

export default class DenyLoopbackAttackMiddleware {
  /**
   * Invokes the middleware.
   * @param {Request} request The request object.
   * @param {Response} response The response object.
   * @param {NextFunction} next The next function to call.
   * @returns {void} Nothing.
   */
  public static invoke(request: Request, response: Response, next: NextFunction): void {
    const hostname = request.context.get('hostname') as string;
    const resolvedAddress = request.context.get('resolvedAddress') as string;

    if (this._isConsideredLoopback(resolvedAddress, request.publicIp) && !hardcodedResponseWriter.hasRule(request)) {
      denyLoopbackAttackMiddlewareMetrics.resolvedHostnamesThatWereConsideredLoopback.inc({ hostname: hostname });

      this._handleLoopbackAttack(hostname, resolvedAddress, request, response);
      return;
    }

    if (this._isIp(hostname)) {
      if (this._isConsideredLoopback(hostname, request.publicIp) && !hardcodedResponseWriter.hasRule(request)) {
        denyLoopbackAttackMiddlewareMetrics.resolvedHostnamesThatWereConsideredLoopback.inc({ hostname: hostname });

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
    denyLoopbackAttackMiddlewareLogger.warning(
      "Request to '%s' or '%s' is a loopback, responding with loopback error",
      hostname,
      resolvedAddress,
    );
    request.fireEvent('LoopbackAttack');

    denyLoopbackAttackMiddlewareMetrics.requestsThatWereDenied.inc({
      method: request.method,
      hostname: hostname,
      endpoint: request.path,
      caller: request.ip,
    });

    loadBalancerResponder.sendMessage(
      `Loopback detected from downstream client '${request.ip}' to upstream server '${hostname}'.`,
      request,
      response,
      403
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
