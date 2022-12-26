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
    File Name: register.ts
    Description: Import this to register all environments.
    Written by: Nikita Petko
*/

export {};

import baseEnvironment from '@lib/environment/base_environment';

import * as fs from 'fs';
import * as path from 'path';

baseEnvironment.startReplicator();

function recurseDirectory(directory: string): string[] {
  const files = fs.readdirSync(directory, { withFileTypes: true });
  const result: string[] = [];

  for (const file of files) {
    if (file.isDirectory()) {
      result.push(...recurseDirectory(`${directory}/${file.name}`));
    } else {
      result.push(`${directory}/${file.name}`);
    }
  }

  return result;
}

const currentFileExtension = __filename.split('.').pop();

const notAllowedFiles = [
  path.join(__dirname, `register.${currentFileExtension}`),
  path.join(__dirname, `base_environment.${currentFileExtension}`),
  path.join(__dirname, `dotenv_loader.${currentFileExtension}`),
].map((file) => file.replace(/\\/g, '/'));

// Collect all files in the current directory.
const files = recurseDirectory(__dirname)
  .map((file) => file.replace(/\\/g, '/'))
  // Filter out the not-allowed files and files that do not end with the current file extension.
  .filter((file) => !notAllowedFiles.includes(file) && file.endsWith(`.${currentFileExtension}`))
  // Remove the extension.
  .map((file) => file.replace(`.${currentFileExtension}`, ''));

const environments = [];

// Require each file.
for (const file of files) {
  // Skip if the file does not exist.
  if (!fs.existsSync(`${file}.${currentFileExtension}`)) {
    continue;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const data = require(file);

    // Skip if the file does not export anything.
    if (!data) {
      continue;
    }

    // Skip if the file has no default export.
    if (!data.default) {
      continue;
    }

    // Skip if the default export does not extend BaseEnvironment.
    if (!(data.default.prototype instanceof baseEnvironment)) {
      continue;
    }

    environments.push(data.default);
  } catch (e) {
    // Ignore errors.
  }
}

// Register each environment. (they have a .singleton getter, fetch it off the static class to register it)
for (const environment of environments) {
  environment?.singleton;
}
