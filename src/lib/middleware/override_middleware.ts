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
    File Name: override_middleware.ts
    Description: This is the first middleware in the chain. It overrides the response.end method so that it can send the response to the client with lowercase headers.
    Written by: Nikita Petko
*/

import { NextFunction, Request, Response } from 'express';

export default class OverrideMiddleware {
  /**
   * Invokes the middleware.
   * @param {Request} request The request object.
   * @param {Response} response The response object.
   * @param {NextFunction} next The next function to call.
   * @returns {void} Nothing.
   */
  public static invoke(request: Request, response: Response, next: NextFunction): void {
    const oldEnd = response.end;

    Object.defineProperty(response, 'end', {
      writable: true,
      value(this: Response, ...args: any[]) {
        response.getHeaderNames().forEach((headerName: string) => {
          const headerValue = response.getHeader(headerName);
          response.removeHeader(headerName);
          response.setHeader(headerName.toLowerCase(), headerValue);
        });

        // Apply connection: close header if it was not set by the user.
        if (!response.getHeader('connection')) {
          response.setHeader('connection', 'close');
        }

        response.setHeader('date', new Date().toUTCString());

        // Clear request context.
        request.context.clear();

        oldEnd.apply(this, args);
      },
    });

    next();
  }
}
