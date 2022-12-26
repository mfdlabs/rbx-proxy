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
    File Name: cors_writer.ts
    Description: This will write the CORS headers to the response.
    Written by: Nikita Petko
*/

import hardcodeEnvironment from '@lib/environment/hardcode_environment';

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Request } from 'express';

interface HardcodedResponseRule {
  //////////////////////////////////////////////////////////////////////////////
  // Resolution section.
  //
  // This section is used to determine what conditions are met to allow the
  // this configuration to be used.
  //////////////////////////////////////////////////////////////////////////////

  /**
   * A regexp that matches the request url.
   *
   * Defaults to `/.+/`.
   */
  routeTemplate: RegExp | string;

  /**
   * A string for the hosts that are matching this result.
   *
   * @remarks If this is not specified, it will assume every host is allowed.
   */
  hostname: string;

  /**
   * A string for the methods that are matching this result.
   *
   * @remarks If this is not specified, it will assume every method is allowed.
   * @remarks OPTIONS will always be added to the list of methods.
   */
  method: string;

  /**
   * A string for the schemes that are matching this result.
   *
   * @remarks If this is not specified, it will assume every scheme is allowed.
   */
  scheme: string;

  /////////////////////////////////////////////////////////////////////////////
  // Response section.
  //
  // This section is used to determine what the response will be.
  /////////////////////////////////////////////////////////////////////////////

  /**
   * The status code to return.
   *
   * Defaults to `200`.
   */
  statusCode: number;

  /**
   * The headers to return.
   *
   * Defaults to `{}`.
   */
  headers: Record<string, string>;

  /**
   * The body to return.
   *
   * Defaults to `''`.
   */
  body: unknown;
}

export default abstract class HardcodedResponseWriter {
  private static _initialized = false;

  private static _rules: HardcodedResponseRule[] = [];

  private static _removeRule(rule: HardcodedResponseRule) {
    this._rules = this._rules.filter((r) => r !== rule);
  }

  private static _removeDuplicateRules() {
    const rules: HardcodedResponseRule[] = [];

    for (const rule of this._rules) {
      const index = rules.findIndex(
        (r) =>
          r.routeTemplate.toString() === rule.routeTemplate.toString() &&
          r.hostname === rule.hostname &&
          r.method === rule.method &&
          r.scheme === rule.scheme,
      );

      if (index === -1) {
        rules.push(rule);
      }
    }

    this._rules = rules;
  }

  private static _initialize() {
    if (this._initialized && !hardcodeEnvironment.singleton.hardcodedResponseRulesReloadOnRequest) return;

    this._initialized = true;

    const hardcodedResponsesFile = path.join(
      hardcodeEnvironment.singleton.hardcodedResponseRulesBaseDirectory,
      hardcodeEnvironment.singleton.hardcodedResponseRulesFileName,
    );

    if (!fs.existsSync(hardcodedResponsesFile)) return;

    const fileExtension = path.extname(hardcodedResponsesFile);

    switch (fileExtension) {
      case '.json':
        this._rules = JSON.parse(fs.readFileSync(hardcodedResponsesFile, 'utf8'));
        break;
      case '.yaml':
      case '.yml':
        this._rules = (yaml.load(fs.readFileSync(hardcodedResponsesFile, 'utf8')) as HardcodedResponseRule[]) ?? [];
        break;
      default:
        throw new Error(`Unsupported file extension: ${fileExtension}`);
    }

    for (const rule of this._rules) {
      if (!rule.routeTemplate) {
        rule.routeTemplate = /(.+)?/;
      }
      if (typeof rule.routeTemplate === 'string') {
        rule.routeTemplate = new RegExp(rule.routeTemplate);
      }

      if (!rule.hostname) rule.hostname = '*';
      if (typeof rule.hostname !== 'string') {
        this._removeRule(rule);
        continue;
      }

      if (!rule.method) rule.method = '*';
      if (typeof rule.method !== 'string') {
        this._removeRule(rule);
        continue;
      }

      if (!rule.scheme) rule.scheme = '*';
      if (typeof rule.scheme !== 'string') {
        this._removeRule(rule);
        continue;
      }

      if (typeof rule.statusCode !== 'number') rule.statusCode = 200;
      if (typeof rule.headers !== 'object') rule.headers = {};

      rule.method = rule.method.toLowerCase();
      rule.scheme = rule.scheme.toLowerCase();

      // Remove the everything after : in the scheme.
      rule.scheme = rule.scheme.split(':')[0];
    }

    this._removeDuplicateRules();
  }

  /**
   * Get the hardcoded response rule for a request.
   * @param {Request} request The request to get the rule for.
   * @returns {HardcodedResponseRule | undefined} The hardcoded response rule for the request.
   */
  public static getRule(request: Request): HardcodedResponseRule | undefined {
    this._initialize();

    return this._rules.find((r) => {
      // routeTemplate is a regexp.
      const routeTemplate = r.routeTemplate as RegExp;

      if (!routeTemplate.test(request.originalUrl)) return false;

      // hostname is a string.
      const hostname = r.hostname as string;

      if (hostname !== '*' && hostname !== request.hostname) return false;

      // method is a string.
      const method = r.method as string;

      if (method !== '*' && method !== request.method.toLowerCase()) return false;

      // scheme is a string.
      const scheme = r.scheme as string;

      if (scheme !== '*' && scheme !== request.protocol.replace(/:$/, '')) return false;

      return true;
    });
  }

  /**
   * Checks if the current request has a hardcoded response rule.
   * @param {Request} request The request to check.
   * @returns {boolean} True if the request has a hardcoded response rule.
   */
  public static hasRule(request: Request): boolean {
    return !!this.getRule(request);
  }
}
