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
    File Name: index.ts
    Description: This class is a helper for configuring the web server.
    Written by: Nikita Petko
*/

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Imports
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

import route from './contracts/route';
import walkers from './utility/walkers';
import startupOptions from './options/startupOptions';
import routeSetupOptions from './options/routeSetupOptions';
import configurationOptions from './options/configurationOptions';

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Type Imports
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

import { RouteCallbackDelegate } from './customTypes/routeCallbackDelegate';

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Third Party Imports
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

import * as fs from 'fs';
import * as net from 'net';
import * as spdy from 'spdy';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';
import * as express from 'express';
import * as bodyParser from 'body-parser';

/**
 * A helper class for configuring the web server.
 *
 * This is abstract so that it can't be instantiated.
 */
abstract class WebHelper {
  private static _baseRoutesPath: string = 'Routes';
  private static _rootProjectPath: string = __dirname;

  // log functions
  private static _logInfo: (message: string, ...args: any[]) => void = null;
  private static _logWarning: (message: string, ...args: any[]) => void = null;
  private static _logDebug: (message: string, ...args: any[]) => void = null;
  private static _logError: (message: string, ...args: any[]) => void = null;

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Header constants

  private static readonly _certificateHeader = '-----BEGIN CERTIFICATE-----';
  private static readonly _rsaPrivateKeyHeader = '-----BEGIN RSA PRIVATE KEY-----';
  private static readonly _privateKeyHeader = '-----BEGIN PRIVATE KEY-----';
  private static readonly _ecPrivateKeyHeader = '-----BEGIN EC PRIVATE KEY-----';
  private static readonly _encryptedPrivateKeyHeader = '-----BEGIN ENCRYPTED PRIVATE KEY-----';

  /**
   * Overrides the log functions.
   * @param {(message: string, ...args: any[]) => void} logInfo The log info function.
   * @param {(message: string, ...args: any[]) => void} logWarning The log warning function.
   * @param {(message: string, ...args: any[]) => void} logDebug The log debug function.
   * @param {(message: string, ...args: any[]) => void} logError The log error function.
   * @returns {void} Nothing.
   */
  public static overrideLoggers(
    logInfo?: (message: string, ...args: any[]) => void,
    logWarning?: (message: string, ...args: any[]) => void,
    logDebug?: (message: string, ...args: any[]) => void,
    logError?: (message: string, ...args: any[]) => void,
  ): void {
    this._logInfo = logInfo;
    this._logWarning = logWarning;
    this._logDebug = logDebug;
    this._logError = logError;
  }

  /**
   * Overrides the project root path.
   * @param {string} rootProjectPath The new project root path.
   * @returns {void} Nothing.
   */
  public static overrideRootProjectPath(rootProjectPath: string): void {
    this._rootProjectPath = rootProjectPath;
  }

  /**
   * Replaces the current file routes base path.
   *
   * The default is 'Routes'.
   * @param {string} baseRoutesPath The new base path.
   */
  public static overrideBaseRoutesPath(baseRoutesPath: string): void {
    this._baseRoutesPath = baseRoutesPath;
  }

  /**
   * Configures the web server.
   * @param {configurationOptions} options The configuration options.
   */
  public static configureServer(options: configurationOptions): void {
    try {
      if (options.trustProxy) options.app.enable('trust proxy');
      if (options.noXPowerBy) options.app.disable('x-powered-by');
      if (options.noETag) options.app.disable('etag');

      if (options.rawBufferRequest)
        // Allow the request body to be parsed as a buffer, max size of 5gb, any content type and inflate the request body.
        options.app.use(
          bodyParser.raw({
            inflate: true,
            limit: '5Gb',
            type: () => true,
          }),
        );

      options.app.use(express.Router(options.routingOptions));

      if (options.allowRoutes) this._mapFileRoutesInternal(options.app, options.routeConfiguration);
    } catch (e) {
      this._logError?.call(this, `Error occurred when configuring a site! Stack: %s`, e.stack);
    }
  }

  /**
   * Gets the fully qualified path of the routes directory.
   * @param {string} routeDirectory The route directory.
   * @returns {string} The fully qualified path of the routes directory.
   */
  public static getRoutesDirectory(routeDirectory: string): string {
    return path.join(this._rootProjectPath, this._baseRoutesPath, routeDirectory);
  }

