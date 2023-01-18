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
    Description: Extensions to the express response object.
    Written by: Nikita Petko
*/

export {};

import loadBalancerResponder from '@lib/responders/load_balancer_responder';

import * as express from 'express';

/**
 * Manages the extensions to the express response object.
 * @param {express.Response} responsePrototype The express response object.
 * @returns {void} Nothing.
 */
export default function (responsePrototype: express.Response): void {
  if (!responsePrototype) return;

  // Method: noCache
  // Description: Sets the response to no cache.
  // Language: typescript
  if (!responsePrototype.hasOwnProperty('noCache')) {
    Object.defineProperty(responsePrototype, 'noCache', {
      value: function noCache() {
        this.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        this.setHeader('Pragma', 'no-cache');
        this.setHeader('Expires', '0');

        return this;
      },
    });
  }

  // Method: sendMessage
  // Description: Sends a message to the client.
  // Language: typescript
  if (!responsePrototype.hasOwnProperty('sendMessage')) {
    Object.defineProperty(responsePrototype, 'sendMessage', {
      value: function sendMessage(this: express.Response, ...args: any[]) {
        loadBalancerResponder.sendMessage(
          args[0],
          this.req,
          this,
          args[1],
          args[2],
          args[3],
          args[4],
          args[5],
          args[6],
        );
      },
    });
  }
}
