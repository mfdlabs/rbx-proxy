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
    File Name: loadBalancerInfoResponder.ts
    Description: This handler will be invoked when we want to show LB info to a health check route.
    Written by: Nikita Petko
*/

import webUtility from 'lib/utility/webUtility';

import net from '@mfdlabs/net';
import { Response } from 'express';

class LoadBalancerInfoResponder {
  /* This is really only used within ARC deploy scenarios. */

  /**
   * Invoke a standard ARC Load Balancer health check.
   * @param {Response} response The response object.
   * @param {boolean=} writeCustomResponse If true, we will write a custom response.
   * @param {boolean=} cacheControlHeaders If true, we will write cache control headers.
   * @param {boolean=} closeResponse If true, we will close the response.
   * @returns {void} Nothing.
   */
  public static invoke(
    response: Response,
    writeCustomResponse: boolean = false,
    cacheControlHeaders: boolean = true,
    closeResponse: boolean = false,
  ): void {
    if (cacheControlHeaders)
      response.header({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Connection: 'close',
        'Content-Type': 'text/html',
        Expires: '0',
        Pragma: 'no-cache',
      });

    if (process.env.MFDLABS_ARC_SERVER) {
      const serverResponse = `mfdlabs/arc-lb node ${
        process.version
      } (http://lb-services.ops-dev.vmminfra.dev/ui/machine/${webUtility.getMachineID()}/summary) (${webUtility.getMachineID()}->${net.getLocalIPv4()}::${net.getLocalIPv6()})`;

      response.header({
        Server: serverResponse,
        'X-LB-Service': `${webUtility.getMachineID()}->${net.getLocalIPv4()}::${net.getLocalIPv6()}`,
        'X-Powered-By': `mfdlabs/arc-lb node ${process.version}`,
      });

      if (writeCustomResponse) {
        response.status(200).send(serverResponse);
        return;
      }

      if (closeResponse) response.status(200).send();

      return;
    }

    response.header({
      Server: 'mfdlabs/rbx-proxy',
      'X-Powered-By': 'mfdlabs/rbx-proxy',
    });

    if (writeCustomResponse) {
      response.status(200).send(`mfdlabs/rbx-proxy healthy!`);
      return;
    }

    if (closeResponse) response.status(200).send();
  }
}

export = LoadBalancerInfoResponder;