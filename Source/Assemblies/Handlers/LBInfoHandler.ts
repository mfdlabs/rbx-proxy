import { Response } from 'express';
import { NetworkingUtility } from 'Assemblies/Util/NetworkingUtility';

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
