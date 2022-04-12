import { GlobalEnvironment } from 'Assemblies/Util/GlobalEnvironment';
import { Logger } from 'Assemblies/Util/LoggingUtility';
import { NetworkingUtility } from 'Assemblies/Util/NetworkingUtility';
import { RequestHandler } from 'express-serve-static-core';
export const CrawlerCheckHandler = ((request, response, resumeFunction) => {
    if (!GlobalEnvironment.ShouldCheckCrawler) return resumeFunction();

    if (NetworkingUtility.IsCrawler(request.headers['user-agent'])) {
        Logger.Log(`Crawler detected: '%s'`, request.headers['user-agent']);

        if (GlobalEnvironment.AbortConnectionIfCrawler) {
            response.end();
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
