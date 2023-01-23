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
  hostname: RegExp | string;

  /**
   * A string for the methods that are matching this result.
   *
   * @remarks If this is not specified, it will assume every method is allowed.
   * @remarks OPTIONS will always be added to the list of methods.
   */
  method: RegExp | string;

  /**
   * A string for the schemes that are matching this result.
   *
   * @remarks If this is not specified, it will assume every scheme is allowed.
   */
  scheme: string;

  /**
   * The weight of this rule.
   * @remarks The higher the weight, the higher the priority.
   */
  weight: number;

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
   * Variables to be passed into the body.
   *
   * Defaults to `{}`.
   */
  templateVariables: Record<string, unknown>;

  /**
   * The body to return.
   *
   * Defaults to `''`.
   */
  body: unknown;

  /**
   * Format the body. (prettify)
   *
   * Defaults to `false`.
   */
  formatBody: boolean;
}

export default abstract class HardcodedResponseWriter {
  private static _initialized = false;

  private static _rules: HardcodedResponseRule[] = [];

  private static _removeDuplicateRules() {
    const rules: HardcodedResponseRule[] = [];

    for (const rule of this._rules) {
      const index = rules.findIndex(
        (r) =>
          r.routeTemplate.toString() === rule.routeTemplate.toString() &&
          r.hostname.toString() === rule.hostname.toString() &&
          r.method.toString() === rule.method.toString() &&
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
      const rawRouteTemplate = rule.routeTemplate || '*';
      const rawHostname = rule.hostname || '*';
      const rawMethod = rule.method || '*';

      if (!rule.routeTemplate) rule.routeTemplate = /(.+)?/;
      if (rule.routeTemplate === '*') rule.routeTemplate = /(.+)?/;
      if (typeof rule.routeTemplate === 'string') {
        rule.routeTemplate = new RegExp(rule.routeTemplate);
      }

      if (!rule.hostname) rule.hostname = /(.+)?/;
      if (rule.hostname === '*') rule.hostname = /(.+)?/;
      if (typeof rule.hostname === 'string') {
        rule.hostname = new RegExp(rule.hostname);
      }

      if (!rule.method) rule.method = /(.+)?/;
      if (rule.method === '*') rule.method = /(.+)?/;
      if (typeof rule.method === 'string') {
        rule.method = new RegExp(rule.method);
      }

      if (!rule.scheme) rule.scheme = '*';
      if (typeof rule.scheme !== 'string') {
        rule.scheme = '*';
      }

      if (typeof rule.statusCode !== 'number') rule.statusCode = 200;
      if (typeof rule.headers !== 'object') rule.headers = {};
      if (typeof rule.templateVariables !== 'object') rule.templateVariables = {};
      if (typeof rule.formatBody !== 'boolean') rule.formatBody = false;
      if (typeof rule.weight !== 'number') rule.weight = 0;

      // Remove the everything after : in the scheme.
      rule.scheme = rule.scheme.split(':')[0];

      rule['_meta'] = {};
      rule['_meta']['_raw'] = {
        _routeTemplate: rawRouteTemplate,
        _hostname: rawHostname,
        _method: rawMethod,
      };
      rule['_meta']['_source'] = hardcodedResponsesFile;
      rule['_meta']['_id'] = this._uuidv4();
      rule['_meta']['_created'] = new Date().toISOString();
      rule['_meta']['_reloadOnRequest'] = hardcodeEnvironment.singleton.hardcodedResponseRulesReloadOnRequest;
    }

    this._removeDuplicateRules();
  }

  private static _uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0,
        v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Get the hardcoded response rule for a request.
   * @param {Request} request The request to get the rule for.
   * @returns {HardcodedResponseRule | undefined} The hardcoded response rule for the request.
   */
  public static getRule(request: Request): HardcodedResponseRule | undefined {
    this._initialize();

    // Get the rules that match the request.
    // The rules are sorted by weight and by how specific they are. The more specific rules are first.
    // e.g. /api/v1/users/1 is more specific than /api/v1/users/*
    const rules = this._rules
      .filter((rule) => {
        const routeTemplate = rule.routeTemplate as RegExp;
        const hostname = rule.hostname as RegExp;
        const method = rule.method as RegExp;

        return (
          routeTemplate.test(request.url) &&
          hostname.test(request.hostname) &&
          method.test(request.method) &&
          (rule.scheme === '*' || rule.scheme === request.protocol)
        );
      })
      .sort((a, b) => {
        const routeTemplateA = a.routeTemplate as RegExp;
        const routeTemplateB = b.routeTemplate as RegExp;

        const hostnameA = a.hostname as RegExp;
        const hostnameB = b.hostname as RegExp;

        const methodA = a.method as RegExp;
        const methodB = b.method as RegExp;

        const aSpecificity =
          (routeTemplateA.toString().match(/\//g) ?? []).length +
          (hostnameA.toString().match(/\//g) ?? []).length +
          (methodA.toString().match(/\//g) ?? []).length;
        const bSpecificity =
          (routeTemplateB.toString().match(/\//g) ?? []).length +
          (hostnameB.toString().match(/\//g) ?? []).length +
          (methodB.toString().match(/\//g) ?? []).length;

        if (aSpecificity === bSpecificity) {
          return b.weight - a.weight;
        }

        return bSpecificity - aSpecificity;
      });

    if (rules.length === 0) return undefined;

    return rules[0];
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
