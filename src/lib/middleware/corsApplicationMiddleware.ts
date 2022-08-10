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
    File Name: corsApplicationMiddleware.ts
    Description: Applies necessary CORS headers to the response.
    Written by: Nikita Petko
*/

import '@lib/extensions/express/request';

import logger from '@lib/logger';
import environment from '@lib/environment';
import corsWriter from '@lib/proxy/corsWriter';

import { NextFunction, Request, Response } from 'express';

const corsApplicationMiddlewareLogger = new logger(
  'cors-application-middleware',
  environment.logLevel,
  environment.logToFileSystem,
  environment.logToConsole,
  environment.loggerCutPrefix,
);

export default class CorsApplicationMiddleware {
  /**
   * Invokes the middleware.
   * @param {Request} request The request object.
   * @param {Response} response The response object.
   * @param {NextFunction} next The next function to call.
   * @returns {void} Nothing.
   */
  public static invoke(request: Request, response: Response, next: NextFunction): void {
    if (!environment.enableCorsWriter) return next();

    const origin = request.headers.origin;

    // Special request context variable here, on the response handler for the axios middleware, this boolean
    // will determine if that axios response can overwrite these headers if they're present in that response.
    request.context.set('allowCorsHeaderOverwrite', true);

    if (origin || environment.corsApplyHeadersRegardlessOfOriginHeader) {
      corsApplicationMiddlewareLogger.information(
        "Try apply CORs headers to the response with origin '%s'.",
        origin || '<none>',
      );
      request.fireEvent('ApplyCorsHeaders', origin || '<none>');

      request.context.set('allowCorsHeaderOverwrite', this._applyCorsHeaders(origin, request, response));
    }

    next();
  }

  private static _isOriginAllowed(allowedOrigins: (string | RegExp)[], origin: string): boolean {
    for (const allowedOrigin of allowedOrigins as RegExp[]) {
      if (allowedOrigin.test(origin)) return true;
      if (allowedOrigin.toString() === '/^\\*$/') {
        // Replace the /^\*$/ regex with '*'
        allowedOrigins.splice(allowedOrigins.indexOf(allowedOrigin), 1, /^\*$/);
        allowedOrigins.push('*');
        return true;
      }
    }

    return false;
  }
  private static _applyCorsHeaders(origin: string, request: Request, response: Response): boolean {
    const rule = corsWriter.getRule(request);

    if (!rule) return true;

    const allowedOrigins = rule.allowedOrigins as RegExp[];

    if (
      this._isOriginAllowed(allowedOrigins, origin) ||
      rule.allowRequestOriginIfNoAllowedOrigins ||
      environment.corsApplyHeadersRegardlessOfOrigin
    ) {
      if (rule.allowedOrigins.includes('*')) response.setHeader('Access-Control-Allow-Origin', '*');
      else {
        if (origin !== undefined) {
          response.setHeader('Access-Control-Allow-Origin', origin);
        }
      }

      if (rule.allowedHeaders.length > 0)
        response.setHeader('Access-Control-Allow-Headers', rule.allowedHeaders.join(', '));
      if (rule.allowedMethods.length > 0)
        response.setHeader('Access-Control-Allow-Methods', rule.allowedMethods.join(', '));
      if (rule.exposedHeaders.length > 0)
        response.setHeader('Access-Control-Expose-Headers', rule.exposedHeaders.join(', '));
      if (rule.maxAge !== undefined) response.setHeader('Access-Control-Max-Age', rule.maxAge.toString());
      if (rule.allowCredentials) response.setHeader('Access-Control-Allow-Credentials', 'true');

      response.setHeader('Vary', 'Origin');
    }

    return rule.allowResponseHeadersOverwrite;
  }
}
