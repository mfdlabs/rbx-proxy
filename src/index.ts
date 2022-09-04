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

import './import_handler';
import './stdin_handler';

import dotenvLoader from '@lib/environment/dotenv_loader';
dotenvLoader.reloadEnvironment();

import googleAnalytics from '@lib/utility/google_analytics';
googleAnalytics.initialize();

////////////////////////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////////////////////////
// Primary Declarations
////////////////////////////////////////////////////////////////////////////////////////////////////

import web from '@lib/setup';
import logger from '@lib/logger';
import environment from '@lib/environment';

////////////////////////////////////////////////////////////////////////////////////////////////////
// Type Declarations
////////////////////////////////////////////////////////////////////////////////////////////////////

import startupOptions from '@lib/setup/options/startup_options';

////////////////////////////////////////////////////////////////////////////////////////////////////
// Middleware
////////////////////////////////////////////////////////////////////////////////////////////////////

import errorMiddleware from '@lib/middleware/error_middleware';
import loggingMiddleware from '@lib/middleware/logging_middleware';
import overrideMiddleware from '@lib/middleware/override_middleware';
import cidrCheckMiddleware from '@lib/middleware/cidr_check_middleware';
import beginTimingMiddleware from '@lib/middleware/begin_timing_middleware';
import healthCheckMiddleware from '@lib/middleware/health_check_middleware';
import sphynxDomainMiddleware from '@lib/middleware/sphynx_domain_middleware';
import crawlerCheckMiddleware from '@lib/middleware/crawler_check_middleware';
import reverseProxyMiddleware from '@lib/middleware/reverse_proxy_middleware';
import corsApplicationMiddleware from '@lib/middleware/cors_application_middleware';
import sendAxiosRequestMiddleware from '@lib/middleware/send_axios_request_middleware';
import loadBalancerInfoMiddleware from '@lib/middleware/load_balancer_info_middleware';
import denyLoopbackAttackMiddleware from '@lib/middleware/deny_loopback_attack_middleware';
import hostnameResolutionMiddleware from '@lib/middleware/hostname_resolution_middleware';
import wanAddressApplicationMiddleware from '@lib/middleware/wan_address_application_middleware';
import denyLocalAreaNetworkAccessMiddleware from '@lib/middleware/deny_local_area_network_access_middleware';

////////////////////////////////////////////////////////////////////////////////////////////////////
// Third Party Declarations
////////////////////////////////////////////////////////////////////////////////////////////////////

import * as fs from 'fs';
import * as path from 'path';
import express from 'express';
import * as bodyParser from 'body-parser';

Error.stackTraceLimit = Infinity;

const entrypointLogger = new logger(
  'entrypoint',
  environment.logLevel,
  environment.logToFileSystem,
  environment.logToConsole,
  environment.loggerCutPrefix,
);

// We want to try and not hard code these values.
// In the future we should have an environment variable for the passphrase
// and maybe the certificate stuff as well.
const settings = {} as startupOptions;

googleAnalytics.fireServerEventGA4('Server', 'Start');

const proxyServer = express();

// Make sure it uses body-parser.raw() to parse the body as a Buffer.
proxyServer.use(
  bodyParser.raw({
    inflate: true,
    limit: '5Gb',
    type: () => true,
  }),
);

////////////////////////////////////////////////////////////////////////////////////////////////////
// Middleware
////////////////////////////////////////////////////////////////////////////////////////////////////

// Note: For middleware, please make it a lambda then invoke it, as this will make it so it doesn't capture
// Express's function context and cause the `this` keyword to be either undefined or not have the correct
// members.

entrypointLogger.information('Loading middleware...');

proxyServer.use(overrideMiddleware.invoke.bind(overrideMiddleware));
proxyServer.use(reverseProxyMiddleware.invoke.bind(reverseProxyMiddleware));
proxyServer.use(loggingMiddleware.invoke.bind(loggingMiddleware));
proxyServer.use(cidrCheckMiddleware.invoke.bind(cidrCheckMiddleware));
proxyServer.use(crawlerCheckMiddleware.invoke.bind(crawlerCheckMiddleware));
proxyServer.use(loadBalancerInfoMiddleware.invoke.bind(loadBalancerInfoMiddleware));
proxyServer.use(healthCheckMiddleware.invoke.bind(healthCheckMiddleware));
proxyServer.use(beginTimingMiddleware.invoke.bind(beginTimingMiddleware));
proxyServer.use(wanAddressApplicationMiddleware.invoke.bind(wanAddressApplicationMiddleware));
proxyServer.use(hostnameResolutionMiddleware.invoke.bind(hostnameResolutionMiddleware));
proxyServer.use(denyLocalAreaNetworkAccessMiddleware.invoke.bind(denyLocalAreaNetworkAccessMiddleware));
proxyServer.use(denyLoopbackAttackMiddleware.invoke.bind(denyLoopbackAttackMiddleware));
proxyServer.use(corsApplicationMiddleware.invoke.bind(corsApplicationMiddleware));
proxyServer.use(sphynxDomainMiddleware.invoke.bind(sphynxDomainMiddleware));
proxyServer.use(sendAxiosRequestMiddleware.invoke.bind(sendAxiosRequestMiddleware));

