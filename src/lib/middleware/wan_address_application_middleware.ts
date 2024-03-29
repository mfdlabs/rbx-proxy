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
    File Name: wan_address_application_middleware.ts
    Description: A middleware that sets the WAN address of the request. 
                 The WAN address is only initialized once, 
                 but the property is applied to the request object every time the middleware is called.
    Written by: Nikita Petko
*/

import dns from '@lib/dns';
import ga4Environment from '@lib/environment/ga4_environment';
import wanAddressApplicationMiddlewareLogger from '@lib/loggers/middleware/wan_address_application_middleware_logger';
import * as wanAddressApplicationMiddlewareMetrics from '@lib/metrics/middleware/wan_address_application_middleware_metrics';

import { NextFunction, Request, Response } from 'express';

let wanIp: string;

const dnsClient = new dns([
  'resolver1.opendns.com',
  'resolver2.opendns.com',
  'resolver3.opendns.com',
  'resolver4.opendns.com',
]);

export default class WanAddressApplicationMiddleware {
  /**
   * Invokes the middleware.
   * @param {Request} request The request object.
   * @param {Response} response The response object.
   * @param {NextFunction} next The next function to call.
   * @returns {void} Nothing.
   */
  public static async invoke(request: Request, _response: Response, next: NextFunction): Promise<void> {
    if (wanIp === undefined) {
      wanIp = await this._getWanIp();

      wanAddressApplicationMiddlewareLogger.information("Public IP Initialized as '%s'", wanIp);

      if (!ga4Environment.singleton.ga4DisableLoggingIPs)
        /* This may be cause controversy */
        request.fireEvent('PublicIPInitalized');
    }

    if (!request.hasOwnProperty('publicIp')) {
      Object.defineProperty(request, 'publicIp', {
        configurable: false,
        enumerable: true,
        get: () => wanIp,
      });

      wanAddressApplicationMiddlewareMetrics.wanAddressGuage.set({ ip: wanIp }, 1);
    }

    next();
  }

  private static async _getWanIp(): Promise<string> {
    if (wanIp !== undefined) return wanIp;

    const addresses = await dnsClient.resolve('myip.opendns.com');

    return addresses.pop()?.value;
  }
}
