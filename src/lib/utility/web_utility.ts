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
    File Name: web_utility.ts
    Description: A lot of useful functions for working with networks, such as getting the external IP address, gateway, IP conversions, etc.
    Written by: Nikita Petko
*/

import crawlerEnvironment from '@lib/environment/crawler_environment';

import * as os from 'os';

/**
 * A lot of useful functions for working with networks, such as getting the external IP address, gateway, IP conversions, etc.
 */
export default abstract class WebUtility {
  /**
   * Generates a random UUIDv4 string.
   * @returns {string} A random UUIDv4 string.
   */
  public static generateUUIDV4(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Gets the machine ID for the current machine.
   * @returns {string}	The machine ID for the current machine.
   */
  public static getMachineID(): string {
    return process.env.MFDLABS_MACHINE_ID || os.hostname();
  }

  /**
   * Determines if the input user-agent is a crawler.
   * @param {string} userAgent The user-agent to check.
   * @returns {boolean} True if the user-agent is a crawler, false otherwise.
   */
  public static isCrawler(userAgent: string): boolean {
    return crawlerEnvironment.singleton.commonCrawlerRegex.test(userAgent);
  }

  /**
   * Determines if the input user-agent is a browser.
   * @param {string} userAgent The user-agent to check.
   * @returns {boolean} True if the user-agent is a browser, false otherwise.
   * @remarks This function is not 100% accurate, but it's good enough for most cases.
   */
  public static isBrowser(userAgent: string): boolean {
    return crawlerEnvironment.singleton.knownBrowserRegex.test(userAgent);
  }
}
