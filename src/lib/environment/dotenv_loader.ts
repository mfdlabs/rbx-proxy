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
    File Name: dotenv_loader.ts
    Description: A simple helper for loading .env files via dotenv.
    Written by: Nikita Petko
*/

import { projectDirectoryName } from '@lib/directories';

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

/**
 * A simple helper for loading .env files via dotenv.
 */
export default abstract class DotenvLoader {
  private static _dotEnvFilePath: string = path.join(projectDirectoryName, '.env');

  /**
   * Loads the .env file and parses it into process.env.
   */
  public static reloadEnvironment() {
    if (!fs.existsSync(this._dotEnvFilePath)) return;

    try {
      const data = dotenv.parse(fs.readFileSync(this._dotEnvFilePath));

      for (const k of Object.keys(data)) {
        process.env[k] = data[k];
      }
    } catch (e) {
      // Do nothing.
    }
  }
}
