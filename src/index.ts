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

////////////////////////////////////////////////////////////////////////////////////////////////////
// Top Level Declarations
////////////////////////////////////////////////////////////////////////////////////////////////////

import importHandler from './importHandler';
importHandler();

import stdinHandler from './stdinHandler';
stdinHandler();

import dotenvLoader from 'lib/utility/dotenvLoader';
dotenvLoader.reloadEnvironment();

import googleAnalytics from 'lib/utility/googleAnalytics';
googleAnalytics.initialize();

////////////////////////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////////////////////////
// Primary Declarations
////////////////////////////////////////////////////////////////////////////////////////////////////

import web from 'lib/setup';
import logger from 'lib/utility/logger';
import webUtility from 'lib/utility/webUtility';
import environment from 'lib/utility/environment';
import { projectDirectoryName } from 'lib/directories';

////////////////////////////////////////////////////////////////////////////////////////////////////
// Middleware
////////////////////////////////////////////////////////////////////////////////////////////////////
import loggingMiddleware from './lib/middleware/loggingMiddleware';
import cidrCheckMiddleware from 'lib/middleware/cidrCheckMiddleware';
import crawlerCheckMiddleware from 'lib/middleware/crawlerCheckMiddleware';
import loadBalancerInfoMiddleware from 'lib/middleware/loadBalancerInfoMiddleware';

////////////////////////////////////////////////////////////////////////////////////////////////////
// Third Party Declarations
////////////////////////////////////////////////////////////////////////////////////////////////////

import * as path from 'path';
import express, { NextFunction, Request, Response } from 'express';


const sharedSettings = {
  baseTlsDirectory: path.join(projectDirectoryName, 'ssl'),
  cert: 'mfdlabs-all-authority-roblox-local.crt',
  chain: 'mfdlabs-root-ca-roblox.crt',
  insecure: true,
  insecurePort: 80,
  key: 'mfdlabs-all-authority-roblox-local.key',
  passphrase: 'testing123',
  tls: true,
  tlsPort: 443,
};

(async () => {
  googleAnalytics.fireServerEventMetricsProtocol('Server', 'Start');

  const proxyServer = express();

  ////////////////////////////////////////////////////////////////////////////////////////////////////
  // Middleware
  ////////////////////////////////////////////////////////////////////////////////////////////////////

  proxyServer.use(loggingMiddleware.invoke);
  proxyServer.use(cidrCheckMiddleware.invoke);
  proxyServer.use(crawlerCheckMiddleware.invoke);
  proxyServer.use(loadBalancerInfoMiddleware.invoke);

  ////////////////////////////////////////////////////////////////////////////////////////////////////

  if (environment.logStartupInfo) web.overrideLoggers(logger.information, logger.warning, logger.debug, logger.error);

  web.overrideRootProjectPath(path.join(projectDirectoryName, 'lib'));
  web.overrideBaseRoutesPath('routes');

  web.configureServer({
    allowRoutes: true,
    app: proxyServer,
    noETag: true,
    noXPowerBy: true,
    rawBufferRequest: true,
    routeConfiguration: {
      debugName: 'rbx-proxy.lb.vmminfra.net',
      logSetup: true,
      routesPath: web.getRoutesDirectory('proxy'),
    },
    trustProxy: false,
  });

  proxyServer.use((request, response) => {
    // Not found handler
    // Shows a 404 page, but in the case of the "proxy" it will show 503
    // No cache and close the connection
    googleAnalytics.fireServerEventMetricsProtocol('Server', 'NotFound', request.url);

    response
      .status(503)
      .header({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Connection: 'close',
        Expires: '0',
        Pragma: 'no-cache',
      })
      .send(
        `<html><body><h1>503 Service Unavailable</h1><p>No upstream server for downstream route: ${request.url}</p></body></html>`,
      );
  });

  proxyServer.use((error: Error, request: Request, response: Response, _next: NextFunction) => {
    // HTML encode the error stack
    const errorStack = webUtility.htmlEncode(error.stack);

    // Log the error
    googleAnalytics.fireServerEventMetricsProtocol('Server', 'Error', errorStack);

    response
      .status(500)
      .header({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Connection: 'close',
        Expires: '0',
        Pragma: 'no-cache',
      })
      .send(
        `<html><body><h1>500 Internal Server Error</h1><p>An error occurred when sending a request to the downstream route: ${request.url}</p><p><b>${errorStack}</b></p></body></html>`,
      );
  });

  web.startServer({
    app: proxyServer,
    bind: '0.0.0.0',
    ...sharedSettings,
  });

  web.startServer({
    app: proxyServer,
    bind: '::',
    ...sharedSettings,
  });
})();