  /**
   * Starts either a secure or insecure web server. Or both.
   * @param {IStartupOptions} options The startup options.
   * @returns {void} Nothing.
   */
  public static startServer(options: startupOptions): [http.Server, https.Server] {
    this._logInfo?.call(this, 'Try to start the web server...');

    try {
      options.tlsPort = options.tlsPort ?? 443;
      options.insecurePort = options.insecurePort ?? 80;
      options.insecure = options.insecure === undefined ? true : options.insecure;
      options.tls = options.tls === undefined ? false : options.tls;
      options.bind = options.bind ?? '::';

      // Base tls directory should be by default the project root.
      options.baseTlsDirectory = options.baseTlsDirectory ?? this._baseRoutesPath;

      /* Has Certificate */
      let sslServer: https.Server;

      /* Has No Certificate */
      let insecureServer: http.Server;

      this._tryBind(options.bind).then(([success, reason]) => {
        if (!success) {
          this._logError?.call(this, `Failed to start the web server! Reason: %s`, reason);
          return;
        }

        if (options.tls) {
          this._logInfo?.call(this, 'Start a TLS server...');

          const sslConfiguration = this._verifyCertificate(options);

          sslServer = (options.tlsV2 ? spdy : https)
            .createServer(sslConfiguration, options.app)
            .listen(options.tlsPort, options.bind, () =>
              this._logInfo?.call(this, `SSL Server '%s' started on port %d.`, options.bind, options.tlsPort),
            );
        }
        if (options.insecure)
          insecureServer = options.app.listen(options.insecurePort, options.bind, () =>
            this._logInfo?.call(this, `Insecure Server '%s' started on port %d.`, options.bind, options.insecurePort),
          );
        return [insecureServer, sslServer];
      });
    } catch (err) {
      this._logError?.call(this, `Error occurred when starting a server! Stack: %s`, err.stack);
      return [null, null];
    }
  }

  private static _tryBind(bind: string): Promise<[boolean, string]> {
    return new Promise((resolve) => {
      const socket = net.createServer();
      socket.on('error', (err: any) => {
        let reason = 'Unknown';

        switch (err.code) {
          case 'EACCES':
            reason = 'Access denied';
            break;
          case 'EADDRINUSE':
            reason = 'Address in use';
            break;
          case 'EADDRNOTAVAIL':
            reason = 'Address not available';
            break;
          case 'EAFNOSUPPORT':
            reason = 'Address family not supported';
            break;
          case 'EALREADY':
            reason = 'Connection already in progress';
            break;
          case 'EBADF':
            reason = 'Bad file descriptor';
            break;
          case 'ECONNREFUSED':
            reason = 'Connection refused';
            break;
          case 'EFAULT':
            reason = 'Bad address';
            break;
          case 'EHOSTUNREACH':
            reason = 'Host unreachable';
            break;
          case 'EINPROGRESS':
            reason = 'Operation now in progress';
            break;
          case 'EINVAL':
            reason = 'Invalid argument';
            break;
        }

        resolve([false, reason]);
      });
      
      socket.listen(0, bind, () => {
        socket.close();
        resolve([true, '']);
      });
    });
  }

  // The entire point of this method is to see if the key and passphrase are compatible with the certificate.
  // If they are, then we can use the certificate.
  private static _verifyCertificate(options: startupOptions): https.ServerOptions {
    const certPathOrData = options.cert;
    const keyPathOrData = options.key;

    this._logInfo?.call(this, 'Got %s for the certificate and %s for the key.', certPathOrData, keyPathOrData);

    let cert: string = certPathOrData;
    let key: string = keyPathOrData;

    // Check if the cert or key are paths vs actual cert and key contents.
    if (
      certPathOrData.startsWith(this._certificateHeader) &&
      (keyPathOrData.startsWith(this._rsaPrivateKeyHeader) ||
        keyPathOrData.startsWith(this._privateKeyHeader) ||
        keyPathOrData.startsWith(this._ecPrivateKeyHeader) ||
        keyPathOrData.startsWith(this._encryptedPrivateKeyHeader))
    ) {
      this._logInfo?.call(this, 'Cert and key are not paths. Assume they are actual cert and key contents.');

      // Check if they start with the cert and key headers.

      cert = certPathOrData;
      key = keyPathOrData;
    } else {
      this._logInfo?.call(this, 'Cert and key are paths. Prepend base path of %s.', options.baseTlsDirectory);

      cert = fs.readFileSync(path.join(options.baseTlsDirectory, certPathOrData), 'utf8');
      key = fs.readFileSync(path.join(options.baseTlsDirectory, keyPathOrData), 'utf8');
    }

    // Check if empty
    if (!cert || !key) throw new Error(`The certificate or key file is empty!`);

    const sslConfiguration: https.ServerOptions = {
      cert,
      key,
    };

    if (options.chain) {
      if (Array.isArray(options.chain)) {
        this._logInfo?.call(this, 'Got an array of certificates for the chain.');

        // Check if the chain cert is a path vs actual cert contents.
        for (let i = 0; i < options.chain.length; i++) {
          const chainCert = options.chain[i];
          if (chainCert.startsWith(this._certificateHeader)) {
            (sslConfiguration.ca as string[])[i] = chainCert;
          } else {
            (sslConfiguration.ca as string[])[i] = fs.readFileSync(
              path.join(options.baseTlsDirectory, chainCert),
              'utf8',
            );
          }
        }
      } else {
        this._logInfo?.call(this, 'Got a single certificate for the chain.');

        // Check if the chain cert is a path vs actual cert contents.
        if (options.chain.startsWith(this._certificateHeader)) {
          sslConfiguration.ca = options.chain;
        } else {
          sslConfiguration.ca = fs.readFileSync(path.join(options.baseTlsDirectory, options.chain), 'utf8');
        }
      }
    }

    if (options.passphrase) sslConfiguration.passphrase = options.passphrase;

    const server = (options.tlsV2 ? spdy : https).createServer(sslConfiguration, () => {
      // Do nothing.
    });
    server.on('error', (err: Error) => {
      if (err.message.includes('certificate verify failed'))
        throw new Error(`The certificate key and passphrase are not compatible with the certificate!`);
    });
    server.listen(0, () => server.close());

    return sslConfiguration;
  }

