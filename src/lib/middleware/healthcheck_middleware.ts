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
    File Name: health_check_middleware.ts
    Description: A middleware that will check the health of the server.
    Written by: Nikita Petko
*/

import pathEnvironment from '@lib/environment/path_environment';
import loadBalancerResponder from '@lib/responders/load_balancer_responder';
import loadBalancerInfoResponder from '@lib/responders/load_balancer_info_responder';
import healthcheckMiddlewareLogger from '@lib/loggers/middleware/healthcheck_middleware_logger';
import * as healthcheckMiddlewareMetrics from '@lib/metrics/middleware/healthcheck_middleware_metrics';

import net from '@mfdlabs/net';
import { NextFunction, Request, Response } from 'express';

export default class HealthcheckMiddleware {
  /**
   * Invokes the middleware.
   * @param {Request} request The request object.
   * @param {Response} response The response object.
   * @param {NextFunction} next The next function to call.
   * @returns {void} Nothing.
   */
  public static invoke(request: Request, response: Response, next: NextFunction): void {
    if (!pathEnvironment.singleton.useHealthcheckMiddleware) return next();

    if (request.path.toLowerCase() === pathEnvironment.singleton.healthcheckPath) {
      const allowedIPv4Addresses = pathEnvironment.singleton.allowedIPv4Addresses;
      const allowedIPv6Addresses = pathEnvironment.singleton.allowedIPv6Addresses;

      if (
        !net.isIPv4InCidrRangeList(request.ip, allowedIPv4Addresses) &&
        !net.isIPv6InCidrRangeList(request.ip, allowedIPv6Addresses)
      ) {
        healthcheckMiddlewareLogger.warning(
          `Request from ${request.ip} is not allowed to access the metrics endpoint.`,
        );

        return loadBalancerResponder.sendMessage('IP check failed.', request, response, 403);
      }

      healthcheckMiddlewareLogger.information('Request is a health check request, responding with health check page');

      loadBalancerInfoResponder.invoke(response, true, true, true);

      healthcheckMiddlewareMetrics.healthChecks.inc({ caller: request.ip });

      return;
    }
    next();
  }
}
