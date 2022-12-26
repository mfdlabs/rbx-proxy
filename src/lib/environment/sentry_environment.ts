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
    File Name: sentry_environment.ts
    Description: Environment variables for the Sentry configuration.
    Written by: Nikita Petko
*/

import baseEnvironment from '@lib/environment/base_environment';

/**
 * Environment variables for the Sentry configuration.
 */
export default class SentryEnvironment extends baseEnvironment {
  private static _instance: SentryEnvironment;

  /**
   * Represents the singleton instance of the SentryEnvironment class.
   */
  public static get singleton(): SentryEnvironment {
    return (this._instance ??= new SentryEnvironment('sentry'));
  }

  /**
   * Used by the Sentry Client.
   *
   * Determines if Sentry is enabled.
   */
  public get sentryEnabled(): boolean {
    return this.getOrDefault('SENTRY_ENABLED', false);
  }

  /**
   * Used by the Sentry Client.
   *
   * The DSN to use with the Sentry Client.
   */
  public get sentryClientDsn(): string {
    return this.getOrDefault('SENTRY_CLIENT_DSN', null, 'string');
  }
}
