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
    File Name: WebHelper.ts
    Description: This class is a helper for configuring the web server.
    Written by: Nikita Petko
*/

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Imports
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

import { Logger } from 'Library/Util/Logger';
import { IRoute } from 'Library/Setup/Interfaces/IRoute';
import { Walkers } from 'Library/Setup/Walkers';
import { IStartupOptions } from 'Library/Setup/Interfaces/IStartupOptions';
import { IRouteSetupOptions } from 'Library/Setup/Interfaces/IRouteSetupOptions';
import { RouteCallbackDelegate } from 'Library/Setup/Interfaces/RouteCallbackDelegate';
import { IConfigurationOptions } from 'Library/Setup/Interfaces/IConfigurationOptions';
import { __baseDirName, __sslDirName } from 'Library/Directories';

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Third Party Imports
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

import SslV2 from 'spdy';
import { join as PathJoin } from 'path';
import { Server as InsecureServer } from 'http';
import SslV1, { Server as SslServer, ServerOptions } from 'https';
import { raw as ParseRequestAsBuffer } from 'body-parser';
import { Express, Request, Response, NextFunction, Router } from 'express';
import { readFileSync as ReadFile, existsSync as FileOrDirectoryExists } from 'fs';

/**
 * A helper class for configuring the web server.
 *
 * This is abstract so that it can't be instantiated.
 */
export abstract class WebHelper {
    private static BaseRoutesPath: string = 'Routes';

    /**
     * Replaces the current file routes base path.
     *
     * The default is 'Routes'.
     * @param {string} path The new base path.
     */
    public static SetBaseRoutesPath(path: string): void {
        WebHelper.BaseRoutesPath = path;
    }

    /**
     * Configures the web server.
     * @param {IConfigurationOptions} options The configuration options.
     */
    public static ConfigureServer(options: IConfigurationOptions): void {
        try {
            if (options.TrustProxy) options.Application.enable('trust proxy');
            if (options.NoXPoweredBy) options.Application.disable('x-powered-by');
            if (options.NoETag) options.Application.disable('etag');

            if (options.RawBufferRequest)
                // Allow the request body to be parsed as a buffer, max size of 5gb, any content type and inflate the request body.
                options.Application.use(
                    ParseRequestAsBuffer({
                        inflate: true,
                        limit: '5Gb',
                        type: () => true,
                    }),
                );

            options.Application.use(Router(options.RoutingOpts));

            if (options.AllowRoutes) WebHelper.MapRoutesInternal(options.Application, options.RouteConfiguration);
        } catch (e) {
            Logger.Error(`Error occurred when configuring a site! Stack: %s`, e.stack);
        }
    }

    /**
     * Gets the fully qualified path of the routes directory.
     * @param {string} routeDirectory The route directory.
     * @returns {string} The fully qualified path of the routes directory.
     */
    public static GetRoutesDirectory(routeDirectory: string): string {
        return PathJoin(__baseDirName, 'Bin', WebHelper.BaseRoutesPath, routeDirectory);
    }

    /**
     * Starts either a secure or insecure web server. Or both.
     * @param {IStartupOptions} options The startup options.
     * @returns {void} Nothing.
     */
    public static StartServer(options: IStartupOptions): [InsecureServer, SslServer] {
        try {
            options.SslPort = options.SslPort ?? 443;
            options.InsecurePort = options.InsecurePort ?? 80;
            options.UseInsecure = options.UseInsecure ?? true;
            options.UseSsl = options.UseSsl ?? false;
            options.Hostname = options.Hostname ?? '::';

            /* Has Certificate */
            let sslServer: SslServer;

            /* Has No Certificate */
            let insecureServer: InsecureServer;

            if (options.UseSsl) {
                const certPath = options.UseSslDirectory
                    ? PathJoin(__sslDirName, options.CertificateFileName)
                    : options.CertificateFileName;

                if (!FileOrDirectoryExists(certPath)) throw new Error(`The certificate file '${certPath}' does not exist!`);

                const keyPath = options.UseSslDirectory
                    ? PathJoin(__sslDirName, options.CertificateKeyFileName)
                    : options.CertificateKeyFileName;

                if (!FileOrDirectoryExists(keyPath)) throw new Error(`The certificate key file '${keyPath}' does not exist!`);

                let rootCaPath = options.UseSslDirectory
                    ? PathJoin(__sslDirName, options.RootCertificateFileName)
                    : options.RootCertificateFileName;

                if (options.RootCertificateFileName && !FileOrDirectoryExists(rootCaPath))
                    throw new Error(`The root certificate file '${rootCaPath}' does not exist!`);

                const sslConfiguration: ServerOptions = {
                    cert: ReadFile(certPath, 'utf8'),
                    key: ReadFile(keyPath, 'utf8'),
                };

                if (options.RootCertificateFileName) sslConfiguration.ca = [ReadFile(rootCaPath, 'utf8')];
                if (options.CertificateKeyPassword) sslConfiguration.passphrase = options.CertificateKeyPassword;

                sslServer = (options.UseSslV2 ? SslV2 : SslV1)
                    .createServer(sslConfiguration, options.Application)
                    .listen(options.SslPort, options.Hostname, () =>
                        Logger.Info(`SSL Server '%s' started on port %d.`, options.Hostname, options.SslPort),
                    );
            }
            if (options.UseInsecure)
                insecureServer = options.Application.listen(options.InsecurePort, options.Hostname, () =>
                    Logger.Info(`Insecure Server '%s' started on port %d.`, options.Hostname, options.InsecurePort),
                );
            return [insecureServer, sslServer];
        } catch (err) {
            // Determine if it was because we didn't have permissions to listen on the port.
            if (err.code === 'EACCES') {
                Logger.Error(`The server '%s' could not listen on port %d.`, options.Hostname, options.InsecurePort);
                return [null, null];
            }

            // Determine if it was because we didn't have permissions to listen on the address.
            if (err.code === 'EADDRINUSE') {
                Logger.Error(`The server '%s' could not listen on address '%s'.`, options.Hostname, options.Hostname);
                return [null, null];
            }

            Logger.Error(`Error occurred when starting a server! Stack: %s`, err.stack);
            return [null, null];
        }
    }

