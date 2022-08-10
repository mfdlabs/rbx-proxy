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
    File Name: index.ts
    Description: Extensions to the express request object.
    Written by: Nikita Petko
*/

export {};

import environment from '@lib/environment';
import webUtility from '@lib/utility/webUtility';
import googleAnalytics from '@lib/utility/googleAnalytics';

import * as tls from 'tls';
import * as express from 'express';

// Method: getSocket
// Description: Returns the socket of the request.
// Language: typescript
if (!express.request.hasOwnProperty('getSocket')) {
  Object.defineProperty(express.request, 'getSocket', {
    value: function getSocket() {
      return ((this.socket as any)?._spdyState?.parent as tls.TLSSocket) ?? this.socket;
    },
  });
}

// Method: getPort
// Description: Returns the port of the request.
// Language: typescript
if (!express.request.hasOwnProperty('localPort')) {
  Object.defineProperty(express.request, 'localPort', {
    get: function getLocalPort() {
      return this.getSocket().localPort;
    },
  });
}

// Method: context
// Description: Returns the context of the request.
// Language: typescript
if (!express.request.hasOwnProperty('_requestContext')) {
  Object.defineProperty(express.request, '_requestContext', {
    value: new Map(),
  });
}
if (!express.request.hasOwnProperty('context')) {
  Object.defineProperty(express.request, 'context', {
    get: function getContext() {
      return this._requestContext;
    },
  });
}

// Method: fireEvent
// Description: Fires a google analytics event.
// Language: typescript
if (!express.request.hasOwnProperty('fireEvent')) {
  Object.defineProperty(express.request, 'fireEvent', {
    value: async function fireEvent(action: string, label?: string) {
      if (!environment.requestExtensionsEnableGoogleAnalytics) return;

      // Set up the request context.
      const context = this.context;

      if (!context.has('ga')) {
        const obj = {
          category: `Proxy_${webUtility.generateUUIDV4()}`,
        } as any;

        obj.baseGaString = label;

        if (label === undefined) {
          let baseGaString = '';
          const headersAsString = Object.keys(this.headers)
            .map((key) => `${key}: ${this.headers[key]}`)
            .join('\n');
          const httpVersion = this.httpVersion;

          if (!environment.ga4DisableLoggingIPs)
            baseGaString = `Client ${this.ip}\n${this.method} ${this.originalUrl} ${httpVersion}\n${headersAsString}\n`;
          else
            baseGaString = `Client [redacted]\n${this.method} ${this.originalUrl} ${httpVersion}\n${headersAsString}\n`;

          if (!environment.ga4DisableLoggingBody) {
            const body = this.body?.toString() ?? '';

            if (body !== '[object Object]') {
              let truncatedBody = body.substring(0, 500);

              // if the length is less than the actual body length, add an ellipsis
              if (truncatedBody.length < body.length) truncatedBody += '...';

              baseGaString += `\n${truncatedBody}\n`;
            }
          }

          obj.baseGaString = baseGaString;
        }

        context.set('ga', obj);
      }

      const ga = context.get('ga');

      await googleAnalytics.fireServerEventGA4(ga.category, action, ga.baseGaString);
    },
  });
}

// Method: realIp
// Description: Returns the real ip of the request.
// Language: typescript
if (!express.request.hasOwnProperty('realIp')) {
  Object.defineProperty(express.request, 'realIp', {
    get: function getRealIp() {
      return this.socket ? this.getSocket().remoteAddress : this.connection?.remoteAddress;
    },
  });
}
