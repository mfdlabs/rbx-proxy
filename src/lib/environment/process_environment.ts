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
    File Name: process_environment.ts
    Description: Environment variables for the process' configuration.
    Written by: Nikita Petko
*/

import baseEnvironment from '@lib/environment/base_environment';

/**
 * Environment variables for the process' configuration.
 */
export default class ProcessEnvironment extends baseEnvironment {
  private static _instance: ProcessEnvironment;

  /**
   * Represents the singleton instance of the ProcessEnvironment class.
   */
  public static get singleton(): ProcessEnvironment {
    return (this._instance ??= new ProcessEnvironment('process'));
  }
  
  /**
   * Used by the standard in handler.
   *
   * If true, the app will exit on uncaught exceptions.
   */
  public get exitOnUncaughtException(): boolean {
    return this.getOrDefault('EXIT_ON_UNCAUGHT_EXCEPTION', true);
  }

  /**
   * Used by the standard in handler.
   *
   * If true, the app will exit on uncaught rejections.
   */
  public get exitOnUnhandledRejection(): boolean {
    return this.getOrDefault('EXIT_ON_UNHANDLED_REJECTION', true);
  }
}
