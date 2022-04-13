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
    File Name: CidrCheck.ts
    Description: This handler will check if the request IP address is within an IPv4 or IPv6 CIDR range.
                 By default it will show a 403 Forbidden response if the IP address is not in the range,
                 but you can set it to abort the request instead.
    Written by: Nikita Petko
*/

import { Logger } from 'Library/Util/Logger';
import { GlobalEnvironment } from 'Library/Util/GlobalEnvironment';
import { NetworkingUtility } from 'Library/Util/NetworkingUtility';

import { RequestHandler } from 'express';

export const CidrCheckHandler = ((request, response, resumeFunction) => {
    if (!GlobalEnvironment.ShouldCheckIP) return resumeFunction();

    const allowedIPv4Cidrs = GlobalEnvironment.AllowedIPv4Cidrs;
    const allowedIPv6Cidrs = GlobalEnvironment.AllowedIPv6Cidrs;

    if (
        !NetworkingUtility.IsIPv4InCidrRangeList(request.ip, allowedIPv4Cidrs) &&
        !NetworkingUtility.IsIPv6InCidrRangeList(request.ip, allowedIPv6Cidrs)
    ) {
        Logger.Log(`IP '%s' is not in allowed CIDR list`, request.ip);

        if (GlobalEnvironment.AbortConnectionIfInvalidIP) {
            request.socket.destroy();
            return;
        }

        response
            .status(403)
            .header({
                'Content-Type': 'text/html',
                Pragma: 'no-cache',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                Expires: '0',
                Connection: 'close',
            })
            .send(
                `<html><body><h1>403 Forbidden</h1><p>IP Address validation failed. Your IP address is not allowed to access this site.</p></body></html>`,
            );

        return;
    }

    resumeFunction();
}) as RequestHandler;
