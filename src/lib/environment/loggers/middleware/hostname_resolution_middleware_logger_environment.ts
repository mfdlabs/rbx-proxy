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
    File Name: hostname_resolution_middleware_logger_environment.ts
    Description: Environment variables for the hostname resolution middleware logger.
    Written by: Nikita Petko
*/

import baseEnvironment from '@lib/environment/base_environment';

import { LogLevel } from '@mfdlabs/logging';

/**
 * Environment variables for the hostname resolution middleware logger.
 */
export default class HostnameResolutionkMiddlewareLoggerEnvironment extends baseEnvironment {
  private static _instance: HostnameResolutionkMiddlewareLoggerEnvironment;

  /**
   * Represents the singleton instance of the HostnameResolutionkMiddlewareLoggerEnvironment class.
   */
  public static get singleton(): HostnameResolutionkMiddlewareLoggerEnvironment {
    return (this._instance ??= new HostnameResolutionkMiddlewareLoggerEnvironment('hostname-resolution-middleware-logger'));
  }

  /**
   * The name of the logger.
   * @returns {string} The name of the logger.
   * @default 'hostname-resolution-middleware'
   */
  public get loggerName(): string {
    return super.getOrDefault('HOSTNAME_RESOLUTION_MIDDLEWARE_LOGGER_NAME', 'hostname-resolution-middleware');
  }

  /**
   * The log level.
   * @returns {LogLevel} The log level.
   * @default LogLevel.Info
   */
  public get logLevel(): LogLevel {
    return super.getOrDefault('HOSTNAME_RESOLUTION_MIDDLEWARE_LOG_LEVEL', LogLevel.Info);
  }

  /**
   * Should the logger log to the file system?
   * @returns {boolean} Should the logger log to the file system?
   * @default true
   */
  public get logToFileSystem(): boolean {
    return super.getOrDefault('HOSTNAME_RESOLUTION_MIDDLEWARE_LOG_TO_FILE_SYSTEM', true);
  }

  /**
   * Should the logger log to the console?
   * @returns {boolean} Should the logger log to the console?
   * @default true
   */
  public get logToConsole(): boolean {
    return super.getOrDefault('HOSTNAME_RESOLUTION_MIDDLEWARE_LOG_TO_CONSOLE', true);
  }

  /**
   * Should the logger cut the log prefix?
   * @returns {boolean} Should the logger cut the log prefix?
   * @default true
   */
  public get cutLogPrefix(): boolean {
    return super.getOrDefault('HOSTNAME_RESOLUTION_MIDDLEWARE_CUT_LOG_PREFIX', true);
  }

  /**
   * Should the logger log colors?
   * @returns {boolean} Should the logger log colors?
   * @default true
   */
  public get logWithColor(): boolean {
    return super.getOrDefault('HOSTNAME_RESOLUTION_MIDDLEWARE_LOG_WITH_COLOR', true);
  }
}
