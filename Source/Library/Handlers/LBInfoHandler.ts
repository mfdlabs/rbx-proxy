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
    File Name: LBInfoHandler.ts
    Description: This handler will be invoked when we want to show LB info to a health check route.
    Written by: Nikita Petko
*/

import { NetworkingUtility } from 'Library/Util/NetworkingUtility';

import { Response } from 'express';

export class LBInfoHandler {
    /* This is really only used within ARC deploy scenarios. */
    public static Invoke(
        response: Response,
        writeCustomResponse: bool = false,
        cacheControlHeaders = true,
        closeResponse: bool = false,
    ): void {
        if (cacheControlHeaders)
            response.header({
                'Content-Type': 'application/json',
                Pragma: 'no-cache',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                Expires: '0',
                Connection: 'close',
            });

        if (process.env.MFDLABS_ARC_SERVER) {
            const serverResponse = `mfdlabs/arc-lb node ${
                process.version
            } (http://lb-services.ops-dev.vmminfra.dev/ui/machine/${NetworkingUtility.GetMachineID()}/summary) (${NetworkingUtility.GetMachineID()}->${NetworkingUtility.GetLocalIP()})`;

            response.header({
                Server: serverResponse,
                'X-Powered-By': `mfdlabs/arc-lb node ${process.version}`,
                'X-LB-Service': `${NetworkingUtility.GetMachineID()}->${NetworkingUtility.GetLocalIP()}`,
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
