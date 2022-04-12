import { Logger } from 'Assemblies/Util/LoggingUtility';
import { NetworkingUtility } from 'Assemblies/Util/NetworkingUtility';
import { RequestHandler } from 'express-serve-static-core';
export const LoggingHandler = ((request, _response, resumeFunction) => {
    let lp = '[::1]';

    if (request.ip === '127.0.0.1') lp = '127.0.0.1';
    else if (!NetworkingUtility.IsIPv6Loopback(request.ip)) lp = NetworkingUtility.GetLocalIP();

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
