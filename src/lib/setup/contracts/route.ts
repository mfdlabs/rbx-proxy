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
    File Name: route.ts
    Description: Represents an interface to implement for any routes.
    Written by: Nikita Petko
*/

////////////////////////////////////////////////////////////////////////////////
// Type imports.
////////////////////////////////////////////////////////////////////////////////

import { RoutingMethod } from '../custom_types/routing_method';

////////////////////////////////////////////////////////////////////////////////
// Third-party imports.
////////////////////////////////////////////////////////////////////////////////

import { NextFunction, Request, Response } from 'express';

/**
 * Represents an interface to implement for any routes.
 */
export default interface Route {
  /**
   * The method to use for the route.
   */
  requestMethod: RoutingMethod;

  /**
   * A callback function to be called when the route is invoked.
   * @param {Request} request The request object.
   * @param {Response} response The response object.
   * @param {NextFunction} next The next handler to be called.
   * @returns {any} This can return anything but will most likey be a promise.
   */
  invoke(request: Request, response: Response, next: NextFunction): unknown;

  // eslint-disable-next-line semi
}
