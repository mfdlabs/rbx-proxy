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

import proxyEnvironment from '@lib/environment/proxy_environment';
import * as reverseProxyMiddlewareMetrics from '@lib/metrics/middleware/reverse_proxy_middleware_metrics';

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

    if (!proxyEnvironment.singleton.reverseProxyMiddlewareEnabled) return next();

    if (
      this._isFromLocalArea(request) ||
      this._isFromAuthorizedReverseProxy(request) ||
      this._isCloudflareServer(request) // I advise you don't change this array.
    ) {
      if (proxyEnvironment.singleton.reverseProxyMiddlewareReassignClientIPAddress) {
        let didAssignIP = false;

        if (proxyEnvironment.singleton.useCloudflareForwardingHeaders) {
          // We can use the Cloudflare forwarding headers to get the real IP if
          if (request.headers['cf-connecting-ip']) {
            const cloudflareIP = request.headers['cf-connecting-ip'];
            if (typeof cloudflareIP === 'string' && this._isValidIP(cloudflareIP)) {
              reverseProxyMiddlewareMetrics.requestsThatAreFromCloudflare.inc({
                method: request.method,
                hostname: request.headers.host || 'No Host Header',
                endpoint: request.url,
                caller: request.ip,
              });

              reverseProxyMiddlewareMetrics.overridenIpAddresses.inc({
                actual_ip: request.ip,
                overriden_ip: cloudflareIP,
              });

              this._setClientIP(request, cloudflareIP);
              didAssignIP = true;
            }
          }
        }

        // If we haven't assigned an IP yet, use the x-forwarded-for header.
        if (!didAssignIP) {
          const forwardedHeader = request.header(proxyEnvironment.singleton.forwardingHeaderName);
          if (typeof forwardedHeader === 'string' && this._isValidIP(forwardedHeader)) {
            reverseProxyMiddlewareMetrics.requestsThatAreFromAuthorizedReverseProxies.inc({
              method: request.method,
              hostname: request.headers.host || 'No Host Header',
              endpoint: request.url,
              caller: request.ip,
            });

            reverseProxyMiddlewareMetrics.overridenIpAddresses.inc({
              actual_ip: request.ip,
              overriden_ip: forwardedHeader,
            });

            this._setClientIP(request, forwardedHeader);
            didAssignIP = true;
          }
        }
      }

      if (proxyEnvironment.singleton.reverseProxyMiddlewareReassignHostHeader) {
        const forwardedHost = request.header(proxyEnvironment.singleton.forwardingTransformedHostHeaderName);
        if (typeof forwardedHost === 'string') {
          reverseProxyMiddlewareMetrics.overridenHostnames.inc({
            actual_hostname: request.headers.host || 'No Host Header',
            overriden_hostname: forwardedHost,
          });

          request.headers.host = forwardedHost;
        }
      }

      if (proxyEnvironment.singleton.reverseProxyMiddlewareReassignClientScheme) {
        const forwardedScheme = request.header(proxyEnvironment.singleton.forwardingSchemeHeaderName)?.toLowerCase();
        if (typeof forwardedScheme === 'string' && (forwardedScheme === 'http' || forwardedScheme === 'https')) {
          reverseProxyMiddlewareMetrics.overridenProtocols.inc({
            actual_protocol: request.protocol,
            overriden_protocol: forwardedScheme,
          });

          this._setClientProtocol(request, forwardedScheme);
        }
      }

      if (proxyEnvironment.singleton.reverseProxyMiddlewareReassignClientPort) {
        const forwardedPort = request.header(proxyEnvironment.singleton.forwardingPortHeaderName);
        if (typeof forwardedPort === 'string' && forwardedPort.length > 0) {
          const port = parseInt(forwardedPort, 10);
          if (!isNaN(port) && port > 0 && port < 65536) {
            reverseProxyMiddlewareMetrics.overridenPorts.inc({
              actual_port: request.localPort.toString(),
              overriden_port: forwardedPort,
            });

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

  private static _defineProperty(request: Request, property: string, value: unknown): void {
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
      net.isIPv4InCidrRangeList(request.ip, proxyEnvironment.singleton.cloudflareIPv4Addresses) ||
      net.isIPv6InCidrRangeList(request.ip, proxyEnvironment.singleton.cloudflareIPv6Addresses)
    );
  }

  private static _isFromAuthorizedReverseProxy(request: Request): boolean {
    // This will determine if the actual client IP is from an authorized reverse proxy.
    // This is useful for situations where you want to allow certain IPs to spoof the request.
    // For example, if you have a reverse proxy that is running on a different machine, that is
    // not on the same network as the server, you can use this to allow that machine to spoof
    // the request.
    return (
      net.isIPv4InCidrRangeList(request.ip, proxyEnvironment.singleton.authorizedReverseProxyIPv4Addresses) ||
      net.isIPv6InCidrRangeList(request.ip, proxyEnvironment.singleton.authorizedReverseProxyIPv6Addresses)
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
