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

import environment from '@lib/environment';

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Request } from 'express';

interface CorsRule {
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
   * A boolean to determine if credentials are allowed.
   *
   * Defaults to false.
   */
  allowCredentials: boolean;

  /**
   * An array of allowed headers.
   *
   * Defaults to an empty array.
   */
  allowedHeaders: string[];

  /**
   * An array of allowed methods.
   *
   * Defaults to an empty array.
   */
  allowedMethods: string[];

  /**
   * An array of allowed origins.
   *
   * If this is not specified, we will just use the Origin header from the request
   * if the field `allowRequestOriginIfNoAllowedOrigins` is true.
   */
  allowedOrigins: (RegExp | string)[];

  /**
   * An array of headers to expose.
   *
   * Defaults to an empty array.
   */
  exposedHeaders: string[];

  /**
   * An integer for the max age of the response.
   *
   * Defaults to undefined.
   */
  maxAge: number;

  /**
   * A boolean to determine if the Origin header from the request is allowed
   * if no allowed origins are specified.
   *
   * Defaults to false.
   */
  allowRequestOriginIfNoAllowedOrigins: boolean;

  /**
   * A boolean to determine if the response from the proxy can overwrite the
   * response headers except for the Access-Control-Allow-Origin header.
   *
   * Defaults to false.
   * @remarks This is useful for when you want to allow the proxy to overwrite
   */
  allowResponseHeadersOverwrite: boolean;
}

export default abstract class CorsWriter {
  private static _initialized: boolean = false;

  private static _corsRules: CorsRule[] = [];

  private static _removeRule(rule: CorsRule) {
    this._corsRules = this._corsRules.filter((r) => r !== rule);
  }

  private static _removeDuplicateRules() {
    const rules: CorsRule[] = [];

    this._corsRules.forEach((rule) => {
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
    });

    this._corsRules = rules;
  }

  /**
   * Initialize the CORS rules.
   * @returns {void} Nothing.
   */
  private static _initialize(): void {
    if (this._initialized && !environment.corsRulesReloadOnRequest) return;

    this._initialized = true;

    const corsFile = path.join(environment.corsRulesBaseDirectory, environment.corsRulesFileName);

    if (!fs.existsSync(corsFile)) return;

    const fileExtension = path.extname(corsFile);

    switch (fileExtension) {
      case '.json':
        this._corsRules = JSON.parse(fs.readFileSync(corsFile, 'utf8'));
        break;
      case '.yaml':
      case '.yml':
        this._corsRules = (yaml.load(fs.readFileSync(corsFile, 'utf8')) as CorsRule[]) ?? [];
        break;
      default:
        throw new Error(`Unsupported file extension: ${fileExtension}`);
    }

    // Validate the rules.
    for (const rule of this._corsRules) {
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

      if (typeof rule.allowCredentials !== 'boolean') rule.allowCredentials = false;
      if (typeof rule.allowRequestOriginIfNoAllowedOrigins !== 'boolean')
        rule.allowRequestOriginIfNoAllowedOrigins = false;
      if (typeof rule.allowResponseHeadersOverwrite !== 'boolean') rule.allowResponseHeadersOverwrite = false;

      if (!rule.allowedHeaders) rule.allowedHeaders = [];
      if (!Array.isArray(rule.allowedHeaders)) {
        this._removeRule(rule);
        continue;
      }

      if (!rule.allowedMethods) rule.allowedMethods = [];
      if (!Array.isArray(rule.allowedMethods)) {
        this._removeRule(rule);
        continue;
      }

      if (!rule.allowedOrigins) rule.allowedOrigins = [];
      if (!Array.isArray(rule.allowedOrigins)) {
        this._removeRule(rule);
        continue;
      }

      if (!rule.exposedHeaders) rule.exposedHeaders = [];
      if (!Array.isArray(rule.exposedHeaders)) {
        this._removeRule(rule);
        continue;
      }

      if (typeof rule.maxAge !== 'number') rule.maxAge = undefined;

      rule.method = rule.method.toLowerCase();
      rule.scheme = rule.scheme.toLowerCase();

      // Remove the everything after : in the scheme.
      rule.scheme = rule.scheme.split(':')[0];

      // Transform the methods to upper case.
      rule.allowedMethods = rule.allowedMethods.map((m) => m.toUpperCase());

      // If the allowed origins includes '*', then transform it to /^\*$/ and remove every other origin.#
      if (rule.allowedOrigins.includes('*')) {
        rule.allowedOrigins = [/^\*$/];
      }

      // Transform the origins to regex.
      rule.allowedOrigins = rule.allowedOrigins.map((o) => (o instanceof RegExp ? o : new RegExp(o)));

      // Remove the duplicates.
      rule.allowedHeaders = rule.allowedHeaders.filter((h, i) => rule.allowedHeaders.indexOf(h) === i);
      rule.allowedMethods = rule.allowedMethods.filter((m, i) => rule.allowedMethods.indexOf(m) === i);
      rule.allowedOrigins = rule.allowedOrigins.filter((o, i) => rule.allowedOrigins.indexOf(o) === i);
      rule.exposedHeaders = rule.exposedHeaders.filter((h, i) => rule.exposedHeaders.indexOf(h) === i);
    }

    this._removeDuplicateRules();
  }

  /**
   * Get the CORS rule for a request.
   * @param {Request} request The request to get the rule for.
   * @returns {CorsRule | undefined} The CORS rule for the request.
   */
  public static getRule(request: Request): CorsRule | undefined {
    this._initialize();

    const urlWithoutQueryString = request.originalUrl.replace(/\?.*/, '').replace(/\/$/, '');

    return this._corsRules.find((r) => {
      // routeTemplate is a regexp.
      const routeTemplate = r.routeTemplate as RegExp;

      if (!routeTemplate.test(urlWithoutQueryString)) return false;

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
}
