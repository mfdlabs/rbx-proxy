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

/**
 * A class for loading environment variables from .env files programmatically.
 */
abstract class Environment {
  // Trys to get then deserialize the value of the environment variable.
  private static getSettingOrDefault<T>(setting: string, defaultValue: T, reloadEnvironment: boolean = true): T {
    if (reloadEnvironment) {
      dotenvLoader.reloadEnvironment();
    }

    switch (typeof defaultValue) {
      case 'boolean':
        return typeConverters.toBoolean(process.env[setting], defaultValue) as unknown as T;
      case 'number':
        return parseInt(process.env[setting] ?? '', 10) as unknown as T;
      default:
        if (Array.isArray(defaultValue)) {
          return (process.env[setting]?.split(',') as unknown as T) ?? defaultValue;
        }

        return (process.env[setting] as unknown as T) || defaultValue;
    }
  }

  /**
   * This is only ingested by the Logger class.
   *
   * If you set this environment variable, the logger will persist it's log files even if a clearance is requested.
   */
  public static get persistLocalLogs(): boolean {
    return this.getSettingOrDefault('PERSIST_LOCAL_LOGS', false);
  }

  /**
   * Used by the proxy all route catcher.
   *
   * This will determine if the proxy should be allowed to proxy requests that resolve the LAN IPs on the local network.
   */
  public static get hateLocalAreaNetworkAccess(): boolean {
    return this.getSettingOrDefault('HATE_LAN_ACCESS', false);
  }

  /**
   * Used by the proxy's crawler check handler.
   *
   * If false then the crawler check handler will not be called.
   */
  public static get shouldCheckCrawler(): boolean {
    return this.getSettingOrDefault('SHOULD_CHECK_CRAWLER', false);
  }

  /**
   * Used by the proxy's cidr check handler.
   *
   * If false then the cidr check handler will not be called.
   */
  public static get shouldCheckIP(): boolean {
    return this.getSettingOrDefault('SHOULD_CHECK_IP', false);
  }

  /**
   * Used by the proxy's cidr check handler.
   *
   * A list of IPv4 addresses that are allowed to access the proxy.
   */
  public static get allowedIPv4Cidrs(): string[] {
    return this.getSettingOrDefault('ALLOWED_IPV4_CIDRS', []);
  }

  /**
   * Used by the proxy's cidr check handler.
   *
   * A list of IPv6 addresses that are allowed to access the proxy.
   */
  public static get allowedIPv6Cidrs(): string[] {
    return this.getSettingOrDefault('ALLOWED_IPV6_CIDRS', []);
  }

  /**
   * Used by the proxy's crawler check handler.
   *
   * If true then the request will be aborted if a crawler is detected.
   */
  public static get abortConnectionIfCrawler(): boolean {
    return this.getSettingOrDefault('ABORT_CONNECTION_IF_CRAWLER', false);
  }

  /**
   * Used by the proxy's cidr check handler.
   *
   * If true then the request will be aborted if the client's IP is not allowed.
   */
  public static get abortConnectionIfInvalidIP(): boolean {
    return this.getSettingOrDefault('ABORT_CONNECTION_IF_INVALID_IP', false);
  }

  /**
   * Used by the google analytics client.
   *
   * The GA4 client's Measurement ID.
   */
  public static get ga4MeasurementID(): string {
    return this.getSettingOrDefault('GA4_MEASUREMENT_ID', null);
  }

  /**
   * Used by the google analytics client.
   *
   * The GA4 client's API Secret.
   */
  public static get ga4APISecret(): string {
    return this.getSettingOrDefault('GA4_API_SECRET', null);
  }

  /**
   * Used by the google analytics client.
   *
   * If true, then the GA4 client will enable logging.
   */
  public static get ga4EnableLogging(): boolean {
    return this.getSettingOrDefault('GA4_ENABLE_LOGGING', false);
  }

  /**
   * Used by the google analytics client.
   *
   * If true, then the GA4 client will enable server-side validation.
   */
  public static get ga4EnableValidation(): boolean {
    return this.getSettingOrDefault('GA4_ENABLE_VALIDATION', false);
  }

  /**
   * Used by the google analytics client.
   *
   * If true, then the GA4 client will be enabled.
   */
  public static get enableGA4Client(): boolean {
    return this.getSettingOrDefault('ENABLE_GA4_CLIENT', false);
  }

  /**
   * Used by the proxy route handler.
   *
   * If true, then the GA4 client will disable logging ips within the proxy route.
   */
  public static get ga4DisableLoggingIPs(): boolean {
    return this.getSettingOrDefault('GA4_DISABLE_LOGGING_IPS', false);
  }

  /**
   * Used by the proxy route handler.
   *
   * If true, then the GA4 client will disable logging the body of the request.
   */
  public static get ga4DisableLoggingBody(): boolean {
    return this.getSettingOrDefault('GA4_DISABLE_LOGGING_BODY', false);
  }
}

export = Environment;