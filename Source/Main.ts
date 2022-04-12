import { ImportHandler } from './ImportHandler';
ImportHandler();

import Application, { NextFunction, Request, Response } from 'express';
import { LoggingHandler } from './Assemblies/Middleware/Logger';
import { StandardInHandler } from './StandardInHandler';
import { SystemSDK } from 'Assemblies/Setup/Lib/SystemSDK';
import { __baseDirName } from 'Assemblies/Directories';
import { LBInfoHandler } from 'Assemblies/Handlers/LBInfoHandler';
import { NetworkingUtility } from 'Assemblies/Util/NetworkingUtility';
import { DotENV } from 'Assemblies/Util/DotENV';
import { CidrCheckHandler } from 'Assemblies/Middleware/CidrCheck';
import { CrawlerCheckHandler } from 'Assemblies/Middleware/CrawlerCheck';

DotENV.GlobalConfigure();

const sharedSettings = {
    UseSsl: true,
    UseInsecure: true,
    InsecurePort: 80,
    SslPort: 443,
    UseSslDirectoryName: true,
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

    let routes = NetworkingUtility.GetRouteTable();
    
    for (let _ of routes) {
    }

    SystemSDK.SetBaseRoutesPath('Routes');

    SystemSDK.ConfigureServer(SystemSDK.MetadataBuilder(ProxyServer, 'Proxy', '127.0.0.1'));

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

    SystemSDK.StartServer({
        Application: ProxyServer,
        SiteName: '0.0.0.0',
        ...sharedSettings,
    });

    SystemSDK.StartServer({
        Application: ProxyServer,
        SiteName: '::',
        ...sharedSettings,
    });
})();

StandardInHandler();
