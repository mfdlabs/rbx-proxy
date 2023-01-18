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
    File Name: metrics_middleware.ts
    Description: This file contains the metrics middleware.
    Written by: <blah blah blah>
*/

import pathEnvironment from '@lib/environment/path_environment';
import metricsMiddlewareLogger from '@lib/loggers/middleware/metrics_middleware_logger';

import net from '@mfdlabs/net';
import * as Prometheus from 'prom-client';
import { NextFunction, Request, Response } from 'express';

export default class MetricsMiddleware {
  /**
   * Invokes the middleware.
   * @param {Request} request The request object.
   * @param {Response} response The response object.
   * @param {NextFunction} next The next function to call.
   * @returns {void} Nothing.
   */
  public static async invoke(request: Request, response: Response, next: NextFunction): Promise<void> {
    if (!pathEnvironment.singleton.useMetricsMiddleware) return next();

    if (request.path.toLowerCase() === pathEnvironment.singleton.metricsPath) {
      const allowedIPv4Addresses = pathEnvironment.singleton.allowedIPv4Addresses;
      const allowedIPv6Addresses = pathEnvironment.singleton.allowedIPv6Addresses;

      if (
        !net.isIPv4InCidrRangeList(request.ip, allowedIPv4Addresses) &&
        !net.isIPv6InCidrRangeList(request.ip, allowedIPv6Addresses)
      ) {
        metricsMiddlewareLogger.warning(`Request from ${request.ip} is not allowed to access the metrics endpoint.`);

        return response.sendMessage(['IP check failed.'], 403);
      }

      metricsMiddlewareLogger.information('Request is a metrics request, responding with prometheus metrics page');

      response.contentType(Prometheus.register.contentType);
      response.send(await Prometheus.register.metrics());
      return;
    }
    next();
  }
}
