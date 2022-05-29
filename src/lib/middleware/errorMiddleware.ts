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
    File Name: errorMiddleware.ts
    Description: A middleware that handles errors.
    Written by: Nikita Petko
*/

import '@lib/extensions/express/response';

import googleAnalytics from '@lib/utility/googleAnalytics';

import htmlEncode from 'escape-html';
import { NextFunction, Request, Response } from 'express';

export default class ErrorMiddleware {
  /**
   * Invokes the middleware.
   * @param {Request} request The request object.
   * @param {Response} response The response object.
   * @param {NextFunction} next The next function to call.
   * @returns {void} Nothing.
   */
  public static invoke(error: Error, request: Request, response: Response, next: NextFunction): void {
    const errorStack = htmlEncode(error instanceof Error ? error.stack : 'Unknown error')
      .replace(/\n/g, '<br>')
      .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
      .replace(/ /g, '&nbsp;');
    const encodedUri = htmlEncode(`${request.protocol}://${request.hostname}${request.originalUrl}`);

    // Log the error
    googleAnalytics.fireServerEventGA4('Server', 'Error', error?.stack ?? 'Unknown error');

    response.noCache();
    response.contentType('text/html');
    response.status(500);
    response.send(
      `<html><body><h1>500 Internal Server Error</h1><p>An error occurred when sending a request to the upstream URI: ${encodedUri}</p><p><b>${errorStack}</b></p></body></html>`,
    );
  }
}
