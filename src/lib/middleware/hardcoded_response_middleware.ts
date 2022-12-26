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
    File Name: hardcoded_response_middleware.ts
    Description: This middleware will return a hardcoded response if the request matches a rule.
    Written by: Nikita Petko
*/

import '@lib/extensions/express/request';

import hardcodedResponseWriter from '@lib/writers/hardcoded_response_writer';
import hardcodedResponseMiddlewareLogger from '@lib/loggers/middleware/hardcoded_response_middleware_logger';
import * as hardcodedResponseMiddlewareMetrics from '@lib/metrics/middleware/hardcoded_response_middleware_metrics';

import { NextFunction, Request, Response } from 'express';

export default class HardcodedResponseMiddleware {
  /**
   * Invokes the middleware.
   * @param {Request} request The request object.
   * @param {Response} response The response object.
   * @param {NextFunction} next The next function to call.
   * @returns {void} Nothing.
   */
  public static invoke(request: Request, response: Response, next: NextFunction): void {
    const hardcodedResponse = hardcodedResponseWriter.getRule(request);

    if (hardcodedResponse) {
      hardcodedResponseMiddlewareLogger.information("Found hardcoded response on path '%s', returning it.", request.path);
      request.fireEvent('HardcodedResponse');

      hardcodedResponseMiddlewareMetrics.hardcodedResponses.inc({
        method: request.method,
        hostname: request.headers.host || 'No Host Header',
        endpoint: request.path,
        template: hardcodedResponse.routeTemplate.toString(),
        caller: request.ip,
      });

      response.header({
        ...hardcodedResponse.headers,

        'x-hardcoded-response-template': hardcodedResponse.routeTemplate.toString(),
      });
      response.status(hardcodedResponse.statusCode);

      if (hardcodedResponse.body !== undefined && hardcodedResponse.body !== null && hardcodedResponse.body !== '') {
        const body =
          hardcodedResponse.body instanceof Object ? JSON.stringify(hardcodedResponse.body) : hardcodedResponse.body;

        response.header('content-length', Buffer.byteLength(body as string).toString());
        response.end(body);
      } else response.end();

      return;
    }

    next();
  }
}
