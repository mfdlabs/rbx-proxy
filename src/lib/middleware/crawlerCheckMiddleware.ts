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
    File Name: crawlerCheckMiddleware.ts
    Description: This handler will check if the request User-Agent is a crawler.
                 Like CIDR check, you can make it abort the request if it is a crawler.
    Written by: Nikita Petko
*/

import '@lib/extensions/express/response';

import logger from '@lib/utility/logger';
import environment from '@lib/environment';
import webUtility from '@lib/utility/webUtility';

import { NextFunction, Request, Response } from 'express';

class CrawlerCheckMiddleware {
  /**
   * Invokes the middleware.
   * @param {Request} request The request object.
   * @param {Response} response The response object.
   * @param {NextFunction} next The next function to call.
   * @returns {void} Nothing.
   */
  public static invoke(request: Request, response: Response, next: NextFunction): void {
    if (!environment.shouldCheckCrawler) return next();

    if (webUtility.isCrawler(request.headers['user-agent'])) {
      logger.log(`Crawler detected: '%s'`, request.headers['user-agent']);

      if (environment.abortConnectionIfCrawler) {
        request.socket.destroy();
        return;
      }

      response.noCache();
      response.contentType('text/html');
      response.status(403);
      response.send(
        `<html><body><h1>403 Forbidden</h1><p>Crawlers are not allowed to access this site. Please use a browser instead.</p></body></html>`,
      );
      return;
    }

    next();
  }
}

export = CrawlerCheckMiddleware;