    private static MapRoutesInternal(application?: Express, options?: IRouteSetupOptions): void {
        const directory =
            options && options.RouteStorePath ? options.RouteStorePath : PathJoin(__baseDirName, 'Bin', WebHelper.BaseRoutesPath);

        if (!FileOrDirectoryExists(directory)) {
            Logger.Warn(
                `The directory '%s' for the site '%s' was not found, make sure you configured your directory correctly.`,
                directory,
                options.SiteName,
            );
            return;
        }
        const files = Walkers.WalkDirectory(directory).filter((file) => file.match(/\.js$/));
        files.forEach((file) => {
            // Just in case the file is a directory.
            if (!file.match(/\.js$/)) return;

            let route: IRoute;

            try {
                route = require(file);
            } catch (error) {
                return Logger.Error(
                    "An error occurred when requiring the route file '%s' for the site '%s'. Stack: %s",
                    file,
                    options.SiteName,
                    error.stack,
                );
            }

            if (!route) {
                Logger.Warn("The route file '%s' for the site '%s' had no default export.", file, options.SiteName);
                return;
            }

            const routeCallback: RouteCallbackDelegate = route.Callback;
            if (!routeCallback || typeof routeCallback !== 'function') {
                Logger.Warn("The route file '%s' for the site '%s' did not have a valid callback function.", file, options.SiteName);
                return;
            }

            let allowedMethod = (route.RequestMethod ?? 'all').toLowerCase();

            const RejectionWrappedCallback = (request: Request, response: Response, next: NextFunction) => {
                try {
                    const result = routeCallback(request, response, next);
                    if (result instanceof Promise) {
                        result.catch(next);
                    }
                } catch (error) {
                    next(error);
                }
            };

            const path = file
                .replace(/\.js/i, '')
                .replace(/_P-/g, ':')
                .replace(/__pageIndex__/gi, '/')
                .replace(directory, '')
                .replace(/\\/g, '/')
                .toLowerCase();

            const isMiddleware = /__all/gi.test(path);

            if (isMiddleware && allowedMethod !== 'all') allowedMethod = 'all';

            const fqp = (options.SiteName !== undefined ? `http://${options.SiteName}` : 'http://localhost') + path;

            switch (allowedMethod) {
                case 'get':
                    if (options.LogRouteSetup) Logger.Debug(`Mapping 'GET' '%s' for site '%s'`, fqp, options.SiteName);
                    application.get(path, RejectionWrappedCallback);
                    break;
                case 'head':
                    if (options.LogRouteSetup) Logger.Debug(`Mapping 'HEAD' '%s' for site '%s'`, fqp, options.SiteName);
                    application.head(path, RejectionWrappedCallback);
                    break;
                case 'post':
                    if (options.LogRouteSetup) Logger.Debug(`Mapping 'POST' '%s' for site '%s'`, fqp, options.SiteName);
                    application.post(path, RejectionWrappedCallback);
                    break;
                case 'put':
                    if (options.LogRouteSetup) Logger.Debug(`Mapping 'PUT' '%s' for site '%s'`, fqp, options.SiteName);
                    application.put(path, RejectionWrappedCallback);
                    break;
                case 'patch':
                    if (options.LogRouteSetup) Logger.Debug(`Mapping 'PATCH' '%s' for site '%s'`, fqp, options.SiteName);
                    application.patch(path, RejectionWrappedCallback);
                    break;
                case 'delete':
                    if (options.LogRouteSetup) Logger.Debug(`Mapping 'DELETE' '%s' for site '%s'`, fqp, options.SiteName);
                    application.delete(path, RejectionWrappedCallback);
                    break;
                case 'options':
                    if (options.LogRouteSetup) Logger.Debug(`Mapping 'OPTIONS' '%s' for site '%s'`, fqp, options.SiteName);
                    application.options(path, RejectionWrappedCallback);
                    break;
                case 'all':
                    if (isMiddleware) {
                        if (options.LogRouteSetup) Logger.Debug(`Mapping 'ALL ROUTES' for site '%s'`, options.SiteName);
                        application.use(RejectionWrappedCallback);
                        break;
                    }

                    if (options.LogRouteSetup) Logger.Debug(`Mapping 'ALL' '%s' for site '%s'`, fqp, options.SiteName);
                    application.all(path, RejectionWrappedCallback);
                    break;
                default:
                    Logger.Warn(
                        `The route file '%s' for the site '%s' had an invalid request method '%s'.`,
                        file,
                        options.SiteName,
                        allowedMethod,
                    );
                    break;
            }
        });

        if (options.LogRouteSetup) Logger.Info(`The site '%s' has %d route(s)`, options.SiteName, files.length);
    }
}
