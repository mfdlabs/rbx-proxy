// This is a HACK to get node.js to use our typescript base paths.

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
