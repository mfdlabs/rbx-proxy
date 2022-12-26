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
    File Name: lan_environment.ts
    Description: Environment variables for the Lan configuration.
    Written by: Nikita Petko
*/

import baseEnvironment from '@lib/environment/base_environment';

/**
 * Environment variables for the Lan configuration.
 */
export default class LanEnvironment extends baseEnvironment {
  private static _instance: LanEnvironment;

  /**
   * Represents the singleton instance of the LanEnvironment class.
   */
  public static get singleton(): LanEnvironment {
    return (this._instance ??= new LanEnvironment('lan'));
  }

  /**
   * Used by the deny local area network access middleware.
   *
   * This will determine if the proxy should be allowed to proxy requests that resolve the LAN IPs on the local network.
   */
  public get hateLocalAreaNetworkAccess(): boolean {
    return this.getOrDefault('HATE_LAN_ACCESS', false);
  }
}
