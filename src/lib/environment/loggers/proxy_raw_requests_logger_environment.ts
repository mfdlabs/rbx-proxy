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
    File Name: proxy_raw_requests_logger_environment.ts
    Description: Environment variables for the proxy raw requests logger.
    Written by: Nikita Petko
*/

import baseEnvironment from '@lib/environment/base_environment';

/**
 * Environment variables for the proxy raw requests logger.
 */
export default class ProxyRawRequestsLoggerEnvironment extends baseEnvironment {
  private static _instance: ProxyRawRequestsLoggerEnvironment;

  /**
   * Represents the singleton instance of the ProxyRawRequestsLoggerEnvironment class.
   */
  public static get singleton(): ProxyRawRequestsLoggerEnvironment {
    return (this._instance ??= new ProxyRawRequestsLoggerEnvironment('proxy-raw-requests-logger'));
  }

  /**
   * The name of the logger.
   * @returns {string} The name of the logger.
   * @default 'proxy raw requests'
   */
  public get loggerName(): string {
    return super.getOrDefault('PROXY_RAW_REQUESTS_LOGGER_NAME', 'proxy-raw-requests');
  }

  /**
   * Is the logger enabled?
   * @returns {boolean} Is the logger enabled?
   * @default false
   */
  public get enabled(): boolean {
    return super.getOrDefault('PROXY_RAW_REQUESTS_ENABLED', false);
  }

  /**
   * Should the logger cut the log prefix?
   * @returns {boolean} Should the logger cut the log prefix?
   * @default true
   */
  public get cutLogPrefix(): boolean {
    return super.getOrDefault('PROXY_RAW_REQUESTS_CUT_LOG_PREFIX', true);
  }
}
