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
    File Name: ip_check_environment.ts
    Description: Environment variables for IP checks.
    Written by: Nikita Petko
*/

import baseEnvironment from '@lib/environment/base_environment';

/**
 * Environment variables for IP checks.
 */
export default class IpCheckEnvironment extends baseEnvironment {
  private static _instance: IpCheckEnvironment;

  /**
   * Represents the singleton instance of the IpCheckEnvironment class.
   */
  public static get singleton(): IpCheckEnvironment {
    return (this._instance ??= new IpCheckEnvironment('ip-check'));
  }

  /**
   * Used by the proxy's cidr check handler.
   *
   * If false then the cidr check handler will not be called.
   */
  public get shouldCheckIP(): boolean {
    return this.getOrDefault('SHOULD_CHECK_IP', false);
  }

  /**
   * Used by the proxy's cidr check handler.
   *
   * A list of IPv4 addresses that are allowed to access the proxy.
   */
  public get allowedIPv4Cidrs(): string[] {
    return this.getOrDefault('ALLOWED_IPV4_CIDRS', [], 'array<string>');
  }

  /**
   * Used by the proxy's cidr check handler.
   *
   * A list of IPv6 addresses that are allowed to access the proxy.
   */
  public get allowedIPv6Cidrs(): string[] {
    return this.getOrDefault('ALLOWED_IPV6_CIDRS', [], 'array<string>');
  }

  /**
   * Used by the proxy's cidr check handler.
   *
   * If true then the request will be aborted if the client's IP is not allowed.
   */
  public get abortConnectionIfInvalidIP(): boolean {
    return this.getOrDefault('ABORT_CONNECTION_IF_INVALID_IP', false);
  }
  
  /**
   * Used by the error middleware.
   *
   * A list of IPv4 addresses that are allowed to view source code.
   */
  public get allowedSourceViewersIPv4Cidrs(): string[] {
    return this.getOrDefault('ALLOWED_SOURCE_VIEWERS_IPV4_CIDRS', [], 'array<string>');
  }

  /**
   * Used by the error middleware.
   *
   * A list of IPv6 addresses that are allowed to view source code.
   */
  public get allowedSourceViewersIPv6Cidrs(): string[] {
    return this.getOrDefault('ALLOWED_SOURCE_VIEWERS_IPV6_CIDRS', [], 'array<string>');
  }
}
