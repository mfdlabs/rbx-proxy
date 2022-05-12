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
    File Name: loggingMiddleware.ts
    Description: This handler will log all incoming requests.
    Written by: Nikita Petko
*/

import logger from '@lib/utility/logger';

import * as tls from 'tls';
import * as net from 'net';
import netHelper from '@mfdlabs/net';
import { NextFunction, Request, Response } from 'express';

class LoggingMiddleware {
  /**
   * Invokes the middleware.
   * @param {Request} request The request object.
   * @param {Response} _response The response object.
   * @param {NextFunction} next The next function to call.
   * @returns {void} Nothing.
   */
  public static invoke(request: Request, _response: Response, next: NextFunction): void {
    const localIp = LoggingMiddleware._getLocalIp(request);
    const forwardedPort = request.headers['x-forwarded-port'] as string;
    const port = forwardedPort ? parseInt(forwardedPort, 10) : LoggingMiddleware._getLocalPort(request);
    const isVerifiedTlsSession = LoggingMiddleware._isVerifiedTlsSession(request);

    logger.log(
      `%s request on URI %s://%s:%d%s ('%s') from client '%s' (%s). TLS session: %s.`,
      request.method.toUpperCase(),
      request.protocol,
      localIp,
      port,
      request.url,
      request.headers.host || 'No Host Header',
      LoggingMiddleware._getTruncatedUserAgent(request.headers['user-agent']),
      request.ip,
      request.protocol === 'https' ? (isVerifiedTlsSession ? 'verified' : 'unverified') : 'insecure',
    );

    next();
  }

  private static _getLocalPort(request: Request): number {
    return LoggingMiddleware._getSocket(request).localPort;
  }

  private static _getSocket(request: Request): net.Socket | tls.TLSSocket {
    // spdy does some weird stuff with the raw socket, as in it puts the actual TLSSocket in a nested property
    return ((request.socket as any)?._spdyState?.parent as tls.TLSSocket) ?? request.socket;
  }

  private static _isVerifiedTlsSession(request: Request): boolean {
    const socket = LoggingMiddleware._getSocket(request);

    if (socket === undefined) return false;
    if (!(socket instanceof tls.TLSSocket)) return false;

    return socket.authorized;
  }

  private static _getTruncatedUserAgent(userAgent: string): string {
    if (userAgent === undefined) return 'No request user agent';

    if (userAgent.length > 75) {
      return userAgent.substring(0, 75) + '...';
    }

    return userAgent;
  }

  private static _getLocalIp(request: Request): string {
    if (netHelper.isIPv4(request.ip)) {
      if (netHelper.isIPv4Loopback(request.ip)) {
        return '127.0.0.1';
      } else {
        return netHelper.getLocalIPv4();
      }
    } else {
      if (netHelper.isIPv6Loopback(request.ip)) {
        return '[::1]';
      } else {
        return `[${netHelper.getLocalIPv6()}]`;
      }
    }
  }
}

export = LoggingMiddleware;
