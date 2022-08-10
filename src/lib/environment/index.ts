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
    File Name: environment.ts
    Description: A class for loading environment variables from .env files programmatically.
    Written by: Nikita Petko
*/

import { LogLevel } from '@lib/logger';
import dotenvLoader from '@lib/utility/dotenvLoader';
import typeConverters from '@lib/utility/typeConverter';
import { projectDirectoryName } from '@lib/directories';

import * as fs from 'fs';
import * as path from 'path';

/**
 * A class for loading environment variables from .env files programmatically.
 */
export default abstract class Environment {
  private static _isDockerCached?: boolean = undefined;

  // Trys to get then deserialize the value of the environment variable.
  private static _getSettingOrDefault<T extends any = any>(
    setting: string,
    defaultValue: T | (() => T),
    reloadEnvironment: boolean = true,
  ): T {
    if (reloadEnvironment) {
      dotenvLoader.reloadEnvironment();
    }

    switch (typeof defaultValue) {
      case 'boolean':
        return typeConverters.toBoolean(process.env[setting], defaultValue) as unknown as T;
      case 'number':
        return parseInt(process.env[setting] ?? defaultValue?.toString(), 10) as unknown as T;
      case 'function':
        return (process.env[setting] as unknown as T) || defaultValue?.call(null);
      default:
        if (Array.isArray(defaultValue)) {
          return (process.env[setting]?.split(',') as unknown as T) ?? defaultValue;
        }
        if (defaultValue instanceof RegExp) {
          return new RegExp(process.env[setting] ?? defaultValue.source, defaultValue.flags) as unknown as T;
        }

        return (process.env[setting] as unknown as T) || defaultValue;
    }
  }

