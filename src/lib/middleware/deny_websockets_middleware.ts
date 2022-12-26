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
    File Name: deny_websockets_middleware.ts
    Description: Denies websockets if enabled.
    Written by: Nikita Petko
*/

import '@lib/extensions/express/request';
import '@lib/extensions/express/response';

import loadBalancerResponder from '@lib/responders/load_balancer_responder';
import denyWebsocketsMiddlewareLogger from '@lib/loggers/middleware/deny_websockets_middleware_logger';
import * as denyWebsocketsMiddlewareMetrics from '@lib/metrics/middleware/deny_websockets_middleware_metrics';

import { NextFunction, Request, Response } from 'express';

export default class DenyWebsocketsMiddleware {
  /**
   * Invokes the middleware.
   * @param {Request} request The request object.
   * @param {Response} response The response object.
   * @param {NextFunction} next The next function to call.
   * @returns {void} Nothing.
   */
  public static invoke(request: Request, response: Response, next: NextFunction): void {
    if (!this._isWebsocket(request)) return next();

    denyWebsocketsMiddlewareLogger.warning(
      "Request to '%s' is asking for a websocket connection, but called on a server that doesn't support websockets.",
      request.url,
    );
    request.fireEvent('websocketsDenied');

    denyWebsocketsMiddlewareMetrics.requestsThatWereWebsockets.inc({
      method: request.method,
      hostname: request.hostname,
      endpoint: request.path,
      caller: request.ip,
    });

    loadBalancerResponder.sendMessage(
      'Websockets are not supported on this server.',
      request,
      response,
      403,
    );
  }

  private static _isWebsocket(request: Request): boolean {
    return !!request.headers.upgrade && request.headers.upgrade.toLowerCase() === 'websocket';
  }
}
