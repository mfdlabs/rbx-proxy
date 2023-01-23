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

import 'source-map-support/register';

// eslint-disable-next-line @typescript-eslint/no-var-requires
new (require('prom-client').Gauge)({
  name: 'server_info',
  help: 'Information about the server.',
  labelNames: ['hostname', 'app_name', 'version', 'node_version', 'platform', 'architecture', 'environment'],
}).set(
  {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    hostname: require('os').hostname(),

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    app_name: require('../package.json').name,

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    version: `v${require('../package.json').version}`,

    environment: process.env.NODE_ENV || 'development',

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    node_version: require('process').version,

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    platform: require('os').platform(),

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    architecture: require('os').arch(),
  },
  1,
);

import './import_handler';
import './stdin_handler';

import '@lib/environment/register';

import dotenvLoader from '@lib/environment/dotenv_loader';
dotenvLoader.reloadEnvironment();

import googleAnalytics from '@lib/utility/google_analytics';
googleAnalytics.initialize();

////////////////////////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////////////////////////
// Primary Declarations
////////////////////////////////////////////////////////////////////////////////////////////////////

import web from '@lib/setup';
import setupLogger from '@lib/loggers/setup_logger';
import webEnvironment from '@lib/environment/web_environment';
import entrypointLogger from '@lib/loggers/entrypoint_logger';
import sentryEnvironment from '@lib/environment/sentry_environment';

////////////////////////////////////////////////////////////////////////////////////////////////////
// Type Declarations
////////////////////////////////////////////////////////////////////////////////////////////////////

import startupOptions from '@lib/setup/options/startup_options';

////////////////////////////////////////////////////////////////////////////////////////////////////
// Middleware
////////////////////////////////////////////////////////////////////////////////////////////////////

import errorMiddleware from '@lib/middleware/error_middleware';
import configMiddleware from '@lib/middleware/config_middleware';
import loggingMiddleware from '@lib/middleware/logging_middleware';
import metricsMiddleware from '@lib/middleware/metrics_middleware';
import overrideMiddleware from '@lib/middleware/override_middleware';
import cidrCheckMiddleware from '@lib/middleware/cidr_check_middleware';
import healthcheckMiddleware from '@lib/middleware/healthcheck_middleware';
import crawlerCheckMiddleware from '@lib/middleware/crawler_check_middleware';
import reverseProxyMiddleware from '@lib/middleware/reverse_proxy_middleware';
import testExceptionMiddleware from '@lib/middleware/test_exception_middleware';
import corsApplicationMiddleware from '@lib/middleware/cors_application_middleware';
import sendAxiosRequestMiddleware from '@lib/middleware/send_axios_request_middleware';
import loadBalancerInfoMiddleware from '@lib/middleware/load_balancer_info_middleware';
import hardcodedResponseMiddleware from '@lib/middleware/hardcoded_response_middleware';
import hostnameResolutionMiddleware from '@lib/middleware/hostname_resolution_middleware';
import denyLoopbackAttackMiddleware from '@lib/middleware/deny_loopback_attack_middleware';
import wanAddressApplicationMiddleware from '@lib/middleware/wan_address_application_middleware';
import denyLocalAreaNetworkAccessMiddleware from '@lib/middleware/deny_local_area_network_access_middleware';

////////////////////////////////////////////////////////////////////////////////////////////////////
// Third Party Declarations
////////////////////////////////////////////////////////////////////////////////////////////////////

import * as fs from 'fs';
import * as path from 'path';
import express from 'express';
import * as Sentry from '@sentry/node';
import * as bodyParser from 'body-parser';
import * as Prometheus from 'prom-client';
import * as Tracing from '@sentry/tracing';
import environment from '@mfdlabs/environment';

Error.stackTraceLimit = Infinity;

// We want to try and not hard code these values.
// In the future we should have an environment variable for the passphrase
// and maybe the certificate stuff as well.
const settings = {} as startupOptions;

googleAnalytics.fireServerEventGA4('Server', 'Start');

const proxyServer = express();

if (sentryEnvironment.singleton.sentryEnabled) {
  entrypointLogger.debug('Sentry enabled, using %s as DSN.', sentryEnvironment.singleton.sentryClientDsn);

  Sentry.init({
    dsn: sentryEnvironment.singleton.sentryClientDsn,
    attachStacktrace: true,
    tracesSampleRate: 1.0,
    sampleRate: 1.0,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),

      new Tracing.Integrations.Express({
        app: proxyServer,
      }),
    ],
  });

  Tracing.addExtensionMethods();
}

Prometheus.collectDefaultMetrics({ register: Prometheus.register });

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

if (sentryEnvironment.singleton.sentryEnabled) {
  proxyServer.use(Sentry.Handlers.requestHandler());
  proxyServer.use(Sentry.Handlers.tracingHandler());
}

