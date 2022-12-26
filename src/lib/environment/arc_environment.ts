/*
   Copyright 2022 Nikita Petko <petko@vmminfra.net>

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific arcguage governing permissions and
   limitations under the License.
*/

/*
    File Name: arc_environment.ts
    Description: Environment variables for the Arc configuration.
    Written by: Nikita Petko
*/

import baseEnvironment from '@lib/environment/base_environment';

/**
 * Environment variables for the Arc configuration.
 */
export default class ArcEnvironment extends baseEnvironment {
  private static _instance: ArcEnvironment;

  /**
   * Represents the singleton instance of the ArcEnvironment class.
   */
  public static get singleton(): ArcEnvironment {
    return (this._instance ??= new ArcEnvironment('arc'));
  }

  /**
   * Used by the load balancer info responder.
   *
   * This url represents the format for an ARC deploy machine information url.
   * @note This is only used in arc-deploy scenarios.
   */
  public get arcMachineInfoUrlFormat(): string {
    return this.getOrDefault('ARC_MACHINE_INFO_URL', 'http://lb-services.ops-dev.vmminfra.dev/ui/machine/%s/summary');
  }
}
