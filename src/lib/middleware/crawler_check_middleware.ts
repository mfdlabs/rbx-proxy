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
    File Name: crawler_check_middleware.ts
    Description: This handler will check if the request User-Agent is a crawler.
                 Like CIDR check, you can make it abort the request if it is a crawler.
    Written by: Nikita Petko
*/

import '@lib/extensions/express/response';

import webUtility from '@lib/utility/web_utility';
import crawlerEnvironment from '@lib/environment/crawler_environment';
import loadBalancerResponder from '@lib/responders/load_balancer_responder';
import crawlerCheckMiddlewareLogger from '@lib/loggers/middleware/crawler_check_middleware_logger';
import * as crawlerCheckMiddlewareMetrics from '@lib/metrics/middleware/crawler_check_middleware_metrics';

import { NextFunction, Request, Response } from 'express';

export default class CrawlerCheckMiddleware {
  /**
   * Invokes the middleware.
   * @param {Request} request The request object.
   * @param {Response} response The response object.
   * @param {NextFunction} next The next function to call.
   * @returns {void} Nothing.
   */
  public static invoke(request: Request, response: Response, next: NextFunction): void {
    if (!crawlerEnvironment.singleton.shouldCheckCrawler) return next();

    if (webUtility.isCrawler(request.headers['user-agent'])) {
      crawlerCheckMiddlewareLogger.log("Crawler detected: '%s'", request.headers['user-agent']);

      crawlerCheckMiddlewareMetrics.callersThatAreCrawlers.inc({ caller: request.ip, user_agent: request.headers['user-agent'] });

      if (crawlerEnvironment.singleton.abortConnectionIfCrawler) {
        request.socket.destroy();
        return;
      }

      loadBalancerResponder.sendMessage(
        'Crawlers are not allowed to access this site. Please use a browser instead.',
        request,
        response,
        403,
      );

      return;
    }

    next();
  }
}
