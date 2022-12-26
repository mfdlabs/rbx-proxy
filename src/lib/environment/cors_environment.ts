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
    File Name: cors_environment.ts
    Description: Environment variables for the Cors configuration.
    Written by: Nikita Petko
*/

import { projectDirectoryName } from '@lib/directories';
import baseEnvironment from '@lib/environment/base_environment';

/**
 * Environment variables for the Cors configuration.
 */
export default class CorsEnvironment extends baseEnvironment {
  private static _instance: CorsEnvironment;

  /**
   * Represents the singleton instance of the CorsEnvironment class.
   */
  public static get singleton(): CorsEnvironment {
    return (this._instance ??= new CorsEnvironment('cors'));
  }

  /**
   * Used by the cors application middleware.
   *
   * If true, we will enable the cors writer.
   */
  public get enableCorsWriter(): boolean {
    return this.getOrDefault('ENABLE_CORS_WRITER', true);
  }

  /**
   * Used by the cors writer.
   *
   * Represents the fileName of the CORs rules file.
   */
  public get corsRulesFileName(): string {
    return this.getOrDefault('CORS_RULES_FILE_NAME', 'cors-rules.yml');
  }

  /**
   * Used by the cors writer.
   *
   * Represents the base directory for the CORs rules files.
   */
  public get corsRulesBaseDirectory(): string {
    return this.getOrDefault('CORS_RULES_BASE_DIRECTORY', projectDirectoryName);
  }

  /**
   * Used by the cors writer.
   *
   * If true, it will reload the CORs rules file on each request.
   */
  public get corsRulesReloadOnRequest(): boolean {
    return this.getOrDefault('CORS_RULES_RELOAD_ON_REQUEST', false);
  }

  /**
   * Used by the all route catcher.
   *
   * If true, it will apply the CORs headers regardless of if the origin matches the route's allowedOrigins.
   */
  public get corsApplyHeadersRegardlessOfOrigin(): boolean {
    return this.getOrDefault('CORS_APPLY_HEADERS_REGARDLESS_OF_ORIGIN', false);
  }

  /**
   * Used by the all route catcher.
   *
   * If true, it will apply the CORs headers regardless of if the origin header is present.
   */
  public get corsApplyHeadersRegardlessOfOriginHeader(): boolean {
    return this.getOrDefault('CORS_APPLY_HEADERS_REGARDLESS_OF_ORIGIN_HEADER', false);
  }
}
