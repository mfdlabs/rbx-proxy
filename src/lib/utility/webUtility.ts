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
    File Name: webUtility.ts
    Description: A lot of useful functions for working with networks, such as getting the external IP address, gateway, IP conversions, etc.
    Written by: Nikita Petko
*/

import * as os from 'os';

/**
 * A lot of useful functions for working with networks, such as getting the external IP address, gateway, IP conversions, etc.
 */
export default abstract class WebUtility {
  /**
   * A regex to match the request User-Agent as a potential bot.
   */
  private static readonly _crawlerRegex =
    /[Ss]lurp|[Tt]eoma|Scooter|Mercator|MSNBOT|Gulliver|[Ss]pider|[Aa]rchiver|[Cc]rawler|[Bb]ot[) \/_-]|Mediapartners-Google|[Pp]ython-(?=urllib|requests)|c[uU][rR][lL]|wxWidgets|facebookexternalhit|PowerShell|DOSarrest|Feedfetcher|Roblox diag2|BingPreview|Jakarta|LuaSocket|VortaxiaWebflow|ADmantX|A6-Indexer|Dalvik|Roblox\/WinHttp|Roblox\/WinInet$|Java\/1|^Get Request$|XaxisSemanticsClassifier|compatible;\\s+Synapse|^Google favicon$|SkypeUriPreview|[Ll]ynx|[Uu]ptime\\.com|package http|^expo9|WebIndex|ogic[Mm]onitor|HitLeap|StatusCake|statuscake/;

  /**
   * Generates a random UUIDv4 string.
   * @returns A random UUIDv4 string.
   */
  public static generateUUIDV4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Gets the machine ID for the current machine.
   * @returns	The machine ID for the current machine.
   */
  public static getMachineID() {
    return process.env.MFDLABS_MACHINE_ID || os.hostname();
  }

  /**
   * Determines if the input user-agent is a crawler.
   * @param {string} userAgent The user-agent to check.
   * @returns True if the user-agent is a crawler, false otherwise.
   */
  public static isCrawler(userAgent: string) {
    return this._crawlerRegex.test(userAgent);
  }
}
