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
    File Name: GlobalEnvironment.ts
    Description: A class for loading environment variables from .env files programmatically.
    Written by: Nikita Petko
*/

import { DotENV } from './DotENV';
import { Convert } from './Convert';

/**
 * A class for loading environment variables from .env files programmatically.
 */
export abstract class GlobalEnvironment {
    /**
     * This is only ingested by the Logger class.
     *
     * If you set this environment variable, the logger will persist it's log files even if a clearance is requested.
     */
    public static get PersistLocalLogs(): bool {
        DotENV.Load();
        return Convert.ToBoolean(process.env.LOG_PERSIST, false);
    }

    /**
     * Used by the proxy all route catcher.
     *
     * This will determine if the proxy should be allowed to proxy requests that resolve the LAN IPs on the local network.
     */
    public static get HateLANAccess(): bool {
        DotENV.Load();
        return Convert.ToBoolean(process.env.HATE_LAN_ACCESS, false);
    }

    /**
     * Used by the proxy's crawler check handler.
     *
     * If false then the crawler check handler will not be called.
     */
    public static get ShouldCheckCrawler(): bool {
        DotENV.Load();
        return Convert.ToBoolean(process.env.SHOULD_CHECK_CRAWLER, true);
    }

    /**
     * Used by the proxy's cidr check handler.
     *
     * If false then the cidr check handler will not be called.
     */
    public static get ShouldCheckIP(): bool {
        DotENV.Load();
        return Convert.ToBoolean(process.env.SHOULD_CHECK_IP, true);
    }

    /**
     * Used by the proxy's cidr check handler.
     *
     * A list of IPv4 addresses that are allowed to access the proxy.
     */
    public static get AllowedIPv4Cidrs(): string[] {
        DotENV.Load();
        return process.env.ALLOWED_IPV4_CIDRS?.split(',') ?? [];
    }

    /**
     * Used by the proxy's cidr check handler.
     *
     * A list of IPv6 addresses that are allowed to access the proxy.
     */
    public static get AllowedIPv6Cidrs(): string[] {
        DotENV.Load();
        return process.env.ALLOWED_IPV6_CIDRS?.split(',') ?? [];
    }

    /**
     * Used by the proxy's crawler check handler.
     *
     * If true then the request will be aborted if a crawler is detected.
     */
    public static get AbortConnectionIfCrawler(): bool {
        DotENV.Load();
        return Convert.ToBoolean(process.env.ABORT_CONNECTION_IF_CRAWLER, false);
    }

    /**
     * Used by the proxy's cidr check handler.
     *
     * If true then the request will be aborted if the client's IP is not allowed.
     */
    public static get AbortConnectionIfInvalidIP(): bool {
        DotENV.Load();
        return Convert.ToBoolean(process.env.ABORT_CONNECTION_IF_INVALID_IP, false);
    }
}