  private static _mapFileRoutesInternal(application?: express.Application, options?: routeSetupOptions): void {
    const directory =
      options && options.routesPath ? options.routesPath : path.join(this._rootProjectPath, this._baseRoutesPath);

    if (!fs.existsSync(directory)) {
      this._logWarning?.call(
        this,
        `The directory '%s' for the site '%s' was not found, make sure you configured your directory correctly.`,
        directory,
        options.debugName,
      );
      return;
    }
    const files = walkers.walkDirectory(directory).filter((file) => file.match(/\.js$/));
    files.forEach((file) => {
      // Just in case the file is a directory.
      if (!file.match(/\.js$/)) return;

      let routeModel: route;

      try {
        routeModel = require(file);
      } catch (error) {
        return this._logError?.call(
          this,
          "An error occurred when requiring the route file '%s' for the site '%s'. Stack: %s",
          file,
          options.debugName,
          error.stack,
        );
      }

      if (!routeModel) {
        this._logWarning?.call(
          this,
          "The route file '%s' for the site '%s' had no default export.",
          file,
          options.debugName,
        );
        return;
      }

      const routeCallback: RouteCallbackDelegate = routeModel.invoke;
      if (!routeCallback || typeof routeCallback !== 'function') {
        this._logWarning?.call(
          this,
          "The route file '%s' for the site '%s' did not have a valid callback function.",
          file,
          options.debugName,
        );
        return;
      }

      let allowedMethod = (routeModel.requestMethod ?? 'all').toLowerCase();

      const RejectionWrappedCallback = (
        request: express.Request,
        response: express.Response,
        next: express.NextFunction,
      ) => {
        try {
          const result = routeCallback(request, response, next);
          if (result instanceof Promise) {
            result.catch(next);
          }
        } catch (error) {
          next(error);
        }
      };

      const filePath = file
        .replace(/\.js/i, '')
        .replace(/_P-/g, ':')
        .replace(/__pageIndex__/gi, '/')
        .replace(directory, '')
        .replace(/\\/g, '/')
        .toLowerCase();

      const isMiddleware = /__all/gi.test(filePath);

      if (isMiddleware && allowedMethod !== 'all') allowedMethod = 'all';

      const fqp = (options.debugName !== undefined ? `http://${options.debugName}` : 'http://localhost') + filePath;

      switch (allowedMethod) {
        case 'get':
          if (options.logSetup) this._logDebug?.call(this, `Mapping 'GET' '%s' for site '%s'`, fqp, options.debugName);
          application.get(filePath, RejectionWrappedCallback);
          break;
        case 'head':
          if (options.logSetup) this._logDebug?.call(this, `Mapping 'HEAD' '%s' for site '%s'`, fqp, options.debugName);
          application.head(filePath, RejectionWrappedCallback);
          break;
        case 'post':
          if (options.logSetup) this._logDebug?.call(this, `Mapping 'POST' '%s' for site '%s'`, fqp, options.debugName);
          application.post(filePath, RejectionWrappedCallback);
          break;
        case 'put':
          if (options.logSetup) this._logDebug?.call(this, `Mapping 'PUT' '%s' for site '%s'`, fqp, options.debugName);
          application.put(filePath, RejectionWrappedCallback);
          break;
        case 'patch':
          if (options.logSetup)
            this._logDebug?.call(this, `Mapping 'PATCH' '%s' for site '%s'`, fqp, options.debugName);
          application.patch(filePath, RejectionWrappedCallback);
          break;
        case 'delete':
          if (options.logSetup)
            this._logDebug?.call(this, `Mapping 'DELETE' '%s' for site '%s'`, fqp, options.debugName);
          application.delete(filePath, RejectionWrappedCallback);
          break;
        case 'options':
          if (options.logSetup)
            this._logDebug?.call(this, `Mapping 'OPTIONS' '%s' for site '%s'`, fqp, options.debugName);
          application.options(filePath, RejectionWrappedCallback);
          break;
        case 'all':
          if (isMiddleware) {
            if (options.logSetup) this._logDebug?.call(this, `Mapping 'ALL ROUTES' for site '%s'`, options.debugName);
            application.use(RejectionWrappedCallback);
            break;
          }

          if (options.logSetup) this._logDebug?.call(this, `Mapping 'ALL' '%s' for site '%s'`, fqp, options.debugName);
          application.all(filePath, RejectionWrappedCallback);
          break;
        default:
          this._logWarning?.call(
            this,
            `The route file '%s' for the site '%s' had an invalid request method '%s'.`,
            file,
            options.debugName,
            allowedMethod,
          );
          break;
      }
    });

    if (options.logSetup) this._logInfo?.call(this, `The site '%s' has %d route(s)`, options.debugName, files.length);
  }
}

export = WebHelper;
