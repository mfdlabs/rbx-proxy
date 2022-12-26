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
    File Name: proxy_raw_responses_logger_environment.ts
    Description: Environment variables for the proxy raw responses logger.
    Written by: Nikita Petko
*/

import baseEnvironment from '@lib/environment/base_environment';

/**
 * Environment variables for the proxy raw responses logger.
 */
export default class ProxyRawResponsesLoggerEnvironment extends baseEnvironment {
  private static _instance: ProxyRawResponsesLoggerEnvironment;

  /**
   * Represents the singleton instance of the ProxyRawResponsesLoggerEnvironment class.
   */
  public static get singleton(): ProxyRawResponsesLoggerEnvironment {
    return (this._instance ??= new ProxyRawResponsesLoggerEnvironment('proxy-raw-responses-logger'));
  }

  /**
   * The name of the logger.
   * @returns {string} The name of the logger.
   * @default 'proxy raw responses'
   */
  public get loggerName(): string {
    return super.getOrDefault('PROXY_RAW_RESPONSES_LOGGER_NAME', 'proxy-raw-responses');
  }

  /**
   * Is the logger enabled?
   * @returns {boolean} Is the logger enabled?
   * @default false
   */
  public get enabled(): boolean {
    return super.getOrDefault('PROXY_RAW_RESPONSES_ENABLED', false);
  }

  /**
   * Should the logger cut the log prefix?
   * @returns {boolean} Should the logger cut the log prefix?
   * @default true
   */
  public get cutLogPrefix(): boolean {
    return super.getOrDefault('PROXY_RAW_RESPONSES_CUT_LOG_PREFIX', true);
  }
}
