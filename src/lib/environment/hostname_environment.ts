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
    File Name: hostname_environment.ts
    Description: Environment variables for the Hostname configuration.
    Written by: Nikita Petko
*/

import baseEnvironment from '@lib/environment/base_environment';

/**
 * Environment variables for the Hostname configuration.
 */
export default class HostnameEnvironment extends baseEnvironment {
  private static _instance: HostnameEnvironment;

  /**
   * Represents the singleton instance of the HostnameEnvironment class.
   */
  public static get singleton(): HostnameEnvironment {
    return (this._instance ??= new HostnameEnvironment('hostname'));
  }

  /**
   * Used by the hostname resolution middleware.
   *
   * If true, we will try to strip out the port from the host header, as some clients will send the port in the host header.
   */
  public get hostnameResolutionMiddlewareStripPortFromHostHeader(): boolean {
    return this.getOrDefault('HOSTNAME_RESOLUTION_MIDDLEWARE_STRIP_PORT_FROM_HOST_HEADER', true);
  }

  /**
   * Used by the hostname resolution middleware.
   *
   * A regex to match Roblox test site domains.
   */
  public get robloxTestSiteDomainRegex(): RegExp {
    return this.getOrDefault(
      'ROBLOX_TEST_SITE_DOMAIN_REGEX',
      // eslint-disable-next-line no-useless-escape
      /(?<subdomains>(?<subdomain_no_postfix>[a-z0-9\.\-]{0,255})\.)?(?<environment>(site|game)test[1-5])\.(?<domain>(roblox(labs)?|simul(ping|pong|prod)))\.(?<tld>com|local)/gi,
    );
  }

  /**
   * Used by the hostname resolution middleware.
   *
   * A string that represents the Roblox Production Apex domain.
   */
  public get robloxProductionApexDomain(): string {
    return this.getOrDefault('ROBLOX_PRODUCTION_APEX_DOMAIN', 'roblox.com');
  }
}
