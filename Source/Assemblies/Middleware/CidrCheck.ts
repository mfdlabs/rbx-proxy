import { GlobalEnvironment } from 'Assemblies/Util/GlobalEnvironment';
import { Logger } from 'Assemblies/Util/LoggingUtility';
import { NetworkingUtility } from 'Assemblies/Util/NetworkingUtility';
import { RequestHandler } from 'express-serve-static-core';
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
            response.end();
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
