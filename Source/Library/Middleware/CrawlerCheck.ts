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
    File Name: CrawlerCheck.ts
    Description: This handler will check if the request User-Agent is a crawler.
                 Like CIDR check, you can make it abort the request if it is a crawler.
    Written by: Nikita Petko
*/

import { Logger } from 'Library/Util/Logger';
import { GlobalEnvironment } from 'Library/Util/GlobalEnvironment';
import { NetworkingUtility } from 'Library/Util/NetworkingUtility';

import { RequestHandler } from 'express';

export const CrawlerCheckHandler = ((request, response, resumeFunction) => {
    if (!GlobalEnvironment.ShouldCheckCrawler) return resumeFunction();

    if (NetworkingUtility.IsCrawler(request.headers['user-agent'])) {
        Logger.Log(`Crawler detected: '%s'`, request.headers['user-agent']);

        if (GlobalEnvironment.AbortConnectionIfCrawler) {
            request.socket.destroy();
            return;
        }

        response
            .status(403)
            .header({
                'Content-Type': 'text/html',
                Pragma: 'no-cache',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                Expires: '0',
                Connection: 'close',
            })
            .send(
                `<html><body><h1>403 Forbidden</h1><p>Crawlers are not allowed to access this site. Please use a browser instead.</p></body></html>`,
            );
        return;
    }

    resumeFunction();
}) as RequestHandler;