  /**
   * Determines if the current context has the .dockerenv file.
   * @returns {boolean} True if the current context has the .dockerenv file.
   */
  public static hasDockerEnv(): boolean {
    try {
      fs.statSync('/.dockerenv');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Determines if the current context has `docker` within it's CGroup.
   * @returns {boolean} True if the current context has `docker` within it's CGroup.
   */
  public static hasDockerCGroup(): boolean {
    if (process.platform !== 'linux') return false;

    try {
      return fs.readFileSync('/proc/self/cgroup', 'utf8').includes('docker');
    } catch {
      return false;
    }
  }

  /**
   * Determines if the current context is running under a docker container.
   * @returns {boolean} True if the current context is running under a docker container.
   */
  public static isDocker(): boolean {
    if (this._isDockerCached === undefined) {
      this._isDockerCached = this.hasDockerEnv() || this.hasDockerCGroup();
    }

    return this._isDockerCached;
  }

  /**
   * This is only ingested by the Logger class.
   *
   * If you set this environment variable, the logger will persist it's log files even if a clearance is requested.
   */
  public static get persistLocalLogs(): boolean {
    return this._getSettingOrDefault('PERSIST_LOCAL_LOGS', false);
  }

  /**
   * Used by the proxy all route catcher.
   *
   * This will determine if the proxy should be allowed to proxy requests that resolve the LAN IPs on the local network.
   */
  public static get hateLocalAreaNetworkAccess(): boolean {
    return this._getSettingOrDefault('HATE_LAN_ACCESS', false);
  }

  /**
   * Used by the proxy's crawler check handler.
   *
   * If false then the crawler check handler will not be called.
   */
  public static get shouldCheckCrawler(): boolean {
    return this._getSettingOrDefault('SHOULD_CHECK_CRAWLER', false);
  }

  /**
   * Used by the proxy's cidr check handler.
   *
   * If false then the cidr check handler will not be called.
   */
  public static get shouldCheckIP(): boolean {
    return this._getSettingOrDefault('SHOULD_CHECK_IP', false);
  }

  /**
   * Used by the proxy's cidr check handler.
   *
   * A list of IPv4 addresses that are allowed to access the proxy.
   */
  public static get allowedIPv4Cidrs(): string[] {
    return this._getSettingOrDefault('ALLOWED_IPV4_CIDRS', []);
  }

  /**
   * Used by the proxy's cidr check handler.
   *
   * A list of IPv6 addresses that are allowed to access the proxy.
   */
  public static get allowedIPv6Cidrs(): string[] {
    return this._getSettingOrDefault('ALLOWED_IPV6_CIDRS', []);
  }

  /**
   * Used by the proxy's crawler check handler.
   *
   * If true then the request will be aborted if a crawler is detected.
   */
  public static get abortConnectionIfCrawler(): boolean {
    return this._getSettingOrDefault('ABORT_CONNECTION_IF_CRAWLER', false);
  }

  /**
   * Used by the proxy's cidr check handler.
   *
   * If true then the request will be aborted if the client's IP is not allowed.
   */
  public static get abortConnectionIfInvalidIP(): boolean {
    return this._getSettingOrDefault('ABORT_CONNECTION_IF_INVALID_IP', false);
  }

  /**
   * Used by the google analytics client.
   *
   * The GA4 client's Measurement ID.
   */
  public static get ga4MeasurementID(): string {
    return this._getSettingOrDefault('GA4_MEASUREMENT_ID', null);
  }

  /**
   * Used by the google analytics client.
   *
   * The GA4 client's API Secret.
   */
  public static get ga4APISecret(): string {
    return this._getSettingOrDefault('GA4_API_SECRET', null);
  }

  /**
   * Used by the google analytics client.
   *
   * If true, then the GA4 client will enable logging.
   */
  public static get ga4EnableLogging(): boolean {
    return this._getSettingOrDefault('GA4_ENABLE_LOGGING', false);
  }

  /**
   * Used by the google analytics client.
   *
   * If true, then the GA4 client will enable server-side validation.
   */
  public static get ga4EnableValidation(): boolean {
    return this._getSettingOrDefault('GA4_ENABLE_VALIDATION', false);
  }

  /**
   * Used by the google analytics client.
   *
   * If true, then the GA4 client will be enabled.
   */
  public static get enableGA4Client(): boolean {
    return this._getSettingOrDefault('ENABLE_GA4_CLIENT', false);
  }

  /**
   * Used by the proxy route handler.
   *
   * If true, then the GA4 client will disable logging ips within the proxy route.
   */
  public static get ga4DisableLoggingIPs(): boolean {
    return this._getSettingOrDefault('GA4_DISABLE_LOGGING_IPS', false);
  }

  /**
   * Used by the proxy route handler.
   *
   * If true, then the GA4 client will disable logging the body of the request.
   */
  public static get ga4DisableLoggingBody(): boolean {
    return this._getSettingOrDefault('GA4_DISABLE_LOGGING_BODY', false);
  }

  /**
   * Used by the entry point.
   *
   * If true, we will log startup information.
   */
  public static get logStartupInfo(): boolean {
    return this._getSettingOrDefault('LOG_STARTUP_INFO', false);
  }

  /**
   * Used by the entry point.
   *
   * If true, we will disable IPv6 support.
   */
  public static get disableIPv6(): boolean {
    return this._getSettingOrDefault('DISABLE_IPV6', false);
  }

  /**
   * Used by the entry point.
   *
   * This value will determine the bind port for insecure servers.
   */
  public static get insecurePort(): number {
    return this._getSettingOrDefault('INSECURE_PORT', 80);
  }

  /**
   * Used by the entry point.
   *
   * This value will determine the bind port for secure servers.
   */
  public static get securePort(): number {
    return this._getSettingOrDefault('SECURE_PORT', 443);
  }

  /**
   * Used by the entry point.
   *
   * If true, we will enable the TLS server.
   */
  public static get enableSecureServer(): boolean {
    return this._getSettingOrDefault('ENABLE_TLS_SERVER', true);
  }

  /**
   * Used by the entry point.
   *
   * This value will determine the bind address for IPv4 servers.
   */
  public static get bindAddressIPv4(): string {
    return this._getSettingOrDefault('BIND_ADDRESS_IPV4', '0.0.0.0');
  }

  /**
   * Used by the entry point.
   *
   * This value will determine the bind address for IPv6 servers.
   */
  public static get bindAddressIPv6(): string {
    return this._getSettingOrDefault('BIND_ADDRESS_IPV6', '::');
  }

  /**
   * Used by the entry point.
   *
   * If true, we will enable the TLS V2
   */
  public static get enableTLSv2(): boolean {
    return this._getSettingOrDefault('ENABLE_TLSV2', false);
  }

  /**
   * Used by the sphynx rewrite reader.
   *
   * Represents the fileName of the sphynx rewrite file.
   */
  public static get sphynxRewriteFileName(): string {
    return this._getSettingOrDefault('SPHYNX_REWRITE_FILE_NAME', 'sphynx-rewrite.yml');
  }

  /**
   * Used by the proxy all route catcher.
   *
   * Represents the default domain for Sphynx
   */
  public static get sphynxDomain(): string {
    return this._getSettingOrDefault('SPHYNX_DOMAIN', 'apis.roblox.com');
  }

  /**
   * Used by the sphynx rewrite reader.
   *
   * Represents the fileName of the sphynx hardcode url file.
   */
  public static get sphynxHardcodeFileName(): string {
    return this._getSettingOrDefault('SPHYNX_HARDCODE_FILE_NAME', 'sphynx-hardcode.yml');
  }

  /**
   * Used by the sphynx rewrite reader.
   *
   * Represents the base directory for the sphynx rewrite files.
   */
  public static get sphynxRewriteBaseDirectory(): string {
    return this._getSettingOrDefault('SPHYNX_REWRITE_BASE_DIRECTORY', projectDirectoryName);
  }

  /**
   * Used by the sphynx rewrite reader.
   *
   * If true, it will reload the sphynx rewrite file on each request.
   */
  public static get sphynxRewriteReloadOnRequest(): boolean {
    return this._getSettingOrDefault('SPHYNX_REWRITE_RELOAD_ON_REQUEST', false);
  }

  /**
   * Used by the entry point.
   *
   * This value will determine the root directory for ssl certificates.
   * If not present, then the default will be `{projectDirectory}/ssl`.
   */
  public static get sslBaseDirectory(): string {
    return this._getSettingOrDefault('SSL_BASE_DIRECTORY', path.join(projectDirectoryName, 'ssl'));
  }

  /**
   * Used by the entry point.
   *
   * Determines the file name for the ssl certificate.
   * If this is not present it will throw an error.
   * @throws {Error} The environment variable SSL_CERTIFICATE_FILE_NAME is not set.
   */
  public static get sslCertificateFileName(): string {
    return this._getSettingOrDefault<string>('SSL_CERTIFICATE_FILE_NAME', () => {
      throw new Error('SSL_CERTIFICATE_FILE_NAME is not set.');
    });
  }

  /**
   * Used by the entry point.
   *
   * Determines the file name for the ssl key.
   * If this is not present it will throw an error.
   * @throws {Error} The environment variable SSL_KEY_FILE_NAME is not set.
   */
  public static get sslKeyFileName(): string {
    return this._getSettingOrDefault<string>('SSL_KEY_FILE_NAME', () => {
      throw new Error('SSL_KEY_FILE_NAME is not set.');
    });
  }

  /**
   * Used by the entry point.
   *
   * Optional certificate chain file name.
   */
  public static get sslCertificateChainFileName(): string {
    return this._getSettingOrDefault('SSL_CERTIFICATE_CHAIN_FILE_NAME', null);
  }

  /**
   * Used by the entry point.
   *
   * Optional passphrase for the ssl key.
   */
  public static get sslKeyPassphrase(): string {
    return this._getSettingOrDefault('SSL_KEY_PASSPHRASE', null);
  }

  /**
   * Used by the standard in handler.
   *
   * If true, the app will exit on uncaught exceptions.
   */
  public static get exitOnUncaughtException(): boolean {
    return this._getSettingOrDefault('EXIT_ON_UNCAUGHT_EXCEPTION', true);
  }

  /**
   * Used by the standard in handler.
   *
   * If true, the app will exit on uncaught rejections.
   */
  public static get exitOnUnhandledRejection(): boolean {
    return this._getSettingOrDefault('EXIT_ON_UNHANDLED_REJECTION', true);
  }

  /**
   * Used by the logger..
   *
   * If true, we will also log to the file system.
   */
  public static get logToFileSystem(): boolean {
    return this._getSettingOrDefault('LOG_TO_FILE_SYSTEM', true);
  }

  /**
   * Used by the logger..
   *
   * If true, we will also log to the console.
   */
  public static get logToConsole(): boolean {
    return this._getSettingOrDefault('LOG_TO_CONSOLE', true);
  }

  /**
   * Used by the logger..
   *
   * A loglevel for the logger..
   */
  public static get logLevel(): LogLevel {
    return this._getSettingOrDefault('LOG_LEVEL', LogLevel.Info); // default to info
  }

  /**
   * Used by the cors writer.
   *
   * Represents the fileName of the CORs rules file.
   */
  public static get corsRulesFileName(): string {
    return this._getSettingOrDefault('CORS_RULES_FILE_NAME', 'cors-rules.yml');
  }

  /**
   * Used by the cors writer.
   *
   * Represents the base directory for the CORs rules files.
   */
  public static get corsRulesBaseDirectory(): string {
    return this._getSettingOrDefault('CORS_RULES_BASE_DIRECTORY', projectDirectoryName);
  }

  /**
   * Used by the cors writer.
   *
   * If true, it will reload the CORs rules file on each request.
   */
  public static get corsRulesReloadOnRequest(): boolean {
    return this._getSettingOrDefault('CORS_RULES_RELOAD_ON_REQUEST', false);
  }

  /**
   * Used by the all route catcher.
   *
   * If true, it will apply the CORs headers regardless of if the origin matches the route's allowedOrigins.
   */
  public static get corsApplyHeadersRegardlessOfOrigin(): boolean {
    return this._getSettingOrDefault('CORS_APPLY_HEADERS_REGARDLESS_OF_ORIGIN', false);
  }

  /**
   * Used by the all route catcher.
   *
   * If true, it will apply the CORs headers regardless of if the origin header is present.
   */
  public static get corsApplyHeadersRegardlessOfOriginHeader(): boolean {
    return this._getSettingOrDefault('CORS_APPLY_HEADERS_REGARDLESS_OF_ORIGIN_HEADER', false);
  }

  /**
   * Used by the reverse proxy middleware.
   *
   * If true, the reverse proxy middleware is enabled.
   */
  public static get reverseProxyMiddlewareEnabled(): boolean {
    return this._getSettingOrDefault('REVERSE_PROXY_MIDDLEWARE_ENABLED', true);
  }

  /**
   * Used by the reverse proxy middleware.
   *
   * A list of IPv4 addresses that are authorized reverse proxies.
   * @remarks This is used to prevent anyone from spoofing the client IP address.
   */
  public static get authorizedReverseProxyIPv4Addresses(): string[] {
    return this._getSettingOrDefault('AUTHORIZED_REVERSE_PROXY_IPV4_ADDRESSES', []);
  }

  /**
   * Used by the reverse proxy middleware.
   *
   * A list of IPv6 addresses that are authorized reverse proxies.
   */
  public static get authorizedReverseProxyIPv6Addresses(): string[] {
    return this._getSettingOrDefault('AUTHORIZED_REVERSE_PROXY_IPV6_ADDRESSES', []);
  }

  /**
   * Used by the reverse proxy middleware.
   *
   * If true, we can use cloudflare's forwarding headers to determine the client IP address if they are present.
   * @note If it cannot find the headers in the request, it will fall back to the header we specified here for the client IP address.
   */
  public static get useCloudflareForwardingHeaders(): boolean {
    return this._getSettingOrDefault('USE_CLOUDFLARE_FORWARDING_HEADERS', false);
  }

  /**
   * Used by the reverse proxy middleware.
   *
   * A list of IPv4 addresses that are cloudflare's servers.
   * @see https://www.cloudflare.com/ips-v4
   */
  public static get cloudflareIPv4Addresses(): string[] {
    return this._getSettingOrDefault('CLOUDFLARE_IPV4_ADDRESSES', [
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
  public static get cloudflareIPv6Addresses(): string[] {
    return this._getSettingOrDefault('CLOUDFLARE_IPV6_ADDRESSES', [
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
   * The header we should use to determine the client IP address.
   * @note If we cannot find the header in the request, we will not reassign the header and just use the default.
   */
  public static get forwardingHeaderName(): string {
    return this._getSettingOrDefault('FORWARDING_HEADER_NAME', 'X-Forwarded-For');
  }

  /**
   * Used by the reverse proxy middleware.
   *
   * If true, we can reassign the client IP address using the forwarding header.
   */
  public static get reverseProxyMiddlewareReassignClientIPAddress(): boolean {
    return this._getSettingOrDefault('REVERSE_PROXY_MIDDLEWARE_REASSIGN_CLIENT_IP_ADDRESS', true);
  }

  /**
   * Used by the reverse proxy middleware.
   *
   * If true, we can reassign the host header using the forwarding header.
   * I don't advise using this, really you should just make your reverse proxy use the host header.
   */
  public static get reverseProxyMiddlewareReassignHostHeader(): boolean {
    return this._getSettingOrDefault('REVERSE_PROXY_MIDDLEWARE_REASSIGN_HOST_HEADER', false);
  }

  /**
   * Used by the reverse proxy middleware.
   *
   * The header we should use to determine the client transformed host header.
   */
  public static get forwardingTransformedHostHeaderName(): string {
    return this._getSettingOrDefault('FORWARDING_TRANSFORMED_HOST_HEADER_NAME', 'X-Forwarded-Host');
  }

  /**
   * Used by the reverse proxy middleware.
   *
   * If true, we can reassign the client scheme using the forwarding header.
   */
  public static get reverseProxyMiddlewareReassignClientScheme(): boolean {
    return this._getSettingOrDefault('REVERSE_PROXY_MIDDLEWARE_REASSIGN_CLIENT_SCHEME', true);
  }

  /**
   * Used by the reverse proxy middleware.
   *
   * The header we should use to determine the client scheme.
   */
  public static get forwardingSchemeHeaderName(): string {
    return this._getSettingOrDefault('FORWARDING_SCHEME_HEADER_NAME', 'X-Forwarded-Proto');
  }

  /**
   * Used by the reverse proxy middleware.
   *
   * If true, we can reassign the client port using the forwarding header.
   */
  public static get reverseProxyMiddlewareReassignClientPort(): boolean {
    return this._getSettingOrDefault('REVERSE_PROXY_MIDDLEWARE_REASSIGN_CLIENT_PORT', true);
  }

  /**
   * Used by the reverse proxy middleware.
   *
   * The header we should use to determine the client port.
   */
  public static get forwardingPortHeaderName(): string {
    return this._getSettingOrDefault('FORWARDING_PORT_HEADER_NAME', 'X-Forwarded-Port');
  }

  /**
   * Used by the health check middleware.
   *
   * If true, we can use the health check middleware.
   */
  public static get useHealthCheckMiddleware(): boolean {
    return this._getSettingOrDefault('USE_HEALTH_CHECK_MIDDLEWARE', true);
  }

  /**
   * Used by the load balancer info responder.
   *
   * This url represents the format for an ARC deploy machine information url.
   * @note This is only used in arc-deploy scenarios.
   */
  public static get arcMachineInfoUrlFormat(): string {
    return this._getSettingOrDefault(
      'ARC_MACHINE_INFO_URL',
      'http://lb-services.ops-dev.vmminfra.dev/ui/machine/%s/summary',
    );
  }

  /**
   * Used by the express request extensions.
   *
   * If true, google analytics reporting is enabled on requests, else the method will just noop.
   */
  public static get requestExtensionsEnableGoogleAnalytics(): boolean {
    return this._getSettingOrDefault('REQUEST_EXTENSIONS_ENABLE_GOOGLE_ANALYTICS', true);
  }

  /**
   * Used by the hostname resolution middleware.
   *
   * If true, we will try to strip out the port from the host header, as some clients will send the port in the host header.
   */
  public static get hostnameResolutionMiddlewareStripPortFromHostHeader(): boolean {
    return this._getSettingOrDefault('HOSTNAME_RESOLUTION_MIDDLEWARE_STRIP_PORT_FROM_HOST_HEADER', true);
  }

  /**
   * Used by the hostname resolution middleware.
   *
   * A regex to match Roblox test site domains.
   */
  public static get robloxTestSiteDomainRegex(): RegExp {
    return this._getSettingOrDefault(
      'ROBLOX_TEST_SITE_DOMAIN_REGEX',
      /(([a-z0-9\.]{0,255})\.)?((site|game)test[1-5])\.(roblox(labs)?|simul(ping|pong|prod))\.(com|local)/gi,
    );
  }

  /**
   * Used by the hostname resolution middleware.
   *
   * A string that represents the Roblox Production Apex domain.
   */
  public static get robloxProductionApexDomain(): string {
    return this._getSettingOrDefault('ROBLOX_PRODUCTION_APEX_DOMAIN', 'roblox.com');
  }

  /**
   * Used by the cors application middleware.
   *
   * If true, we will enable the cors writer.
   */
  public static get enableCorsWriter(): boolean {
    return this._getSettingOrDefault('ENABLE_CORS_WRITER', true);
  }

  /**
   * Used by the send axios request middleware.
   *
   * If true, we will send the request with x-forwarded headers.
   */
  public static get sendAxiosRequestWithForwardedHeaders(): boolean {
    return this._getSettingOrDefault('SEND_AXIOS_REQUEST_WITH_FORWARDED_HEADERS', true);
  }

  /**
   * Used by the send axios request middleware.
   *
   * Specifies the max amount of time to wait for a response from the server.
   * @note This is in milliseconds.
   */
  public static get sendAxiosRequestTimeout(): number {
    return this._getSettingOrDefault('SEND_AXIOS_REQUEST_TIMEOUT', 35000);
  }

  /**
   * Used by the send axios request middleware.
   *
   * If true, we will just echo back the request configuration to be passed to axios.
   */
  public static get debugEchoRequestConfig(): boolean {
    return this._getSettingOrDefault('DEBUG_ECHO_REQUEST_CONFIG', false);
  }

  /**
   * Used by the send axios request middleware.
   *
   * If true, then certificate validation will be enabled.
   */
  public static get enableCertificateValidation(): boolean {
    return this._getSettingOrDefault('ENABLE_CERTIFICATE_VALIDATION', false); // False here because there's no reason to enable it by default.
  }

  /**
   * Used by the health check middleware.
   *
   * Represents the path of the health check endpoint.
   */
  public static get healthCheckPath(): string {
    return this._getSettingOrDefault('HEALTH_CHECK_PATH', '/_lb/_/health');
  }

  /**
   * Used by the logger.
   *
   * If true, then the logger will cut the prefix of the log message in order to read the log message more easily.
   * @note This is advised for use in production.
   */
  public static get loggerCutPrefix(): boolean {
    return this._getSettingOrDefault('LOGGER_CUT_PREFIX', false);
  }

  /**
   * Used by the logger.
   *
   * The default name of the logger.
   */
  public static get loggerDefaultName(): string {
    return this._getSettingOrDefault('LOGGER_DEFAULT_NAME', 'proxy-server');
  }
}
