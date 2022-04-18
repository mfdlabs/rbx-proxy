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
    File Name: Logger.ts
    Description: This handler will log all incoming requests.
    Written by: Nikita Petko
*/

import { Logger } from 'Library/Util/Logger';

import net from '@mfdlabs/net';
import { RequestHandler } from 'express';

export const LoggingHandler = ((request, _response, resumeFunction) => {
    let lp: string;

    if (request.ip === '127.0.0.1') lp = '127.0.0.1';
    else if (request.ip === '::1') lp = '[::1]';
    else if (net.isIPv6(request.ip)) lp = `[${net.getLocalIPv6()}]`;
    else lp = net.getLocalIPv4();

    const forwardedPort = request.headers['x-forwarded-port'] as string;

    const port = forwardedPort ? parseInt(forwardedPort, 10) : request.socket.localPort;

    Logger.Log(
        `%s REQUEST ON %s://%s:%d%s ('%s') FROM '%s' (%s)`,
        request.method.toUpperCase(),
        request.protocol,
        lp,
        port,
        request.url,
        request.headers['host'] || 'No Host Header',
        request.headers['user-agent'] || 'No User Agent',
        request.ip,
    );

    resumeFunction();
}) as RequestHandler;
