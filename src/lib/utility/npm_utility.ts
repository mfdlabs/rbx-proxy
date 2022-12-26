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
    File Name: npm_utility.ts
    Description: A utility class for npm.
    Written by: Nikita Petko
*/

import * as fs from 'fs';
import * as path from 'path';

/**
 * Represents a package.json file.
 * @interface
 */
export interface PackageJson {
  /**
   * The name of the package.
   */
  name: string;

  /**
   * The version of the package.
   */
  version: string;

  /**
   * The description of the package.
   * @optional
   */
  description?: string;

  /**
   * The main file of the package.
   * @optional
   */
  main?: string;

  /**
   * The types file of the package.
   * @optional
   */
  types?: string;

  /**
   * The scripts of the package.
   * @optional
   */
  scripts?: { [key: string]: string };

  /**
   * The keywords of the package.
   * @optional
   */
  keywords?: string[];

  /**
   * The author of the package.
   * @optional
   */
  author?: string;

  /**
   * The license of the package.
   * @optional
   */
  license?: string;

  /**
   * The bugs of the package.
   * @optional
   */
  bugs?: { [key: string]: string };

  /**
   * The homepage of the package.
   * @optional
   */
  homepage?: string;

  /**
   * The dependencies of the package.
   * @optional
   */
  dependencies?: { [key: string]: string };

  /**
   * The devDependencies of the package.
   * @optional
   */
  devDependencies?: { [key: string]: string };

  /**
   * The peerDependencies of the package.
   * @optional
   */
  peerDependencies?: { [key: string]: string };

  /**
   * The optionalDependencies of the package.
   * @optional
   */
  optionalDependencies?: { [key: string]: string };

  /**
   * The engines of the package.
   * @optional
   */
  engines?: { [key: string]: string };

  /**
   * The os of the package.
   * @optional
   */
  os?: string[];

  /**
   * The cpu of the package.
   * @optional
   */
  cpu?: string[];

  /**
   * The preferGlobal of the package.
   * @optional
   */
  preferGlobal?: boolean;

  /**
   * The private of the package.
   * @optional
   */
  private?: boolean;

  /**
   * The publishConfig of the package.
   * @optional
   */
  publishConfig?: { [key: string]: string };

  /**
   * The bin of the package.
   * @optional
   */
  bin?: { [key: string]: string };
}

/**
 * Reads the package.json file.
 * @returns {PackageJson} The package.json file.
 */
export function readPackageJson(): PackageJson {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'package.json'), 'utf8'));
}
