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
    File Name: wanAddressApplicationMiddleware.ts
    Description: A middleware that sets the WAN address of the request. The WAN address is only initialized once, but the property is applied to the request object every time the middleware is called.
    Written by: Nikita Petko
*/

import '@lib/extensions/express/request';

import logger from '@lib/utility/logger';
import environment from '@lib/environment';

import net from '@mfdlabs/net';
import { NextFunction, Request, Response } from 'express';

let publicIp: string;

export default class WanAddressApplicationMiddleware {
  /**
   * Invokes the middleware.
   * @param {Request} request The request object.
   * @param {Response} response The response object.
   * @param {NextFunction} next The next function to call.
   * @returns {void} Nothing.
   */
  public static async invoke(request: Request, response: Response, next: NextFunction): Promise<void> {
    if (publicIp === undefined) {
      publicIp = await net.getPublicIP();

      logger.information("Public IP Initialized as '%s'", publicIp);

      if (!environment.ga4DisableLoggingIPs)
        /* This may be cause controversy */
        request.fireEvent('PublicIPInitalized');
    }

    if (!request.hasOwnProperty('publicIp')) {
      Object.defineProperty(request, 'publicIp', {
        configurable: false,
        enumerable: true,
        get: () => publicIp,
      });
    }

    next();
  }
}
