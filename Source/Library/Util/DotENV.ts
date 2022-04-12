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
    File Name: DotENV.ts
    Description: A simple helper for loading .env files via dotenv.
    Written by: Nikita Petko
*/

import { __baseDirName } from 'Library/Directories';

import { parse } from 'dotenv';
import { readFileSync } from 'fs';

/**
 * A simple helper for loading .env files via dotenv.
 */
export abstract class DotENV {
    /**
     * Loads the .env file and parses it into process.env.
     */
    public static Load() {
        try {
            const data = parse(readFileSync(__baseDirName + '/.env'));

            for (const k in data) {
                process.env[k] = data[k];
            }
        } catch (e) {}
    }
}
