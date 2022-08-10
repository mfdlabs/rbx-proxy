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
    File Name: sphynx_domain_middleware.ts
    Description: This middleware is only invoked if the hostname is the Sphynx domain.
    Written by: Nikita Petko
*/

import '@lib/extensions/express/request';

import logger from '@lib/logger';
import environment from '@lib/environment';
import sphynxServiceRewriteReader from '@lib/proxy/sphynx_service_rewrite_reader';

import { NextFunction, Request, Response } from 'express';

const sphynxDomainLogger = new logger(
  'sphynx-domain-middleware',
  environment.logLevel,
  environment.logToFileSystem,
  environment.logToConsole,
  environment.loggerCutPrefix,
);

export default class SphynxDomainMiddleware {
  /**
   * Invokes the middleware.
   * @param {Request} request The request object.
   * @param {Response} response The response object.
   * @param {NextFunction} next The next function to call.
   * @returns {void} Nothing.
   */
  public static invoke(request: Request, response: Response, next: NextFunction): void {
    const hostname = request.context.get('hostname');

    if (hostname === environment.sphynxDomain) {
      sphynxDomainLogger.information(
        "Request domain is Sphynx's domain. Trying to find hardcoded response or service name rewrite.",
      );
      request.fireEvent('SphynxRequest');

      /* TODO: [RBXPRR-46] Move this harcoded stuff away from just Sphynx */
      const hardcodedResponse = sphynxServiceRewriteReader.getHardcodedResponse(request.method, request.originalUrl);

      if (hardcodedResponse) {
        sphynxDomainLogger.information("Found hardcoded response on path '%s', returning it.", request.originalUrl);
        request.fireEvent('SphynxResponse');

        const body =
          hardcodedResponse.body instanceof Object ? JSON.stringify(hardcodedResponse.body) : hardcodedResponse.body;

        response.header({
          ...hardcodedResponse.headers,

          'content-length': Buffer.byteLength(body).toString(),
          'x-hardcoded-response-template': hardcodedResponse.template.toString(),
        });
        response.contentType(hardcodedResponse.contentType || 'text/html');
        response.status(hardcodedResponse.statusCode);
        response.end(body);

        return;
      }

      sphynxDomainLogger.information('No hardcoded response found, try translate service name.');
      request.fireEvent('SphynxServiceNameTranslation');

      request.originalUrl = sphynxServiceRewriteReader.transformUrl(request.originalUrl);
    }

    next();
  }
}
