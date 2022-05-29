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
import environment from '@lib/environment';

////////////////////////////////////////////////////////////////////////////////////////////////////
// Type Declarations
////////////////////////////////////////////////////////////////////////////////////////////////////

import startupOptions from '@lib/setup/options/startupOptions';

////////////////////////////////////////////////////////////////////////////////////////////////////
// Middleware
////////////////////////////////////////////////////////////////////////////////////////////////////

import errorMiddleware from '@lib/middleware/errorMiddleware';
import loggingMiddleware from '@lib/middleware/loggingMiddleware';
import notFoundMiddleware from '@lib/middleware/notFoundMiddleware';
import overrideMiddleware from '@lib/middleware/overrideMiddleware';
import cidrCheckMiddleware from '@lib/middleware/cidrCheckMiddleware';
import beginTimingMiddleware from '@lib/middleware/beginTimingMiddleware';
import healthCheckMiddleware from '@lib/middleware/healthCheckMiddleware';
import sphynxDomainMiddleware from '@lib/middleware/sphynxDomainMiddleware';
import crawlerCheckMiddleware from '@lib/middleware/crawlerCheckMiddleware';
import reverseProxyMiddleware from '@lib/middleware/reverseProxyMiddleware';
import corsApplicationMiddleware from '@lib/middleware/corsApplicationMiddleware';
import sendAxiosRequestMiddleware from '@lib/middleware/sendAxiosRequestMiddleware';
import loadBalancerInfoMiddleware from '@lib/middleware/loadBalancerInfoMiddleware';
import denyLoopbackAttackMiddleware from '@lib/middleware/denyLoopbackAttackMiddleware';
import hostnameResolutionMiddleware from '@lib/middleware/hostnameResolutionMiddleware';
import wanAddressApplicationMiddleware from '@lib/middleware/wanAddressApplicationMiddleware';
import denyLocalAreaNetworkAccessMiddleware from '@lib/middleware/denyLocalAreaNetworkAccessMiddleware';

////////////////////////////////////////////////////////////////////////////////////////////////////
// Third Party Declarations
////////////////////////////////////////////////////////////////////////////////////////////////////

import * as fs from 'fs';
import * as path from 'path';
import express from 'express';

// RBXPRR-2 RBXPRR-3:
// We want to try and not hard code these values.
// In the future we should have an environment variable for the passphrase
// and maybe the certificate stuff as well.
const settings = {} as startupOptions;

googleAnalytics.fireServerEventGA4('Server', 'Start');

const proxyServer = express();

////////////////////////////////////////////////////////////////////////////////////////////////////
// Middleware
////////////////////////////////////////////////////////////////////////////////////////////////////

// Note: For middleware, please make it a lambda then invoke it, as this will make it so it doesn't capture
// Express's function context and cause the `this` keyword to be either undefined or not have the correct
// members.

proxyServer.use((request, response, next) => overrideMiddleware.invoke(request, response, next));
proxyServer.use((request, response, next) => reverseProxyMiddleware.invoke(request, response, next));
proxyServer.use((request, response, next) => loggingMiddleware.invoke(request, response, next));
proxyServer.use((request, response, next) => cidrCheckMiddleware.invoke(request, response, next));
proxyServer.use((request, response, next) => crawlerCheckMiddleware.invoke(request, response, next));
proxyServer.use((request, response, next) => loadBalancerInfoMiddleware.invoke(request, response, next));
proxyServer.use((request, response, next) => healthCheckMiddleware.invoke(request, response, next));
proxyServer.use((request, response, next) => beginTimingMiddleware.invoke(request, response, next));
proxyServer.use((request, response, next) => wanAddressApplicationMiddleware.invoke(request, response, next));
proxyServer.use((request, response, next) => hostnameResolutionMiddleware.invoke(request, response, next));
proxyServer.use((request, response, next) => denyLocalAreaNetworkAccessMiddleware.invoke(request, response, next));
proxyServer.use((request, response, next) => denyLoopbackAttackMiddleware.invoke(request, response, next));
proxyServer.use((request, response, next) => corsApplicationMiddleware.invoke(request, response, next));
proxyServer.use((request, response, next) => sphynxDomainMiddleware.invoke(request, response, next));
proxyServer.use((request, response, next) => sendAxiosRequestMiddleware.invoke(request, response, next));

////////////////////////////////////////////////////////////////////////////////////////////////////

if (environment.logStartupInfo) web.overrideLoggers(logger.information, logger.warning, logger.debug, logger.error);

web.configureServer({
  app: proxyServer,
  noETag: true,
  noXPowerBy: true,
  rawBufferRequest: true,
  routingOptions: {
    caseSensitive: true, // We want to be case sensitive for our routes, so that /a and /A are different
    strict: true, // We want /a and /a/ to be treated as different routes
  },
  trustProxy: false,
});

proxyServer.use((request, response, next) => notFoundMiddleware.invoke(request, response, next));
proxyServer.use((error, request, response, next) => errorMiddleware.invoke(error, request, response, next));

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
