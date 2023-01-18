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
    Description: This is the first middleware in the chain. 
                 It overrides the response.end method so that it can send the response to the client with lowercase headers.
    Written by: Nikita Petko
*/

import addRequestExtensionMethods from '@lib/extensions/express/request';
import addResponseExtensionMethods from '@lib/extensions/express/response';

import * as overrideMiddlewareMetrics from '@lib/metrics/middleware/override_middleware_metrics';

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
    addRequestExtensionMethods(request);
    addResponseExtensionMethods(response);

    try {
      const oldEnd = response.end;

      const start = Date.now();

      Object.defineProperty(response, 'end', {
        writable: true,
        value(this: Response, ...args: any[]) {
          OverrideMiddleware._shuffleArray(this.getHeaderNames()).forEach((headerName: string) => {
            const headerValue = this.getHeader(headerName);
            this.removeHeader(headerName);
            this.setHeader(headerName.toLowerCase(), headerValue);
          });

          // Apply connection: close header if it was not set by the user.
          if (!this.getHeader('connection')) {
            this.append('connection', 'close');
          }

          this.append('date', new Date().toUTCString());

          // Clear request context.
          request.context.clear();

          overrideMiddlewareMetrics.responseTimeHistogram
            .labels(
              request.method,
              request.headers.host || 'No Host Header',
              request.path,
              this.statusCode.toString(),
              request.ip,
            )
            .observe((Date.now() - start) / 1000);

          oldEnd.apply(this, args);
        },
      });

      // Transform all request headers to lowercase.
      request.headers = Object.fromEntries(
        Object.entries(request.headers).map(([key, value]) => [key.toLowerCase(), value]),
      );

      next();
    } catch (error) {
      next(error);
    }
  }

  private static _shuffleArray(array: string[]): string[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }

    return array;
  }
}
