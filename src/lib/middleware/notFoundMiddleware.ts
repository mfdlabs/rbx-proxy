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
    File Name: notFoundMiddleware.ts
    Description: Middleware to handle not found requests.
    Written by: Nikita Petko
*/

import '@lib/extensions/express/response';

import googleAnalytics from '@lib/utility/googleAnalytics';

import htmlEncode from 'escape-html';
import { NextFunction, Request, Response } from 'express';

export default class NotFoundMiddleware {
  /**
   * Invokes the middleware.
   * @param {Request} request The request object.
   * @param {Response} response The response object.
   * @param {NextFunction} next The next function to call.
   * @returns {void} Nothing.
   */
  public static invoke(request: Request, response: Response, next: NextFunction): void {
    const encodedUri = htmlEncode(`${request.protocol}://${request.hostname}${request.originalUrl}`);

    // Not found handler
    // Shows a 404 page, but in the case of the "proxy" it will show 503
    // No cache and close the connection
    googleAnalytics.fireServerEventGA4('Server', 'NotFound', request.originalUrl);

    response.noCache();
    response.contentType('text/html');
    response.status(503);
    response.send(
      `<html><body><h1>503 Service Unavailable</h1><p>No downstream server for upstream URI: ${encodedUri}</p></body></html>`,
    );
  }
}
