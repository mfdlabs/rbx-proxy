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
import { WebHelper } from 'Library/Setup/Lib/WebHelper';
import { __baseDirName } from 'Library/Directories';
import { LBInfoHandler } from 'Library/Handlers/LBInfoHandler';
import { NetworkingUtility } from 'Library/Util/NetworkingUtility';
import { CidrCheckHandler } from 'Library/Middleware/CidrCheck';
import { CrawlerCheckHandler } from 'Library/Middleware/CrawlerCheck';

const sharedSettings = {
    UseSsl: true,
    UseInsecure: true,
    InsecurePort: 80,
    SslPort: 443,
    UseSslDirectory: true,
    CertificateFileName: 'mfdlabs-all-authority-roblox-local.crt',
    CertificateKeyFileName: 'mfdlabs-all-authority-roblox-local.key',
    CertificateKeyPassword: 'testing123',
    RootCertificateFileName: 'mfdlabs-root-ca-roblox.crt',
};

(async () => {
    const ProxyServer = Application();

    // Access logs
    ProxyServer.use(LoggingHandler);
    ProxyServer.use(CidrCheckHandler);
    ProxyServer.use(CrawlerCheckHandler);
    ProxyServer.use((_, response, next) => {
        LBInfoHandler.Invoke(response, false, false, false);

        next();
    });

    WebHelper.SetBaseRoutesPath('Routes');

    WebHelper.ConfigureServer({
        Application: ProxyServer,
        AllowRoutes: true,
        RouteConfiguration: {
            RouteStorePath: WebHelper.GetRoutesDirectory('Proxy'),
            LogRouteSetup: true,
            SiteName: 'rbx-proxy.lb.vmminfra.net',
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
        const errorStack = NetworkingUtility.HtmlEncode(error.stack);

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

    WebHelper.StartServer({
        Application: ProxyServer,
        Hostname: '0.0.0.0',
        ...sharedSettings,
    });

    WebHelper.StartServer({
        Application: ProxyServer,
        Hostname: '::',
        ...sharedSettings,
    });
})();

StandardInHandler();
