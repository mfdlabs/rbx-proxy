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
	File Name: ImportHandler.ts
	Description: This file is a HACK to get Node to use the TypeScript base paths
	Written by: Nikita Petko
*/

import { isAbsolute, extname, join, dirname } from 'path';
import { existsSync } from 'fs';

export function ImportHandler() {
	//#region Hook on require() to resolve paths.
	(function () {
		const CH_PERIOD = 46;
		const baseUrl = dirname(process['mainModule'].filename);
		const existsCache = { d: 0 };
		delete existsCache.d;
		const moduleProto = Object.getPrototypeOf(module);
		const origRequire = moduleProto.require;
		moduleProto.require = function (request) {
			let existsPath = existsCache[request];
			if (existsPath === undefined) {
				existsPath = '';
				if (!isAbsolute(request) && request.charCodeAt(0) !== CH_PERIOD) {
					const ext = extname(request);
					const basedRequest = join(baseUrl, ext ? request : request + '.js');
					if (existsSync(basedRequest)) existsPath = basedRequest;
					else {
						const basedIndexRequest = join(baseUrl, request, 'index.js');
						existsPath = existsSync(basedIndexRequest) ? basedIndexRequest : '';
					}
				}
				existsCache[request] = existsPath;
			}
			return origRequire.call(this, existsPath || request);
		};
	})();
	//#endregion
}
