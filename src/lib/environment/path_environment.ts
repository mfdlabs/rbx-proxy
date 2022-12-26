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
    File Name: path_environment.ts
    Description: Environment variables for path based middleware.
    Written by: Nikita Petko
*/

import baseEnvironment from '@lib/environment/base_environment';

/**
 * Environment variables for path based middleware.
 */
export default class PathEnvironment extends baseEnvironment {
  private static _instance: PathEnvironment;

  /**
   * Represents the singleton instance of the PathEnvironment class.
   */
  public static get singleton(): PathEnvironment {
    return (this._instance ??= new PathEnvironment('path'));
  }

  /**
   * Used by the health check middleware.
   *
   * If true, we can use the health check middleware.
   */
  public get useHealthcheckMiddleware(): boolean {
    return this.getOrDefault('USE_HEALTHCHECK_MIDDLEWARE', true);
  }

  /**
   * Used by the metrics middleware.
   *
   * If true, we can use the metrics middleware.
   */
  public get useMetricsMiddleware(): boolean {
    return this.getOrDefault('USE_METRICS_MIDDLEWARE', true);
  }

  /**
   * Used by the config middleware.
   *
   * If true, we can use the config middleware.
   */
  public get useConfigMiddleware(): boolean {
    return this.getOrDefault('USE_CONFIG_MIDDLEWARE', true);
  }

  /**
   * Used by the test exception middleware.
   *
   * If true, we can use the text exception middleware.
   */
  public get useTestExceptionMiddleware(): boolean {
    return this.getOrDefault('USE_TEST_EXCEPTION_MIDDLEWARE', true);
  }

  /**
   * Used by the health check middleware.
   *
   * Represents the path of the health check endpoint.
   */
  public get healthcheckPath(): string {
    return this.getOrDefault('HEALTHCHECK_PATH', '/_lb/_/health');
  }

  /**
   * Used by the metrics middleware.
   *
   * Represents the path of the metrics endpoint.
   */
  public get metricsPath(): string {
    return this.getOrDefault('METRICS_PATH', '/_lb/_/metrics');
  }

  /**
   * Used by the config middleware.
   *
   * Represents the path of the config endpoint.
   */
  public get configPath(): string {
    return this.getOrDefault('CONFIG_PATH', '/_lb/_/config');
  }

  /**
   * Used by the test exception middleware.
   *
   * Represents the path of the test exception endpoint.
   */
  public get testExceptionPath(): string {
    return this.getOrDefault('TEST_EXCEPTION_PATH', '/_lb/_/test');
  }

  /**
   * Used by the path based middleware.
   * 
   * Represents a list of allowed IPv4 addresses.
   */
  public get allowedIPv4Addresses(): string[] {
    return this.getOrDefault('PATH_ALLOWED_IPV4_ADDRESSES', [], 'array<string>');
  }

  /**
   * Used by the path based middleware.
   * 
   * Represents a list of allowed IPv6 addresses.
   */
  public get allowedIPv6Addresses(): string[] {
    return this.getOrDefault('PATH_ALLOWED_IPV6_ADDRESSES', [], 'array<string>');
  }
}
