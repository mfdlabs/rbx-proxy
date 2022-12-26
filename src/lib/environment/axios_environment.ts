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
    File Name: axios_environment.ts
    Description: Environment variables for the proxy axios configuration.
    Written by: Nikita Petko
*/

import baseEnvironment from '@lib/environment/base_environment';

/**
 * Environment variables for the proxy axios configuration.
 */
export default class AxiosEnvironment extends baseEnvironment {
  private static _instance: AxiosEnvironment;

  /**
   * Represents the singleton instance of the AxiosEnvironment class.
   */
  public static get singleton(): AxiosEnvironment {
    return (this._instance ??= new AxiosEnvironment('axios'));
  }

  /**
   * Used by the send axios request middleware.
   *
   * If true, we will send the request with x-forwarded headers.
   */
  public get sendAxiosRequestWithForwardedHeaders(): boolean {
    return this.getOrDefault('SEND_AXIOS_REQUEST_WITH_FORWARDED_HEADERS', true);
  }

  /**
   * Used by the send axios request middleware.
   *
   * Specifies the max amount of time to wait for a response from the server.
   * @note This is in milliseconds.
   */
  public get sendAxiosRequestTimeout(): number {
    return this.getOrDefault('SEND_AXIOS_REQUEST_TIMEOUT', 35000);
  }
  
  /**
   * Used by the send axios request middleware.
   *
   * If true, we will just echo back the request configuration to be passed to axios.
   */
  public get debugEchoRequestConfig(): boolean {
    return this.getOrDefault('DEBUG_ECHO_REQUEST_CONFIG', false);
  }
  
  /**
   * Used by the send axios request middleware.
   *
   * If true, then certificate validation will be enabled.
   */
  public get enableCertificateValidation(): boolean {
    return this.getOrDefault('ENABLE_CERTIFICATE_VALIDATION', false); // False here because there's no reason to enable it by default.
  }
}
