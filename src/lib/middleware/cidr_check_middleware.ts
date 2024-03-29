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
    File Name: cidr_check_middleware.ts
    Description: This middleware will check if the request IP address is within an IPv4 or IPv6 CIDR range.
                 By default it will show a 403 Forbidden response if the IP address is not in the range,
                 but you can set it to abort the request instead.
    Written by: Nikita Petko
*/

import ipCheckEnvironment from '@lib/environment/ip_check_environment';
import cidrCheckMiddlewareLogger from '@lib/loggers/middleware/cidr_check_middleware_logger';
import * as cidrCheckMiddlewareMetrics from '@lib/metrics/middleware/cidr_check_middleware_metrics';

import net from '@mfdlabs/net';
import { NextFunction, Request, Response } from 'express';

export default class CidrCheckMiddleware {
  /**
   * Invokes the middleware.
   * @param {Request} request The request object.
   * @param {Response} response The response object.
   * @param {NextFunction} next The next function to call.
   * @returns {void} Nothing.
   */
  public static invoke(request: Request, response: Response, next: NextFunction): void {
    if (!ipCheckEnvironment.singleton.shouldCheckIP) return next();

    const allowedIPv4Cidrs = ipCheckEnvironment.singleton.allowedIPv4Cidrs;
    const allowedIPv6Cidrs = ipCheckEnvironment.singleton.allowedIPv6Cidrs;

    if (
      !net.isIPv4InCidrRangeList(request.ip, allowedIPv4Cidrs) &&
      !net.isIPv6InCidrRangeList(request.ip, allowedIPv6Cidrs)
    ) {
      cidrCheckMiddlewareLogger.log("IP '%s' is not in allowed CIDR list", request.ip);

      allowedIPv4Cidrs.forEach((cidr) => {
        cidrCheckMiddlewareMetrics.ipsNotInCidrRange.inc({ cidr, ip: request.ip });
      });
      allowedIPv6Cidrs.forEach((cidr) => {
        cidrCheckMiddlewareMetrics.ipsNotInCidrRange.inc({ cidr, ip: request.ip });
      });

      if (ipCheckEnvironment.singleton.abortConnectionIfInvalidIP) {
        request.socket.destroy();
        return;
      }

      response.sendMessage(['IP Address validation failed.'], 403);

      return;
    }

    next();
  }
}
