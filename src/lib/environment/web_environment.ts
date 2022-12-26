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
    File Name: web_environment.ts
    Description: Environment variables for the web server configuration.
    Written by: Nikita Petko
*/

import { projectDirectoryName } from '@lib/directories';
import baseEnvironment from '@lib/environment/base_environment';

import * as path from 'path';

/**
 * Environment variables for the web server configuration.
 */
export default class WebEnvironment extends baseEnvironment {
  private static _instance: WebEnvironment;

  /**
   * Represents the singleton instance of the WebEnvironment class.
   */
  public static get singleton(): WebEnvironment {
    return (this._instance ??= new WebEnvironment('web'));
  }

  /**
   * Used by the entry point.
   *
   * If true, we will log startup information.
   */
  public get logStartupInfo(): boolean {
    return this.getOrDefault('LOG_STARTUP_INFO', false);
  }

  /**
   * Used by the entry point.
   *
   * If true, we will disable IPv6 support.
   */
  public get disableIPv6(): boolean {
    return this.getOrDefault('DISABLE_IPV6', false);
  }

  /**
   * Used by the entry point.
   *
   * This value will determine the bind port for insecure servers.
   */
  public get insecurePort(): number {
    return this.getOrDefault('INSECURE_PORT', 80);
  }

  /**
   * Used by the entry point.
   *
   * This value will determine the bind port for secure servers.
   */
  public get securePort(): number {
    return this.getOrDefault('SECURE_PORT', 443);
  }

  /**
   * Used by the entry point.
   *
   * If true, we will enable the TLS server.
   */
  public get enableSecureServer(): boolean {
    return this.getOrDefault('ENABLE_TLS_SERVER', true);
  }

  /**
   * Used by the entry point.
   *
   * This value will determine the bind address for IPv4 servers.
   */
  public get bindAddressIPv4(): string {
    return this.getOrDefault('BIND_ADDRESS_IPV4', '0.0.0.0');
  }

  /**
   * Used by the entry point.
   *
   * This value will determine the bind address for IPv6 servers.
   */
  public get bindAddressIPv6(): string {
    return this.getOrDefault('BIND_ADDRESS_IPV6', '::');
  }

  /**
   * Used by the entry point.
   *
   * If true, we will enable the TLS V2
   */
  public get enableTLSv2(): boolean {
    return this.getOrDefault('ENABLE_TLSV2', false);
  }

  /**
   * Used by the entry point.
   *
   * This value will determine the root directory for ssl certificates.
   * If not present, then the default will be `{projectDirectory}/ssl`.
   */
  public get sslBaseDirectory(): string {
    return this.getOrDefault('SSL_BASE_DIRECTORY', path.join(projectDirectoryName, 'ssl'));
  }

  /**
   * Used by the entry point.
   *
   * Determines the file name for the ssl certificate.
   * If this is not present it will throw an error.
   * @throws {Error} The environment variable SSL_CERTIFICATE_FILE_NAME is not set.
   */
  public get sslCertificateFileName(): string {
    return this.getOrDefault<string>('SSL_CERTIFICATE_FILE_NAME', () => {
      throw new Error('SSL_CERTIFICATE_FILE_NAME is not set.');
    });
  }

  /**
   * Used by the entry point.
   *
   * Determines the file name for the ssl key.
   * If this is not present it will throw an error.
   * @throws {Error} The environment variable SSL_KEY_FILE_NAME is not set.
   */
  public get sslKeyFileName(): string {
    return this.getOrDefault<string>('SSL_KEY_FILE_NAME', () => {
      throw new Error('SSL_KEY_FILE_NAME is not set.');
    });
  }

  /**
   * Used by the entry point.
   *
   * Optional certificate chain file name.
   */
  public get sslCertificateChainFileName(): string {
    return this.getOrDefault('SSL_CERTIFICATE_CHAIN_FILE_NAME', null, 'string');
  }

  /**
   * Used by the entry point.
   *
   * Optional passphrase for the ssl key.
   */
  public get sslKeyPassphrase(): string {
    return this.getOrDefault('SSL_KEY_PASSPHRASE', null, 'string');
  }
}
