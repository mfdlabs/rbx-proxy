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
    File Name: reverse_proxy_middleware.ts
    Description: This will handle reassigning some request context things like IP, port, etc.
                 This middleware will be called first in the request chain.
    Written by: Nikita Petko
*/

import environment from '@lib/environment';

import net from '@mfdlabs/net';
import { NextFunction, Request, Response } from 'express';

export default class ReverseProxyMiddleware {
  /**
   * Invokes the middleware.
   * @param {Request} request The request object.
   * @param {Response} response The response object.
   * @param {NextFunction} next The next function to call.
   * @returns {void} Nothing.
   */
  public static invoke(request: Request, response: Response, next: NextFunction): void {
    this._defineProperty(request, 'port', request.socket.localPort);

    if (!environment.reverseProxyMiddlewareEnabled) return next();

    if (
      this._isFromLocalArea(request) ||
      this._isFromAuthorizedReverseProxy(request) ||
      this._isCloudflareServer(request) // I advise you don't change this array.
    ) {
      if (environment.reverseProxyMiddlewareReassignClientIPAddress) {
        let didAssignIP = false;

        if (environment.useCloudflareForwardingHeaders) {
          // We can use the Cloudflare forwarding headers to get the real IP if
          if (request.headers['cf-connecting-ip']) {
            const cloudflareIP = request.headers['cf-connecting-ip'];
            if (typeof cloudflareIP === 'string' && this._isValidIP(cloudflareIP)) {
              this._setClientIP(request, cloudflareIP);
              didAssignIP = true;
            }
          }
        }

        // If we haven't assigned an IP yet, use the x-forwarded-for header.
        if (!didAssignIP) {
          const forwardedHeader = request.header(environment.forwardingHeaderName);
          if (typeof forwardedHeader === 'string' && this._isValidIP(forwardedHeader)) {
            this._setClientIP(request, forwardedHeader);
            didAssignIP = true;
          }
        }
      }

      if (environment.reverseProxyMiddlewareReassignHostHeader) {
        const forwardedHost = request.header(environment.forwardingTransformedHostHeaderName);
        if (typeof forwardedHost === 'string') {
          request.headers.host = forwardedHost;
        }
      }

      if (environment.reverseProxyMiddlewareReassignClientScheme) {
        const forwardedScheme = request.header(environment.forwardingSchemeHeaderName)?.toLowerCase();
        if (typeof forwardedScheme === 'string' && (forwardedScheme === 'http' || forwardedScheme === 'https')) {
          this._setClientProtocol(request, forwardedScheme);
        }
      }

      if (environment.reverseProxyMiddlewareReassignClientPort) {
        const forwardedPort = request.header(environment.forwardingPortHeaderName);
        if (typeof forwardedPort === 'string' && forwardedPort.length > 0) {
          const port = parseInt(forwardedPort, 10);
          if (!isNaN(port) && port > 0 && port < 65536) {
            this._setClientPort(request, port);
          }
        }
      }
    }

    next();
  }

  private static _setClientIP(request: Request, ip: string): void {
    // Because of how finicky node.js is, and the fact that request.ip is just a getter,
    // we need to completely override the request.ip property.
    this._defineProperty(request, 'ip', ip);
  }

  private static _setClientProtocol(request: Request, protocol: string): void {
    // Because of how finicky node.js is, and the fact that request.protocol is just a getter,
    // we need to completely override the request.protocol property.
    this._defineProperty(request, 'protocol', protocol);
  }

  private static _setClientPort(request: Request, port: number): void {
    // Because of how finicky node.js is, and the fact that request.localPort is just a getter,
    // we need to completely override the request.port property.
    this._defineProperty(request, 'localPort', port);
  }

  private static _defineProperty(request: Request, property: string, value: any): void {
    Object.defineProperty(request, property, {
      configurable: true,
      enumerable: true,
      get: () => value,
    });
  }

  private static _isValidIP(ip: string): boolean {
    return net.isIPv4(ip) || net.isIPv6(ip);
  }

  private static _isCloudflareServer(request: Request): boolean {
    return (
      net.isIPv4InCidrRangeList(request.ip, environment.cloudflareIPv4Addresses) ||
      net.isIPv6InCidrRangeList(request.ip, environment.cloudflareIPv6Addresses)
    );
  }

  private static _isFromAuthorizedReverseProxy(request: Request): boolean {
    // This will determine if the actual client IP is from an authorized reverse proxy.
    // This is useful for situations where you want to allow certain IPs to spoof the request.
    // For example, if you have a reverse proxy that is running on a different machine, that is
    // not on the same network as the server, you can use this to allow that machine to spoof
    // the request.
    return (
      net.isIPv4InCidrRangeList(request.ip, environment.authorizedReverseProxyIPv4Addresses) ||
      net.isIPv6InCidrRangeList(request.ip, environment.authorizedReverseProxyIPv6Addresses)
    );
  }

  private static _isFromLocalArea(request: Request): boolean {
    // IP is either from IPv4 LAN, IPv6 LAN, or localhost.
    // Do not count Link-Local addresses as local.
    return (
      net.isIPv4Loopback(request.ip) ||
      net.isIPv6Loopback(request.ip) ||
      net.isIPv4RFC1918(request.ip) ||
      net.isIPv6RFC4193(request.ip) ||
      net.isIPv6RFC3879(request.ip)
    );
  }
}
