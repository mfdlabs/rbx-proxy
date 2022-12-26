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
	File Name: import_handler.ts
	Description: This file is a HACK to get Node to use the TypeScript base paths
	Written by: Nikita Petko
*/

export {};

import * as fs from 'fs';
import * as path from 'path';
import * as prometheus from 'prom-client';

const CH_PERIOD = 0x2e as const;
const CH_AT = 0x40 as const;

const baseUrl = path.dirname(require.main.filename);
const paths = require.main.paths;

const cache = {};

const moduleProto = Object.getPrototypeOf(module);
const origRequire = moduleProto.require;

const moduleDependencies = new prometheus.Gauge({
  name: 'module_dependencies',
  help: 'The parent dependencies of a module. Every time a module is imported, this metric is removed and then added again with the new parent dependencies.',
  labelNames: ['module_name', 'parent_module_dependency_names'],
});

const dependants = new Map<string, string[]>();

function convertFileToSourceName(file: string, isNodeModule: boolean = false, isCoreModule: boolean = false): string {
  // If it is under src/xxx.ts then we want to convert it to xxx.
  // If it is under src/lib/xxx.ts then we want to convert it to @lib/xxx. the same for subdirectories of lib like @lib/xxx/yyy.

  // convert \\ to / for windows
  file = file.replace(/\\/g, '/');

  const newBaseUrl = path.resolve(baseUrl, '..').replace(/\\/g, '/');

  // Remove the base url from the file. baseUrl is __dirname.
  file = file.replace(baseUrl.replace(/\\/g, '/'), '');
  file = file.replace(newBaseUrl, '');

  // Remove the .ts from the file.
  file = file.replace(/\.ts$/, '');

  // Remove the src/ from the file.
  file = file.replace(/^\/src/, '');

  // If it is under lib/ then we want to add @ to the start.
  file = file.replace(/^\/lib/, '@lib');

  // if relative path like ./xxx or ./lib/xxx make it xxx
  file = file.replace(/^\.\//, '');

  // Make sure it does not start with a /.
  file = file.replace(/^\//, '');

  // If the file ends in /index then remove it. If the file is only index then make it @entrypoint.
  file = file.replace(/\/index$/, '');
  file = file.replace(/^index$/, '@entrypoint');

  // if it is just the file on its own (no slashes) then make it @entrypoint/xxx
  if (!file.includes('/') && file !== '@entrypoint' && !isNodeModule && !isCoreModule) {
    file = '@entrypoint/' + file;
  }

  if (isNodeModule) {
    // Remove @ from the start.
    file = file.replace(/^@/, '');

    file = '@node_modules/' + file;
  }

  if (isCoreModule) {
    file = '@node/' + file;
  }

  return file;
}

function isNodeModule(file: string): boolean {
  const nodeModulePath = path.join(paths[1], file);

  return fs.existsSync(nodeModulePath);
}

function isCoreModule(file: string): boolean {
  // Is this part of nodejs? Like fs, path, etc.
  return require.resolve.paths(file) === null;
}

moduleProto.require = function (id: string) {
  let cachedPath = cache[id];
  const oldId = id;

  if (cachedPath === undefined) {
    cachedPath = '';

    // If the path is not like /home/user/test/file.js or ./file.js then we need to
    // search for the file in the paths.
    if (!path.isAbsolute(id) && id.charCodeAt(0) !== CH_PERIOD) {
      // If it starts with @ but isn't in node_modules, it's probably a file path.
      if (id.charCodeAt(0) === CH_AT) {
        // Normally the second string within paths is the node_modules path.
        const nodeModulesPath = paths[1];

        if (nodeModulesPath.includes('node_modules')) {
          // Join the nodeModules path with the request.
          const nodeModulePath = path.join(nodeModulesPath, id);

          // If it doesn't exist then remove the @ from the request as it's probably a file path.
          if (!fs.existsSync(nodeModulePath)) {
            id = id.slice(1);
          }
        }
      }

      const ext = path.extname(id);
      const basedRequest = path.join(baseUrl, ext ? id : id + '.js');

      if (fs.existsSync(basedRequest)) {
        // It exists at the specified path. Use that.
        cachedPath = basedRequest;
      } else {
        // It doesn't exist at the specified path.
        // See if it's a index.js file.

        const basedIndexRequest = path.join(baseUrl, id, 'index.js');

        cachedPath = fs.existsSync(basedIndexRequest) ? basedIndexRequest : '';
      }
    }
    cache[id] = cachedPath;
  }

  // determine the caller of require() (normally the 3rd stack frame)
  const stack = new Error().stack.split('at ');
  const frame = stack[3].trim();

  // It is in the format of "at XXX (FILE:LINE:COLUMN)", get the file path, allow accomodating for Windows paths which have a colon in them
  const callerPath = frame.substring(frame.lastIndexOf('(') + 1, frame.lastIndexOf(':'));

  // Ensure that the line and column numbers are removed
  const caller = callerPath.substring(0, callerPath.lastIndexOf(':'));

  // Only log if the caller is not from node_modules
  const nodeModulePath = paths[1];
  if (!caller.includes(nodeModulePath)) {
    const name = convertFileToSourceName(caller);

    const module = convertFileToSourceName(oldId, isNodeModule(oldId), isCoreModule(oldId));

    // Module is oldId and the dependant is caller

    // If the guage existed, we want to append the caller to the list of dependants
    if (dependants.has(module)) {
      // Ignore if the caller is already in the list of dependants
      if (!dependants.get(module).includes(name)) {
        const dependantList = dependants.get(module);
        const oldList = dependantList.join(',');

        dependantList.push(name);
        dependants.set(module, dependantList);

        // Rebuild the list of dependants, remove all the old ones and add the new ones
        moduleDependencies.remove(module, oldList);

        // Reregister the metric

        for (const [key, value] of dependants) {
          // value of guage is the count of dependants
          moduleDependencies.set({ module_name: key, parent_module_dependency_names: value.join(',') }, value.length);
        }
      }
    } else {
      // If the guage doesn't exist, we want to create it and add the caller to the list of dependants
      dependants.set(module, [name]);
      moduleDependencies.set({ module_name: module, parent_module_dependency_names: name }, 1);
    }
  }

  return origRequire.call(this, cachedPath || id);
};
//#endregion
