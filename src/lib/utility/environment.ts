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

import dotenvLoader from './dotenvLoader';
import typeConverters from './typeConverter';
import { projectDirectoryName } from 'lib/directories';

import * as fs from 'fs';

/**
 * A class for loading environment variables from .env files programmatically.
 */
abstract class Environment {
  private static _isDockerCached?: boolean = undefined;

  // Trys to get then deserialize the value of the environment variable.
  private static _getSettingOrDefault<T>(setting: string, defaultValue: T, reloadEnvironment: boolean = true): T {
    if (reloadEnvironment) {
      dotenvLoader.reloadEnvironment();
    }

    switch (typeof defaultValue) {
      case 'boolean':
        return typeConverters.toBoolean(process.env[setting], defaultValue) as unknown as T;
      case 'number':
        return parseInt(process.env[setting] ?? defaultValue?.toString(), 10) as unknown as T;
      default:
        if (Array.isArray(defaultValue)) {
          return (process.env[setting]?.split(',') as unknown as T) ?? defaultValue;
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
}

export = Environment;
