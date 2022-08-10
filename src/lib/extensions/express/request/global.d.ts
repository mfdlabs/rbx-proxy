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
    File Name: global.d.ts
    Description: Type definitions for extensions to the express request object.
    Written by: Nikita Petko
*/

export {};

import * as net from 'net';
import * as tls from 'tls';

declare global {
  namespace Express {
    interface Request {
      /**
       * Get the port of the request.
       * @returns {number} The port of the request.
       * @memberof Request
       */
      get localPort(): number;

      /**
       * Get the raw socket of the request.
       * @returns {net.Socket | tls.TLSSocket} The raw socket of the request.
       * @memberof Request
       */
       getSocket(): net.Socket | tls.TLSSocket;

      /**
       * A map of request context.
       *
       * @type {Map<string, any>}
       * @memberof Request
       */
      get context(): Map<string, any>;

      /**
       * Fires a google analytics event.
       *
       * @param {string} action The action of the event.
       * @param {string?} label The label of the event.
       * @memberof Request
       */
      fireEvent(action: string, label?: string): Promise<void>;

      /**
       * The current machine's NATed or physical WAN
       *
       * @type {string}
       * @memberof Request
       */
      get publicIp(): string;

      /**
       * The real IP of the request.
       * 
       * @type {string}
       * @memberof Request
       */
      get realIp(): string;
    }
  }
}
