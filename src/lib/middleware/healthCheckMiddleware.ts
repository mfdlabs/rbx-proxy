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
    File Name: healthCheckMiddleware.ts
    Description: A middleware that will check the health of the server.
    Written by: Nikita Petko
*/

import logger from '@lib/logger';
import environment from '@lib/environment';
import loadBalancerInfoResponder from '@lib/responders/loadBalancerInfoResponder';

import { NextFunction, Request, Response } from 'express';

const healthCheckLogger = new logger(
  'health-check-middleware',
  environment.logLevel,
  environment.logToFileSystem,
  environment.logToConsole,
  environment.loggerCutPrefix,
);

export default class HealthCheckMiddleware {
  /**
   * Invokes the middleware.
   * @param {Request} request The request object.
   * @param {Response} response The response object.
   * @param {NextFunction} next The next function to call.
   * @returns {void} Nothing.
   */
  public static invoke(request: Request, response: Response, next: NextFunction): void {
    if (!environment.useHealthCheckMiddleware) return next();

    if (request.originalUrl.toLowerCase() === environment.healthCheckPath) {
      healthCheckLogger.information('Request is a health check request, responding with health check page');

      loadBalancerInfoResponder.invoke(response, true, true, true);
      return;
    }
    next();
  }
}