////////////////////////////////////////////////////////////////////////////////////////////////////

if (environment.logStartupInfo) {
  const setupLogger = new logger(
    'setup',
    environment.logLevel,
    environment.logToFileSystem,
    environment.logToConsole,
    environment.loggerCutPrefix,
  );
  web.overrideLoggers(
    setupLogger.information.bind(setupLogger),
    setupLogger.warning.bind(setupLogger),
    setupLogger.debug.bind(setupLogger),
    setupLogger.error.bind(setupLogger),
  );
}

web.configureServer({
  app: proxyServer,
  noETag: true,
  noXPowerBy: true,
  rawBufferRequest: false,
  routingOptions: {
    caseSensitive: true, // We want to be case sensitive for our routes, so that /a and /A are different
    strict: true, // We want /a and /a/ to be treated as different routes
  },
  trustProxy: false,
});

proxyServer.use(errorMiddleware.invoke.bind(errorMiddleware));

////////////////////////////////////////////////////////////////////////////////////////////////////
// Settings
////////////////////////////////////////////////////////////////////////////////////////////////////

if (environment.enableSecureServer) {
  entrypointLogger.information('Loading TLS settings...');

  if (environment.enableTLSv2) {
    entrypointLogger.information('TLSv2 is enabled.');
    settings.tlsV2 = true;
  }
  settings.tls = true;
  settings.tlsPort = environment.securePort;

  if (!fs.existsSync(environment.sslBaseDirectory)) {
    entrypointLogger.error(
      'The SSL base directory does not exist. Please make sure it exists and is readable. Path: %s',
      environment.sslBaseDirectory,
    );
    throw new Error(`The SSL base directory "${environment.sslBaseDirectory}" does not exist.`);
  }

  const fullyQualifiedCertificatePath = path.join(environment.sslBaseDirectory, environment.sslCertificateFileName);
  const fullyQualifiedKeyPath = path.join(environment.sslBaseDirectory, environment.sslKeyFileName);

  if (!fs.existsSync(fullyQualifiedCertificatePath)) {
    entrypointLogger.error(
      'The SSL certificate file does not exist. Please make sure it exists and is readable. Path: %s',
      fullyQualifiedCertificatePath,
    );
    throw new Error(`The SSL certificate file "${fullyQualifiedCertificatePath}" does not exist.`);
  }

  if (!fs.existsSync(fullyQualifiedKeyPath)) {
    entrypointLogger.error(
      'The SSL key file does not exist. Please make sure it exists and is readable. Path: %s',
      fullyQualifiedKeyPath,
    );
    throw new Error(`The SSL key file "${fullyQualifiedKeyPath}" does not exist.`);
  }

  settings.baseTlsDirectory = environment.sslBaseDirectory;
  settings.cert = environment.sslCertificateFileName;
  settings.key = environment.sslKeyFileName;

  if (environment.sslKeyPassphrase !== null) {
    entrypointLogger.information('TLS key passphrase is enabled.');
    settings.passphrase = environment.sslKeyPassphrase;
  }

  if (environment.sslCertificateChainFileName !== null) {
    entrypointLogger.information('TLS certificate chain is enabled.');
    const fullyQualifiedCertificateChainPath = path.join(
      environment.sslBaseDirectory,
      environment.sslCertificateChainFileName,
    );

    if (!fs.existsSync(fullyQualifiedCertificateChainPath)) {
      entrypointLogger.error(
        'The SSL certificate chain file does not exist. Please make sure it exists and is readable. Path: %s',
        fullyQualifiedCertificateChainPath,
      );
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

// This is a temporary fix for the issue where the server is not able to start when
// running in a Docker container on IPv6.
if (!environment.disableIPv6 && !environment.isDocker()) {
  entrypointLogger.information('Starting IPv6 server...');
  settings.bind = environment.bindAddressIPv6;
  web.startServer({
    app: proxyServer,
    ...settings,
  });
}
