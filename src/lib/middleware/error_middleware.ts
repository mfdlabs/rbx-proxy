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
    File Name: error_middleware.ts
    Description: A middleware that handles errors.
    Written by: Nikita Petko
*/

import '@lib/extensions/express/response';

import googleAnalytics from '@lib/utility/google_analytics';
import sentryEnvironment from '@lib/environment/sentry_environment';
import loadBalancerResponder from '@lib/responders/load_balancer_responder';
import errorMiddlewareLogger from '@lib/loggers/middleware/error_middleware_logger';
import * as errorMiddlewareMetrics from '@lib/metrics/middleware/error_middleware_metrics';

import * as Sentry from '@sentry/node';
import { NextFunction, Request, Response } from 'express';

export default class ErrorMiddleware {
  /**
   * Invokes the middleware.
   * @param {Error} error The error object.
   * @param {Request} request The request object.
   * @param {Response} response The response object.
   * @param {NextFunction} _next The next function to call.
   * @returns {void} Nothing.
   */
  public static invoke(error: Error, request: Request, response: Response, _next: NextFunction): void {
    const errorStack = error instanceof Error ? error.stack : 'Unknown error';
    const uri = `${request.protocol}://${request.hostname}${request.originalUrl}`;

    errorMiddlewareLogger.error(
      'An error occurred while processing a request on URI %s://%s:%d%s (%s): %s',
      request.protocol,
      request.hostname,
      request.socket.localPort,
      request.path,
      request.ip,
      errorStack,
    );

    errorMiddlewareMetrics.errorCounter.inc({
      method: request.method,
      hostname: request.headers.host || 'No Host Header',
      endpoint: request.path,
      caller: request.ip,
    });

    // Log the error
    googleAnalytics.fireServerEventGA4('Server', 'Error', errorStack);

    if (sentryEnvironment.singleton.sentryEnabled) Sentry.captureException(error);

    loadBalancerResponder.sendMessage(
      `An error occurred when sending a request to the upstream URI: ${uri}`,
      request,
      response,
      500,
      undefined,
      true,
      undefined,
      [[true, errorStack]],
    );
  }
}
