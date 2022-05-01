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
    File Name: Main.ts
    Description: The main entry point for the application.
    Written by: Nikita Petko
*/

import { ImportHandler } from './ImportHandler';
ImportHandler();

import { DotENV } from 'Library/Util/DotENV';
DotENV.Load();

import Application, { NextFunction, Request, Response } from 'express';
import { LoggingHandler } from './Library/Middleware/Logger';
import { StandardInHandler } from './StandardInHandler';
import web from 'Library/Setup/Lib/WebHelper';
import { __baseDirName, __sslDirName } from 'Library/Directories';
import { LBInfoHandler } from 'Library/Handlers/LBInfoHandler';
import { WebUtility } from 'Library/Util/WebUtility';
import { CidrCheckHandler } from 'Library/Middleware/CidrCheck';
import { CrawlerCheckHandler } from 'Library/Middleware/CrawlerCheck';
import { GoogleAnalyticsHelper } from 'Library/Util/GoogleAnalyticsHelper';
import { Logger } from 'Library/Util/Logger';

import * as path from 'path';

GoogleAnalyticsHelper.Initialize();

const sharedSettings = {
    tls: true,
    insecure: true,
    insecurePort: 80,
    tlsPort: 443,
    cert: 'mfdlabs-all-authority-roblox-local.crt',
    key: 'mfdlabs-all-authority-roblox-local.key',
    passphrase: 'testing123',
    chain: 'mfdlabs-root-ca-roblox.crt',
    baseTlsDirectory: __sslDirName
};

(async () => {
    GoogleAnalyticsHelper.FireServerEventGA4('Server', 'Start');

    const ProxyServer = Application();

    // Access logs
    ProxyServer.use(LoggingHandler);
    ProxyServer.use(CidrCheckHandler);
    ProxyServer.use(CrawlerCheckHandler);
    ProxyServer.use((_, response, next) => {
        LBInfoHandler.Invoke(response, false, false, false);

        next();
    });

    web.overrideLoggers(Logger.Info, Logger.Warn, Logger.Debug, Logger.Error);
    web.overrideRootProjectPath(path.join(__baseDirName, 'Bin'));
    web.overrideBaseRoutesPath('Routes');

    web.configureServer({
        Application: ProxyServer,
        AllowRoutes: true,
        RouteConfiguration: {
            routesPath: web.getRoutesDirectory('Proxy'),
            logSetup: true,
            debugName: 'rbx-proxy.lb.vmminfra.net',
        },
        TrustProxy: false,
        NoXPoweredBy: true,
        NoETag: true,
        RawBufferRequest: true,
    });

    ProxyServer.use((request, response) => {
        // Not found handler
        // Shows a 404 page, but in the case of the "proxy" it will show 503
        // No cache and close the connection
        GoogleAnalyticsHelper.FireServerEventGA4('Server', 'NotFound', request.url);

        response
            .status(503)
            .header({
                Pragma: 'no-cache',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                Expires: '0',
                Connection: 'close',
            })
            .send(
                `<html><body><h1>503 Service Unavailable</h1><p>No upstream server for downstream route: ${request.url}</p></body></html>`,
            );
    });

    ProxyServer.use((error: Error, request: Request, response: Response, _next: NextFunction) => {
        // HTML encode the error stack
        const errorStack = WebUtility.HtmlEncode(error.stack);

        // Log the error
        GoogleAnalyticsHelper.FireServerEventGA4('Server', 'Error', errorStack);

        response
            .status(500)
            .header({
                Pragma: 'no-cache',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                Expires: '0',
                Connection: 'close',
            })
            .send(
                `<html><body><h1>500 Internal Server Error</h1><p>An error occurred when sending a request to the downstream route: ${request.url}</p><p><b>${errorStack}</b></p></body></html>`,
            );
    });

    web.startServer({
        app: ProxyServer,
        bind: '0.0.0.0',
        ...sharedSettings,
    });

    web.startServer({
        app: ProxyServer,
        bind: '::',
        ...sharedSettings,
    });
})();

StandardInHandler();
