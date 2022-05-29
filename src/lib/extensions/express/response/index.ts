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

import * as express from 'express';

// Method: noCache
// Description: Sets the response to no cache.
// Language: typescript
if (!express.response.hasOwnProperty('noCache')) {
  Object.defineProperty(express.response, 'noCache', {
    value: function noCache() {
      this.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      this.setHeader('Pragma', 'no-cache');
      this.setHeader('Expires', '0');

      return this;
    },
  });
}