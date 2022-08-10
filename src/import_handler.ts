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

const CH_PERIOD = 0x2e as const;
const CH_AT = 0x40 as const;

const baseUrl = path.dirname(require.main.filename);
const paths = require.main.paths;

const cache = {};

const moduleProto = Object.getPrototypeOf(module);
const origRequire = moduleProto.require;

moduleProto.require = function (id: string) {
  let cachedPath = cache[id];

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
  return origRequire.call(this, cachedPath || id);
};
//#endregion
