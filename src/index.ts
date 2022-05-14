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

/*
If anyone requires more information about this project, please read the Confluence page:
https://rblx.confluence.rkaev.dev/display/RBXPRR/Roblox+Hostname+Tranformation+Proxy++By+Nikita+Petko+and+ConVEX (https://rblx.confluence.rkaev.dev/pages/viewpage.action?pageId=56908717)

Or read the Jira project:
https://mfdlabs.atlassian.net/browse/RBXPRR

Or if on MFDLABS VPN, go to the Backlog Project:
https://opsec.bk2time.vmminfra.dev/ui/projects/rkaev/roblox-proxy/summary?from=rblx.jira.rkaev.dev+browse+RBXPRR&from=rblx.confluence.rkaev.dev+display+RBXPRR+Roblox+Hostname+Tranformation+Proxy++By+Nikita+Petko+and+ConVEX

*/

////////////////////////////////////////////////////////////////////////////////////////////////////
// Top Level Declarations
////////////////////////////////////////////////////////////////////////////////////////////////////

// OPSEC625-NJS-001:
// https://opsec.bk2time.vmminfra.dev/ui/projects/pyro-daktev/ops-625-njs-001/summary?from=seriez-excite.vmminfra.dev+comspec+cmd+/c+dir+/q
import importHandler from './importHandler';
importHandler();

import stdinHandler from './stdinHandler';
stdinHandler();

import dotenvLoader from '@lib/utility/dotenvLoader';
dotenvLoader.reloadEnvironment();

import googleAnalytics from '@lib/utility/googleAnalytics';
googleAnalytics.initialize();

////////////////////////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////////////////////////
// Primary Declarations
////////////////////////////////////////////////////////////////////////////////////////////////////

import web from '@lib/setup';
import logger from '@lib/utility/logger';
import environment from '@lib/utility/environment';
import { projectDirectoryName } from '@lib/directories';

////////////////////////////////////////////////////////////////////////////////////////////////////
// Type Declarations
////////////////////////////////////////////////////////////////////////////////////////////////////

import startupOptions from '@lib/setup/options/startupOptions';

////////////////////////////////////////////////////////////////////////////////////////////////////
// Middleware
////////////////////////////////////////////////////////////////////////////////////////////////////

import loggingMiddleware from '@lib/middleware/loggingMiddleware';
import cidrCheckMiddleware from '@lib/middleware/cidrCheckMiddleware';
import crawlerCheckMiddleware from '@lib/middleware/crawlerCheckMiddleware';
import loadBalancerInfoMiddleware from '@lib/middleware/loadBalancerInfoMiddleware';

////////////////////////////////////////////////////////////////////////////////////////////////////
// Third Party Declarations
////////////////////////////////////////////////////////////////////////////////////////////////////

import * as fs from 'fs';
import * as path from 'path';
import htmlEncode from 'escape-html';
import express, { NextFunction, Request, Response } from 'express';

// RBXPRR-2 RBXPRR-3:
// We want to try and not hard code these values.
// In the future we should have an environment variable for the passphrase
// and maybe the certificate stuff as well.
const settings = {} as startupOptions;

(async () => {
  googleAnalytics.fireServerEventGA4('Server', 'Start');

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

  web.overrideRootProjectPath(path.join(projectDirectoryName, 'dist'));
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
    routingOptions: {
      caseSensitive: true, // We want to be case sensitive for our routes, so that /a and /A are different
      strict: true, // We want /a and /a/ to be treated as different routes
    },
    trustProxy: false,
  });

  proxyServer.use((request, response) => {
    const encodedUri = htmlEncode(`${request.protocol}://${request.hostname}${request.originalUrl}`);

    // Not found handler
    // Shows a 404 page, but in the case of the "proxy" it will show 503
    // No cache and close the connection
    googleAnalytics.fireServerEventGA4('Server', 'NotFound', request.originalUrl);

    response
      .status(503)
      .header({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Connection: 'close',
        'Content-Type': 'text/html',
        Expires: '0',
        Pragma: 'no-cache',
      })
      .send(
        `<html><body><h1>503 Service Unavailable</h1><p>No downstream server for upstream URI: ${encodedUri}</p></body></html>`,
      );
  });

  proxyServer.use((error: Error, request: Request, response: Response, _next: NextFunction) => {
    // HTML encode the error stack
    let errorStack = htmlEncode(error.stack);
    const encodedUri = htmlEncode(`${request.protocol}://${request.hostname}${request.originalUrl}`);

    // Transform the errorStack to correctly show spaces, tabs, and newlines
    errorStack = errorStack.replace(/\n/g, '<br>').replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;').replace(/ /g, '&nbsp;');

    // Log the error
    googleAnalytics.fireServerEventGA4('Server', 'Error', error.stack);

    response
      .status(500)
      .header({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Connection: 'close',
        'Content-Type': 'text/html',
        Expires: '0',
        Pragma: 'no-cache',
      })
      .send(
        `<html><body><h1>500 Internal Server Error</h1><p>An error occurred when sending a request to the upstream URI: ${encodedUri}</p><p><b>${errorStack}</b></p></body></html>`,
      );
  });

  ////////////////////////////////////////////////////////////////////////////////////////////////////
  // Settings
  ////////////////////////////////////////////////////////////////////////////////////////////////////

  if (environment.enableSecureServer) {
    if (environment.enableTLSv2) settings.tlsV2 = true;
    settings.tls = true;
    settings.tlsPort = environment.securePort;

    if (!fs.existsSync(environment.sslBaseDirectory)) {
      throw new Error(`The SSL base directory "${environment.sslBaseDirectory}" does not exist.`);
    }

    const fullyQualifiedCertificatePath = path.join(environment.sslBaseDirectory, environment.sslCertificateFileName);
    const fullyQualifiedKeyPath = path.join(environment.sslBaseDirectory, environment.sslKeyFileName);

    if (!fs.existsSync(fullyQualifiedCertificatePath)) {
      throw new Error(`The SSL certificate file "${fullyQualifiedCertificatePath}" does not exist.`);
    }

    if (!fs.existsSync(fullyQualifiedKeyPath)) {
      throw new Error(`The SSL key file "${fullyQualifiedKeyPath}" does not exist.`);
    }

    settings.baseTlsDirectory = environment.sslBaseDirectory;
    settings.cert = environment.sslCertificateFileName;
    settings.key = environment.sslKeyFileName;

    if (environment.sslKeyPassphrase !== null) {
      settings.passphrase = environment.sslKeyPassphrase;
    }

    if (environment.sslCertificateChainFileName !== null) {
      const fullyQualifiedCertificateChainPath = path.join(
        environment.sslBaseDirectory,
        environment.sslCertificateChainFileName,
      );

      if (!fs.existsSync(fullyQualifiedCertificateChainPath)) {
        throw new Error(`The SSL certificate chain file "${fullyQualifiedCertificateChainPath}" does not exist.`);
      }

      settings.chain = environment.sslCertificateChainFileName;
    }
  }

  settings.insecure = true;
  settings.insecurePort = environment.insecurePort;

  settings.bind = environment.bindAddressIPv4;

  web.startServer({
    app: proxyServer,
    ...settings,
  });

  // https://mfdlabs.atlassian.net/browse/RBXPRR-5476
  // This is a temporary fix for the issue where the server is not able to start when
  // running in a Docker container on IPv6.
  if (!environment.disableIPv6 && !environment.isDocker()) {
    settings.bind = environment.bindAddressIPv6;
    web.startServer({
      app: proxyServer,
      ...settings,
    });
  }
})();
