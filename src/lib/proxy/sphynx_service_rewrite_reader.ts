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
    File Name: sphynx_service_rewrite_reader.ts
    Description: This will read configuration files from project root + /sphynxRewrite.[json|yaml|yml] and transform the url accordingly.
    Written by: Nikita Petko
*/

import environment from '@lib/environment';

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface SphynxHardcodeRewrite {
  template: RegExp | string;
  method: string;
  headers: { [key: string]: string };
  body: any;
  contentType: string;
  statusCode: number;
}

export default abstract class SphynxServiceRewriteReader {
  private static _initialized: boolean = false;

  private static _rewriteRules: { [key: string]: string } = {};
  private static _hardcodedResponseRules: SphynxHardcodeRewrite[] = [];

  /**
   * Initialize the rewrite rules.
   * @returns {void} Nothing.
   */
  private static _initialize(): void {
    if (this._initialized && !environment.sphynxRewriteReloadOnRequest) return;

    this._initialized = true;

    const rewriteFile = path.join(environment.sphynxRewriteBaseDirectory, environment.sphynxRewriteFileName);

    if (!fs.existsSync(rewriteFile)) return;

    // Determine if the file is json or yaml.
    const fileExtension = path.extname(rewriteFile);

    switch (fileExtension) {
      case '.json':
        this._rewriteRules = JSON.parse(fs.readFileSync(rewriteFile, 'utf8')) ?? {};
        break;
      case '.yaml':
      case '.yml':
        this._rewriteRules = (yaml.load(fs.readFileSync(rewriteFile, 'utf8')) as { [key: string]: string }) ?? {};
        break;
      default:
        throw new Error(`Unsupported file extension: ${fileExtension}`);
    }

    // Validate the rewrite rules.
    for (const key in this._rewriteRules) {
      if (!this._rewriteRules.hasOwnProperty(key)) continue;

      if (this._rewriteRules[key] === '') {
        throw new Error(`Rewrite rule for ${key} is empty.`);
      }
    }

    this._rewriteRules = Object.freeze(this._rewriteRules);

    // Now we need to check if there are any hardcoded responses.
    const hardcodedResponseFile = path.join(environment.sphynxRewriteBaseDirectory, environment.sphynxHardcodeFileName);

    if (!fs.existsSync(hardcodedResponseFile)) return;

    // Determine if the file is json or yaml.
    const hardcodedResponseFileExtension = path.extname(hardcodedResponseFile);

    switch (hardcodedResponseFileExtension) {
      case '.json':
        this._hardcodedResponseRules = JSON.parse(fs.readFileSync(hardcodedResponseFile, 'utf8')) ?? [];
        break;
      case '.yaml':
      case '.yml':
        this._hardcodedResponseRules =
          (yaml.load(fs.readFileSync(hardcodedResponseFile, 'utf8')) as SphynxHardcodeRewrite[]) ?? [];
        break;
      default:
        throw new Error(`Unsupported file extension: ${hardcodedResponseFileExtension}`);
    }

    for (const rule of this._hardcodedResponseRules) {
      if (!rule.template) {
        throw new Error(`Hardcoded response rule is missing template.`);
      }
      if (typeof rule.template === 'string') {
        rule.template = new RegExp(rule.template);
      }

      for (const key in rule.headers) {
        if (!rule.headers.hasOwnProperty(key)) continue;

        if (typeof rule.headers[key] !== 'string' && typeof rule.headers[key] !== 'number') {
          throw new Error(`Hardcoded response rule header ${key} is not a string or number.`);
        }
      }

      if (typeof rule.contentType !== 'string') {
        throw new Error(`Hardcoded response rule content type is not a string.`);
      }

      if (rule.statusCode === undefined) {
        rule.statusCode = 200;
      }
      if (typeof rule.statusCode !== 'number' || isNaN(rule.statusCode)) {
        throw new Error(`Hardcoded response rule status code is not a number.`);
      }

      if (!rule.method) {
        rule.method = 'all';
      } else {
        rule.method = rule.method.toLowerCase();
      }

      if (rule.body === undefined) {
        rule.body = '';
      }
    }
  }

  /**
   * Transforms the url.
   * @param {string} url The url to transform.
   * @returns {string} The transformed url.
   */
  public static transformUrl(url: string): string {
    this._initialize();

    // Normally sphynx service urls are in the form of:
    // https://apis.{environment}/{service}/{ocelotReroute}
    //
    // We want to replace that {service} with the rewrite rule.

    const serviceRegex = /^\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9-]+)/;

    const match = url.match(serviceRegex);

    if (!match) return url;

    const service = match[1];

    const rewriteRule = this._rewriteRules[service];

    if (!rewriteRule) return url;

    return url.replace(service, rewriteRule);
  }

  /**
   * Gets the hardcoded response for the given url.
   *
   * @param {string} url The url to get the hardcoded response for.
   * @returns {SphynxHardcodeRewrite} The hardcoded response.
   */
  public static getHardcodedResponse(method: string, url: string): SphynxHardcodeRewrite {
    this._initialize();

    // Remove query string from the url, and remove trailing slash.
    const urlWithoutQueryString = url.replace(/\?.*/, '').replace(/\/$/, '');

    // The template key is a regex that matches the url.
    const rule = this._hardcodedResponseRules.find(
      (r) =>
        (r.template as RegExp).test(urlWithoutQueryString) && (r.method === method.toLowerCase() || r.method === 'all'),
    );

    return rule;
  }
}
