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
    File Name: hardcode_environment.ts
    Description: Environment variables for the hardcoded response writer configuration.
    Written by: Nikita Petko
*/

import { projectDirectoryName } from '@lib/directories';
import baseEnvironment from '@lib/environment/base_environment';

/**
 * Environment variables for the hardcoded response writer configuration.
 */
export default class HardcodeEnvironment extends baseEnvironment {
  private static _instance: HardcodeEnvironment;

  /**
   * Represents the singleton instance of the HardcodeEnvironment class.
   */
  public static get singleton(): HardcodeEnvironment {
    return (this._instance ??= new HardcodeEnvironment('hardcode'));
  }

  /**
   * Used by the hardcoded response writer.
   *
   * Represents the fileName of the hardcoded response rules file.
   */
  public get hardcodedResponseRulesFileName(): string {
    return this.getOrDefault('HARDCODED_RESPONSE_RULES_FILE_NAME', 'hardcoded-response-rules.yml');
  }

  /**
   * Used by the hardcoded response writer.
   *
   * Represents the base directory for the hardcoded response rules files.
   */
  public get hardcodedResponseRulesBaseDirectory(): string {
    return this.getOrDefault('HARDCODED_RESPONSE_RULES_BASE_DIRECTORY', projectDirectoryName);
  }

  /**
   * Used by the hardcoded response writer.
   *
   * If true, it will reload the hardcoded response rules file on each request.
   */
  public get hardcodedResponseRulesReloadOnRequest(): boolean {
    return this.getOrDefault('HARDCODED_RESPONSE_RULES_RELOAD_ON_REQUEST', false);
  }

}
