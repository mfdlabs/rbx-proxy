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
    File Name: proxy_environment.ts
    Description: A class for loading environment variables from .env files programmatically.
    Written by: Nikita Petko
*/

import baseEnvironment from '@lib/environment/base_environment';

/**
 * A class for loading environment variables from .env files programmatically.
 */
export default class ProxyEnvironment extends baseEnvironment {
  private static _instance: ProxyEnvironment;

  /**
   * Represents the singleton instance of the ProxyEnvironment class.
   */
  public static get singleton(): ProxyEnvironment {
    return (this._instance ??= new ProxyEnvironment('proxy'));
  }

  /**
   * Used by the reverse proxy middleware.
   *
   * If true, the reverse proxy middleware is enabled.
   */
  public get reverseProxyMiddlewareEnabled(): boolean {
    return this.getOrDefault('REVERSE_PROXY_MIDDLEWARE_ENABLED', true);
  }

  /**
   * Used by the reverse proxy middleware.
   *
   * A list of IPv4 addresses that are authorized reverse proxies.
   * @remarks This is used to prevent anyone from spoofing the client IP address.
   */
  public get authorizedReverseProxyIPv4Addresses(): string[] {
    return this.getOrDefault('AUTHORIZED_REVERSE_PROXY_IPV4_ADDRESSES', [], 'array<string>');
  }

  /**
   * Used by the reverse proxy middleware.
   *
   * A list of IPv6 addresses that are authorized reverse proxies.
   */
  public get authorizedReverseProxyIPv6Addresses(): string[] {
    return this.getOrDefault('AUTHORIZED_REVERSE_PROXY_IPV6_ADDRESSES', [], 'array<string>');
  }

  /**
   * Used by the reverse proxy middleware.
   *
   * If true, we can use cloudflare's forwarding headers to determine the client IP address if they are present.
   * @note If it cannot find the headers in the request, it will fall back to the header we specified here for the client IP address.
   */
  public get useCloudflareForwardingHeaders(): boolean {
    return this.getOrDefault('USE_CLOUDFLARE_FORWARDING_HEADERS', false);
  }

  /**
   * Used by the reverse proxy middleware.
   *
   * A list of IPv4 addresses that are cloudflare's servers.
   * @see https://www.cloudflare.com/ips-v4
   */
  public get cloudflareIPv4Addresses(): string[] {
    return this.getOrDefault('CLOUDFLARE_IPV4_ADDRESSES', [
      '173.245.48.0/20',
      '103.21.244.0/22',
      '103.22.200.0/22',
      '103.31.4.0/22',
      '141.101.64.0/18',
      '108.162.192.0/18',
      '190.93.240.0/20',
      '188.114.96.0/20',
      '197.234.240.0/22',
      '198.41.128.0/17',
      '162.158.0.0/15',
      '104.16.0.0/13',
      '104.24.0.0/14',
      '172.64.0.0/13',
      '131.0.72.0/22',
    ]);
  }

  /**
   * Used by the reverse proxy middleware.
   *
   * A list of IPv6 addresses that are cloudflare's servers.
   * @see https://www.cloudflare.com/ips-v6
   */
  public get cloudflareIPv6Addresses(): string[] {
    return this.getOrDefault('CLOUDFLARE_IPV6_ADDRESSES', [
      '2400:cb00::/32',
      '2606:4700::/32',
      '2803:f800::/32',
      '2405:b500::/32',
      '2405:8100::/32',
      '2a06:98c0::/29',
      '2c0f:f248::/32',
    ]);
  }

  /**
   * Used by the reverse proxy middleware.
   *
   * If true, we can reassign the client IP address using the forwarding header.
   */
  public get reverseProxyMiddlewareReassignClientIPAddress(): boolean {
    return this.getOrDefault('REVERSE_PROXY_MIDDLEWARE_REASSIGN_CLIENT_IP_ADDRESS', true);
  }

  /**
   * Used by the reverse proxy middleware.
   *
   * If true, we can reassign the host header using the forwarding header.
   * I don't advise using this, really you should just make your reverse proxy use the host header.
   */
  public get reverseProxyMiddlewareReassignHostHeader(): boolean {
    return this.getOrDefault('REVERSE_PROXY_MIDDLEWARE_REASSIGN_HOST_HEADER', false);
  }

  /**
   * Used by the reverse proxy middleware.
   *
   * If true, we can reassign the client scheme using the forwarding header.
   */
  public get reverseProxyMiddlewareReassignClientScheme(): boolean {
    return this.getOrDefault('REVERSE_PROXY_MIDDLEWARE_REASSIGN_CLIENT_SCHEME', true);
  }

  /**
   * Used by the reverse proxy middleware.
   *
   * If true, we can reassign the client port using the forwarding header.
   */
  public get reverseProxyMiddlewareReassignClientPort(): boolean {
    return this.getOrDefault('REVERSE_PROXY_MIDDLEWARE_REASSIGN_CLIENT_PORT', true);
  }

  /**
   * Used by the reverse proxy middleware.
   *
   * The header we should use to determine the client IP address.
   * @note If we cannot find the header in the request, we will not reassign the header and just use the default.
   */
  public get forwardingHeaderName(): string {
    return this.getOrDefault('FORWARDING_HEADER_NAME', 'X-Forwarded-For');
  }

  /**
   * Used by the reverse proxy middleware.
   *
   * The header we should use to determine the client transformed host header.
   */
  public get forwardingTransformedHostHeaderName(): string {
    return this.getOrDefault('FORWARDING_TRANSFORMED_HOST_HEADER_NAME', 'X-Forwarded-Host');
  }

  /**
   * Used by the reverse proxy middleware.
   *
   * The header we should use to determine the client scheme.
   */
  public get forwardingSchemeHeaderName(): string {
    return this.getOrDefault('FORWARDING_SCHEME_HEADER_NAME', 'X-Forwarded-Proto');
  }

  /**
   * Used by the reverse proxy middleware.
   *
   * The header we should use to determine the client port.
   */
  public get forwardingPortHeaderName(): string {
    return this.getOrDefault('FORWARDING_PORT_HEADER_NAME', 'X-Forwarded-Port');
  }

  /**
   * Used by the reverse proxy middleware.
   *
   * The header we should use to determine the forwarded server name.
   */
  public get forwardingServerNameHeaderName(): string {
    return this.getOrDefault('FORWARDING_SERVER_NAME_HEADER_NAME', 'X-Forwarded-Server');
  }

  /**
   * Used by the reverse proxy middleware.
   *
   * The header we should use to determine the real client IP address.
   */
  public get forwardingRealClientIPHeaderName(): string {
    return this.getOrDefault('FORWARDING_REAL_CLIENT_IP_HEADER_NAME', 'X-Real-IP');
  }
}
