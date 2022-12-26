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
    File Name: ga4_environment.ts
    Description: Environment variables for the Ga4 configuration.
    Written by: Nikita Petko
*/

import baseEnvironment from '@lib/environment/base_environment';

/**
 * Environment variables for the Ga4 configuration.
 */
export default class Ga4Environment extends baseEnvironment {
  private static _instance: Ga4Environment;

  /**
   * Represents the singleton instance of the Ga4Environment class.
   */
  public static get singleton(): Ga4Environment {
    return (this._instance ??= new Ga4Environment('ga4'));
  }

  /**
   * Used by the express request extensions.
   *
   * If true, google analytics reporting is enabled on requests, else the method will just noop.
   */
  public get requestExtensionsEnableGoogleAnalytics(): boolean {
    return this.getOrDefault('REQUEST_EXTENSIONS_ENABLE_GOOGLE_ANALYTICS', true);
  }

  /**
   * Used by the proxy route handler.
   *
   * If true, then the GA4 client will disable logging ips within the proxy route.
   */
  public get ga4DisableLoggingIPs(): boolean {
    return this.getOrDefault('GA4_DISABLE_LOGGING_IPS', false);
  }

  /**
   * Used by the proxy route handler.
   *
   * If true, then the GA4 client will disable logging the body of the request.
   */
  public get ga4DisableLoggingBody(): boolean {
    return this.getOrDefault('GA4_DISABLE_LOGGING_BODY', false);
  }

  /**
   * Used by the google analytics client.
   *
   * The GA4 client's Measurement ID.
   */
  public get ga4MeasurementID(): string {
    return this.getOrDefault('GA4_MEASUREMENT_ID', null, 'string');
  }

  /**
   * Used by the google analytics client.
   *
   * The GA4 client's API Secret.
   */
  public get ga4APISecret(): string {
    return this.getOrDefault('GA4_API_SECRET', null, 'string');
  }

  /**
   * Used by the google analytics client.
   *
   * If true, then the GA4 client will enable logging.
   */
  public get ga4EnableLogging(): boolean {
    return this.getOrDefault('GA4_ENABLE_LOGGING', false);
  }

  /**
   * Used by the google analytics client.
   *
   * If true, then the GA4 client will enable server-side validation.
   */
  public get ga4EnableValidation(): boolean {
    return this.getOrDefault('GA4_ENABLE_VALIDATION', false);
  }

  /**
   * Used by the google analytics client.
   *
   * If true, then the GA4 client will be enabled.
   */
  public get enableGA4Client(): boolean {
    return this.getOrDefault('ENABLE_GA4_CLIENT', false);
  }
}