proxyServer.use(overrideMiddleware.invoke.bind(overrideMiddleware));
proxyServer.use(reverseProxyMiddleware.invoke.bind(reverseProxyMiddleware));
proxyServer.use(loggingMiddleware.invoke.bind(loggingMiddleware));
proxyServer.use(cidrCheckMiddleware.invoke.bind(cidrCheckMiddleware));
proxyServer.use(crawlerCheckMiddleware.invoke.bind(crawlerCheckMiddleware));
proxyServer.use(loadBalancerInfoMiddleware.invoke.bind(loadBalancerInfoMiddleware));
proxyServer.use(metricsMiddleware.invoke.bind(metricsMiddleware));
proxyServer.use(configMiddleware.invoke.bind(configMiddleware));
proxyServer.use(testExceptionMiddleware.invoke.bind(testExceptionMiddleware));
proxyServer.use(healthcheckMiddleware.invoke.bind(healthcheckMiddleware));
proxyServer.use(wanAddressApplicationMiddleware.invoke.bind(wanAddressApplicationMiddleware));
proxyServer.use(hostnameResolutionMiddleware.invoke.bind(hostnameResolutionMiddleware));
proxyServer.use(denyLocalAreaNetworkAccessMiddleware.invoke.bind(denyLocalAreaNetworkAccessMiddleware));
proxyServer.use(denyLoopbackAttackMiddleware.invoke.bind(denyLoopbackAttackMiddleware));
proxyServer.use(corsApplicationMiddleware.invoke.bind(corsApplicationMiddleware));
proxyServer.use(hardcodedResponseMiddleware.invoke.bind(hardcodedResponseMiddleware));
proxyServer.use(sendAxiosRequestMiddleware.invoke.bind(sendAxiosRequestMiddleware));

////////////////////////////////////////////////////////////////////////////////////////////////////

if (webEnvironment.singleton.logStartupInfo)
  web.overrideLoggers(setupLogger.information.bind(setupLogger), setupLogger.error.bind(setupLogger));

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

if (sentryEnvironment.singleton.sentryEnabled) {
  proxyServer.use(Sentry.Handlers.errorHandler());
}

proxyServer.use(errorMiddleware.invoke.bind(errorMiddleware));

////////////////////////////////////////////////////////////////////////////////////////////////////
// Settings
////////////////////////////////////////////////////////////////////////////////////////////////////

if (webEnvironment.singleton.enableSecureServer) {
  entrypointLogger.information('Loading TLS settings...');

  if (webEnvironment.singleton.enableTLSv2) {
    entrypointLogger.information('TLSv2 is enabled.');
    settings.tlsV2 = true;
  }
  settings.tls = true;
  settings.tlsPort = webEnvironment.singleton.securePort;

  if (!fs.existsSync(webEnvironment.singleton.sslBaseDirectory)) {
    entrypointLogger.error(
      'The SSL base directory does not exist. Please make sure it exists and is readable. Path: %s',
      webEnvironment.singleton.sslBaseDirectory,
    );
    throw new Error(`The SSL base directory "${webEnvironment.singleton.sslBaseDirectory}" does not exist.`);
  }

  const fullyQualifiedCertificatePath = path.join(
    webEnvironment.singleton.sslBaseDirectory,
    webEnvironment.singleton.sslCertificateFileName,
  );
  const fullyQualifiedKeyPath = path.join(
    webEnvironment.singleton.sslBaseDirectory,
    webEnvironment.singleton.sslKeyFileName,
  );

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

  settings.baseTlsDirectory = webEnvironment.singleton.sslBaseDirectory;
  settings.cert = webEnvironment.singleton.sslCertificateFileName;
  settings.key = webEnvironment.singleton.sslKeyFileName;

  if (webEnvironment.singleton.sslKeyPassphrase !== null) {
    entrypointLogger.information('TLS key passphrase is enabled.');
    settings.passphrase = webEnvironment.singleton.sslKeyPassphrase;
  }

  if (webEnvironment.singleton.sslCertificateChainFileName !== null) {
    entrypointLogger.information('TLS certificate chain is enabled.');
    const fullyQualifiedCertificateChainPath = path.join(
      webEnvironment.singleton.sslBaseDirectory,
      webEnvironment.singleton.sslCertificateChainFileName,
    );

    if (!fs.existsSync(fullyQualifiedCertificateChainPath)) {
      entrypointLogger.error(
        'The SSL certificate chain file does not exist. Please make sure it exists and is readable. Path: %s',
        fullyQualifiedCertificateChainPath,
      );
      throw new Error(`The SSL certificate chain file "${fullyQualifiedCertificateChainPath}" does not exist.`);
    }

    settings.chain = webEnvironment.singleton.sslCertificateChainFileName;
  }
}

settings.insecure = true;
settings.insecurePort = webEnvironment.singleton.insecurePort;

settings.bind = webEnvironment.singleton.bindAddressIPv4;

web.startServer({
  app: proxyServer,
  ...settings,
});

// This is a temporary fix for the issue where the server is not able to start when
// running in a Docker container on IPv6.
if (!webEnvironment.singleton.disableIPv6 && !environment.isDocker()) {
  entrypointLogger.information('Starting IPv6 server...');
  settings.bind = webEnvironment.singleton.bindAddressIPv6;
  web.startServer({
    app: proxyServer,
    ...settings,
  });
}
