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
    File Name: load_balancer_info_middleware.ts
    Description: This middleware will check respond with the load balancer information in the headers.
    Written by: Nikita Petko
*/

import * as npm from '@lib/utility/npm_utility';

import * as os from 'os';
import { NextFunction, Request, Response } from 'express';

const { name, version } = npm.readPackageJson();

export default class LoadBalancerInfoMiddleware {
  /**
   * Invokes the middleware.
   * @param {Request} _request The request object.
   * @param {Response} response The response object.
   * @param {NextFunction} next The next function to call.
   * @returns {void} Nothing.
   */
  public static invoke(_request: Request, response: Response, next: NextFunction): void {
    response.header({
      server: `${name} v${version}`,
      'x-powered-by': `${name} v${version}`,
      'x-machine-id': os.hostname(),
    });

    next();
  }
}
