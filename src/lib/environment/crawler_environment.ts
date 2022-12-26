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
    File Name: crawler_environment.ts
    Description: Environment variables for the Crawler configuration.
    Written by: Nikita Petko
*/

import baseEnvironment from '@lib/environment/base_environment';

/**
 * Environment variables for the Crawler configuration.
 */
export default class CrawlerEnvironment extends baseEnvironment {
  private static _instance: CrawlerEnvironment;

  /**
   * Represents the singleton instance of the CrawlerEnvironment class.
   */
  public static get singleton(): CrawlerEnvironment {
    return (this._instance ??= new CrawlerEnvironment('crawler'));
  }

  /**
   * Used by the proxy's crawler check handler.
   *
   * If false then the crawler check handler will not be called.
   */
  public get shouldCheckCrawler(): boolean {
    return this.getOrDefault('SHOULD_CHECK_CRAWLER', false);
  }

  /**
   * Used by the proxy's crawler check handler.
   *
   * If true then the request will be aborted if a crawler is detected.
   */
  public get abortConnectionIfCrawler(): boolean {
    return this.getOrDefault('ABORT_CONNECTION_IF_CRAWLER', false);
  }
  
  /**
   * Used by the web utility.
   *
   * A regex that matches common crawlers.
   */
  public get commonCrawlerRegex(): RegExp {
    return this.getOrDefault(
      'COMMON_CRAWLER_REGEX',
      /[Ss]lurp|[Tt]eoma|Scooter|Mercator|MSNBOT|Gulliver|[Ss]pider|[Aa]rchiver|[Cc]rawler|[Bb]ot[) /_-]|Mediapartners-Google|[Pp]ython-(?=urllib|requests)|c[uU][rR][lL]|wxWidgets|facebookexternalhit|PowerShell|DOSarrest|Feedfetcher|Roblox diag2|BingPreview|Jakarta|LuaSocket|VortaxiaWebflow|ADmantX|A6-Indexer|Dalvik|Roblox\/WinHttp|Roblox\/WinInet$|Java\/1|^Get Request$|XaxisSemanticsClassifier|compatible;\\s+Synapse|^Google favicon$|SkypeUriPreview|[Ll]ynx|[Uu]ptime\\.com|package http|^expo9|WebIndex|ogic[Mm]onitor|HitLeap|StatusCake|statuscake/,
    );
  }
  
  /**
   * Used by the web utility.
   *
   * A regex that mathes user agents that are known browsers.
   */
  public get knownBrowserRegex(): RegExp {
    return this.getOrDefault(
      'KNOWN_BROWSER_REGEX',
      /Edge?\/(10[5-9]|1[1-9]\d|[2-9]\d{2}|\d{4,})(\.\d+|)(\.\d+|)|Firefox\/(10[2-9]|1[1-9]\d|[2-9]\d{2}|\d{4,})\.\d+(\.\d+|)|Chrom(ium|e)\/(10[5-9]|1[1-9]\d|[2-9]\d{2}|\d{4,})\.\d+(\.\d+|)|Maci.* Version\/(15\.([6-9]|\d{2,})|(1[6-9]|[2-9]\d|\d{3,})\.\d+)([,.]\d+|)( Mobile\/\w+|) Safari\/|Chrome.+OPR\/(9\d|\d{3,})\.\d+\.\d+|(CPU[ +]OS|iPhone[ +]OS|CPU[ +]iPhone|CPU IPhone OS|CPU iPad OS)[ +]+(14[._]([5-9]|\d{2,})|(1[5-9]|[2-9]\d|\d{3,})[._]\d+)([._]\d+|)|Opera Mini|Android:?[ /-](10[7-9]|1[1-9]\d|[2-9]\d{2}|\d{4,})(\.\d+|)(\.\d+|)|Mobile Safari.+OPR\/(6[4-9]|[7-9]\d|\d{3,})\.\d+\.\d+|Android.+Firefox\/(10[6-9]|1[1-9]\d|[2-9]\d{2}|\d{4,})\.\d+(\.\d+|)|Android.+Chrom(ium|e)\/(10[7-9]|1[1-9]\d|[2-9]\d{2}|\d{4,})\.\d+(\.\d+|)|Android.+(UC? ?Browser|UCWEB|U3)[ /]?(13\.([4-9]|\d{2,})|(1[4-9]|[2-9]\d|\d{3,})\.\d+)\.\d+|SamsungBrowser\/(1[7-9]|[2-9]\d|\d{3,})\.\d+|Android.+MQ{2}Browser\/(13(\.([1-9]|\d{2,})|)|(1[4-9]|[2-9]\d|\d{3,})(\.\d+|))(\.\d+|)|K[Aa][Ii]OS\/(2\.([5-9]|\d{2,})|([3-9]|\d{2,})\.\d+)(\.\d+|)/,
    );
  }

}
