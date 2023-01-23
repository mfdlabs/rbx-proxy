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
    File Name: hardcoded_response_middleware.ts
    Description: This middleware will return a hardcoded response if the request matches a rule.
    Written by: Nikita Petko
*/

/* eslint-disable no-case-declarations */

import hardcodedResponseWriter from '@lib/writers/hardcoded_response_writer';
import hardcodedResponseMiddlewareLogger from '@lib/loggers/middleware/hardcoded_response_middleware_logger';
import * as hardcodedResponseMiddlewareMetrics from '@lib/metrics/middleware/hardcoded_response_middleware_metrics';

import * as os from 'os';
import * as math from 'mathjs';
import * as yaml from 'js-yaml';
import { NextFunction, Request, Response } from 'express';

export default class HardcodedResponseMiddleware {
  /**
   * Invokes the middleware.
   * @param {Request} request The request object.
   * @param {Response} response The response object.
   * @param {NextFunction} next The next function to call.
   * @returns {void} Nothing.
   */
  public static invoke(request: Request, response: Response, next: NextFunction): void {
    const hardcodedResponse = hardcodedResponseWriter.getRule(request);

    if (hardcodedResponse) {
      hardcodedResponseMiddlewareLogger.information(
        "Found hardcoded response on path '%s', returning it.",
        request.path,
      );
      request.fireEvent('HardcodedResponse');

      const debugEchoHardcodedResponse =
        (this._header(request, 'x-debug-response')?.[0] || this._query(request, '__debug_response')?.[0]) === 'true';
      if (debugEchoHardcodedResponse) {
        hardcodedResponseMiddlewareLogger.information(
          "Found 'x-debug-response' header, echoing the hardcoded response.",
        );

        hardcodedResponse.routeTemplate = hardcodedResponse['_meta']['_raw']['_routeTemplate'];
        hardcodedResponse.hostname = hardcodedResponse['_meta']['_raw']['_hostname'];
        hardcodedResponse.method = hardcodedResponse['_meta']['_raw']['_method'];

        hardcodedResponse.body = JSON.stringify(hardcodedResponse.body, null, 2);

        delete hardcodedResponse['_meta']['_raw'];

        response.header({
          'x-hardcoded-response-template': hardcodedResponse.routeTemplate.toString(),
          'content-type': 'text/yaml; charset=utf-8',
        });
        response.status(200);

        const body: string = yaml.dump(hardcodedResponse, {
          lineWidth: 1000,
          noRefs: true,
          skipInvalid: true,
        });
        response.send(`# Yaml representation of the hardcoded response.\n\n${body}`);

        return;
      }

      hardcodedResponseMiddlewareMetrics.hardcodedResponses.inc({
        method: request.method,
        hostname: request.headers.host || 'No Host Header',
        endpoint: request.path,
        template: hardcodedResponse.routeTemplate.toString(),
        caller: request.ip,
      });

      response.header({
        ...hardcodedResponse.headers,

        'x-hardcoded-response-template': hardcodedResponse.routeTemplate.toString(),
      });
      response.status(hardcodedResponse.statusCode);

      if (hardcodedResponse.body !== undefined && hardcodedResponse.body !== null && hardcodedResponse.body !== '') {
        let body: string =
          hardcodedResponse.body instanceof Object
            ? JSON.stringify(hardcodedResponse.body)
            : hardcodedResponse.body?.toString();

        const externalVars = new Map<string, any>(
          Object.entries(hardcodedResponse.templateVariables).map(([key, value]) => [key, value]),
        );
        const externalVarsCopy = new Map<string, any>(externalVars); // Prevents infinite loops.
        const actualExternalVars = new Map<string, any>();

        if (externalVars.size > 0)
          for (let [key, value] of externalVars) {
            key = this._replaceBodyTemplate(
              hardcodedResponse.routeTemplate as RegExp,
              key.replace(/\n/g, '').replace(/\s+/g, ' '),
              request,
              externalVarsCopy,
              true,
            );
            if (typeof value === 'string')
              value = this._replaceBodyTemplate(
                hardcodedResponse.routeTemplate as RegExp,
                value.replace(/\n/g, '').replace(/\s+/g, ' '),
                request,
                externalVarsCopy,
                true,
              );

            actualExternalVars.set(key, value);
          }

        // Put whatever was in the copy back into the original.
        for (const [key, value] of externalVarsCopy)
          if (!actualExternalVars.has(key)) actualExternalVars.set(key, value);

        body = HardcodedResponseMiddleware._replaceBodyTemplate(
          hardcodedResponse.routeTemplate as RegExp,
          body,
          request,
          actualExternalVars,
        );

        if (hardcodedResponse.formatBody && hardcodedResponse.body instanceof Object) {
          body = JSON.stringify(JSON.parse(body), null, 2);
        }

        response.header('content-length', Buffer.byteLength(body as string).toString());
        response.end(body);
      } else response.end();

      return;
    }

    next();
  }

  // Helper for body templates.
  // Example:
  // {
  //   "message": "Hello World!"
  //   "timestamp": "{{query.timestamp}}" // This will be replaced with the value of the query parameter "timestamp".
  // }
  // Example 2:
  // {
  //   "message": "Hello World!"
  //   "timestamp": "{{body.timestamp}}" // This will be replaced with the value of the body parameter "timestamp".
  // }
  // Example 3:
  // {
  //   "message": "Hello World!"
  //   "timestamp": "{{path.timestamp}}" // This will be replaced with the value of the path parameter. This has to be a named group on the route regex pattern.
  // }
  // Example 4:
  // {
  //   "message": "Hello World!"
  //   "someNumber": "{{path.someNumber | parseInt}}" // This will be replaced with the value of the path parameter. This has to be a named group on the route regex pattern. The value will be parsed as an integer.
  // }
  // Example 5:
  // {
  //   "message": "Hello World!"
  //   "someNumber": "{{path.someNumber | parseFloat}}" // This will be replaced with the value of the path parameter. This has to be a named group on the route regex pattern. The value will be parsed as a float.
  // }
  // Example 6:
  // {
  //   "message": "Hello World!"
  //   "someNumber": "{{header['some-header']}}" // This will be replaced with the value of the header "some-header".
  // }
  private static _replaceBodyTemplate(
    routeTemplate: RegExp,
    body: string,
    request: Request,
    externalVars: Map<string, any>,
    updateExternalVars: boolean = false,
  ): string {
    const queryRegex = /{{query\.([a-zA-Z0-9-_]+)}}/;
    body = this._replaceBodyExpression(
      body,
      queryRegex,
      '',
      request,
      routeTemplate,
      externalVars,
      (match) => {
        const key = match[1];
        const value = this._query(request, key);

        return value?.[0] || '';
      },
      updateExternalVars,
    );
	
	const varRegex = /{{var\.([a-zA-Z0-9-_]+)}}/;
    body = this._replaceBodyExpression(
      body,
      varRegex,
      '',
      request,
      routeTemplate,
      externalVars,
      (match, _av, vars) => {
        const key = match[1];
        const value = vars.get(key);

        return value || '';
      },
      updateExternalVars,
    );

    const bodyRegex = /{{body\.([a-zA-Z0-9-_]+)}}/;
    body = this._replaceBodyExpression(
      body,
      bodyRegex,
      '',
      request,
      routeTemplate,
      externalVars,
      (match) => {
        const key = match[1];

        // Body is Buffer, check Content-Type header to parse to either JSON or form data.
        const contentType = this._header(request, 'content-type');
        let body = {};

        switch (contentType[0]) {
          case 'application/json':
            body = JSON.parse(request.body.toString());
            break;
          case 'text/json':
            body = JSON.parse(request.body.toString());
            break;
          case 'application/x-www-form-urlencoded':
            body = request.body
              .toString()
              .split('&')
              .reduce((acc, pair) => {
                const [key, value] = pair.split('=');
                acc[key] = value;
                return acc;
              }, {});
            break;
          default:
            throw new Error(`Cannot replace body template, unparsable content type: ${contentType}`);
        }

        const value = body[key];

        return value || '';
      },
      updateExternalVars,
    );

    const pathRegex = /{{path\.([a-zA-Z0-9-_]+)}}/;
    body = this._replaceBodyExpression(body, pathRegex, '', request, routeTemplate, externalVars, (match) => {
      const key = match[1];
      const routeTemplateMatch = routeTemplate.exec(request.path);

      const value = routeTemplateMatch?.groups?.[key];

      return value || '';
    });

    const headerRegex = /{{header\[(['"])([a-zA-Z0-9-_]+)\1\]}}/;
    body = this._replaceBodyExpression(
      body,
      headerRegex,
      '',
      request,
      routeTemplate,
      externalVars,
      (match) => {
        const key = match[2];
        const value = this._header(request, key);

        return value?.[0] || '';
      },
      updateExternalVars,
    );

    // convenience methods:
    // time: {{now}} or {{nowIso}}. {{now + 1000}} adds the specified amount of milliseconds.
    // uuid: {{uuid}}
    // parseInt and parseFloat available for now.

    const nowRegex = /{{now(?:\s*\+\s*(\d+))?}}/;
    body = this._replaceBodyExpression(
      body,
      nowRegex,
      new Date().getTime(),
      request,
      routeTemplate,
      externalVars,
      (match, value) => {
        if (match[1]) {
          const milliseconds = parseInt(match[1]);

          if (!isNaN(milliseconds)) {
            return value + milliseconds;
          }
        }

        return value;
      },
      updateExternalVars,
    );

    const nowIsoRegex = /{{nowIso(?:\s*\+\s*(\d+))?}}/;
    body = this._replaceBodyExpression(
      body,
      nowIsoRegex,
      new Date().toISOString(),
      request,
      routeTemplate,
      externalVars,
      (match, value) => {
        if (match[1]) {
          const milliseconds = parseInt(match[1]);

          if (!isNaN(milliseconds)) {
            return new Date(new Date(value).getTime() + milliseconds).toISOString();
          }
        }

        return value;
      },
      updateExternalVars,
    );

    const uuidRegex = /{{uuid}}/g;
    body = body.replace(uuidRegex, this._uuid());

    // randRange: {{randRange 1 10}} or {{randRange 1.5 10.5}}
    const randRangeRegex = /{{randRange\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)}}/;
    body = this._replaceBodyExpression(
      body,
      randRangeRegex,
      '',
      request,
      routeTemplate,
      externalVars,
      (match) => {
        const min = parseInt(match[1]);
        const max = parseInt(match[2]);

        if (isNaN(min) || isNaN(max)) {
          throw new Error(`Cannot replace body template, randRange requires two numbers: ${match[0]}`);
        }

        return (Math.random() * (max - min) + min).toString();
      },
      updateExternalVars,
    );

    // empty: {{empty}}
    const emptyRegex = /{{empty(\s*\+\s*(\d+))?}}/;
    body = this._replaceBodyExpression(
      body,
      emptyRegex,
      '',
      request,
      routeTemplate,
      externalVars,
      () => '',
      updateExternalVars,
    );

    // arrayExpression: {{arrayExpression count ${internalExpression}}}
    // e.g. {{arrayExpression 3 uuid}} or {{arrayExpression 3 path.someNumber | parseInt}}
    const arrayExpressionRegex =
      /"{{arrayExpression\s+([a-zA-Z0-9_${}]+)\s+([a-zA-Z0-9-_${}.\s+*%/()|?'@;[\]!£^&\\<>~#`¬]+)}}"/g;
    body = body.replace(arrayExpressionRegex, (match, count, expression) => {
      // Body is "{{arrayExpression %d %s}}".
      const array = [];
      const actualCount = parseInt(this._getVarValue(externalVars, count, request, routeTemplate));

      if (isNaN(actualCount)) {
        throw new Error(`Cannot replace body template, arrayExpression requires a number: ${match}`);
      }

      for (let i = 0; i < actualCount; i++) {
        expression = this._getVarValue(externalVars, expression, request, routeTemplate);

        // The index may be referenced in the expression: ${__index__}.
        const newExpression = expression.replace(/\${__index__}/, i.toString());

        array.push(`{{${newExpression}}}`);
      }

      return this._replaceBodyTemplate(routeTemplate, JSON.stringify(array), request, externalVars);
    });

    // kvExpression: {{kvExpression count ${internalExpression} --- ${internalExpression}}}
    // e.g. {{kvExpression 3 uuid --- path.someNumber | parseInt}}
    const kvExpressionRegex =
      /"{{kvExpression\s+([a-zA-Z0-9_${}]+)\s+([a-zA-Z0-9-_${}.\s+*%/()|?'@;"[\]!£^&\\<>~#`¬]+)\s+---\s+([a-zA-Z0-9-_${}.\s+*%/()|?'@;[\]!£^&\\<>~#`¬]+)}}"/g;
    body = body.replace(kvExpressionRegex, (match, count, keyExpression, valueExpression) => {
      // Body is "{{kvExpression %d %s --- %s}}".
      const kv = {};
      const actualCount = parseInt(this._getVarValue(externalVars, count, request, routeTemplate));

      if (isNaN(actualCount)) {
        throw new Error(`Cannot replace body template, kvExpression requires a number: ${match}`);
      }

      for (let i = 0; i < actualCount; i++) {
        keyExpression = this._getVarValue(externalVars, keyExpression, request, routeTemplate);
        valueExpression = this._getVarValue(externalVars, valueExpression, request, routeTemplate);

        // The index may be referenced in the expression: ${__index__}.
        const newKeyExpression = keyExpression.replace(/\${__index__}/, i.toString());
        const newValueExpression = valueExpression.replace(/\${__index__}/, i.toString());

        kv[`{{${newKeyExpression}}}`] = `{{${newValueExpression}}}`;
      }

      return this._replaceBodyTemplate(routeTemplate, JSON.stringify(kv), request, externalVars);
    });

    return body;
  }

  private static _replaceBodyExpression(
    body: string,
    regex: RegExp,
    replace: any,
    request: Request,
    routeTemplate: RegExp,
    externalVars: Map<string, any>,
    optionalReplacer?: (match: RegExpExecArray, actualValue: any, vars: Map<string, any>) => any,
    updateExternalVars: boolean = false,
  ) {
    // Update regex to include the chaining of methods (be able to match a variable number of methods, e.g. {{path.someNumber | parseInt | toFixed 2}}).
    // input regex should always end with a closing }}. This will be replaced with the method regex.
    const regexStr = regex.source.slice(0, -2);
    const methodRegex = /(?<chain>(?:\s*\|\s*([a-zA-Z0-9-_${}.\s+*%/()?'@;[\]!£^&\\<>~#`¬]+))*)?}}/;
    regex = new RegExp(regexStr + methodRegex.source);

    let match = regex.exec(body);

    while (match) {
      let value = replace;
      let actualValue = value;

      if (Array.isArray(value)) {
        actualValue = value.join(',');
      }
	  
	  const vars = new Map<string, any>(); // Per chain variables. Variable set in a setVar or setVarIf. Can be used in the chain like ${varName}.

	  // Set some default vars like now_, nowIso_, uuid_.
	  vars.set('now_', new Date().getTime());
	  vars.set('nowIso_', new Date().toISOString());
	  vars.set('ip_', request.ip);
	  vars.set('machineId_', os.hostname());
	  vars.set('localPort_', request.localPort);
	  vars.set('realIp_', request.realIp);
	  vars.set('uuid_', this._uuid);
	  
      if (updateExternalVars) {
        for (const [key, value] of vars) {
          externalVars.set(key, value);
        }
      }

      // Fill vars with external vars.
      for (const [key, value] of externalVars) {
        if (vars.has(key)) continue;

        try {
          vars.set(key, math.evaluate(value));
        } catch (e) {
          vars.set(key, value);
        }
      }

      if (optionalReplacer) {
        actualValue = optionalReplacer(match, actualValue, vars);
        value = actualValue.toString();
      }
	  
	  vars.set('value_', value);

      const chain = match.groups?.chain;

      if (chain) {
        const methods = chain
          .split('|')
          .map((m) => m.trim())
          .filter((m) => !!m);

        for (const method of methods) {
          let [methodName, ...args] = method.split(' ');

          args = args.map((arg) => arg.replace(/\${__comma__}/g, ',')); // This is a hack to allow commas in arguments. It breaks my regex otherwise.
          args = args.map((arg) => arg.replace(/\${__colon__}/g, ':')); // This is a hack to allow colons in arguments. It breaks my regex otherwise.
          args = args.map((arg) => arg.replace(/\${__quote__}/g, '"')); // This is a hack to allow quotes in arguments. It breaks my regex otherwise.

          if (methodName === 'methodExpr') {
            // Special method to allow chain to be injected from an external source.
            const methodExpr = this._getVarValue(vars, args.join(' '), request, routeTemplate);

            methodName = methodExpr.split(' ')[0];
            args = methodExpr.split(' ').slice(1);
          }
		  
		  hardcodedResponseMiddlewareLogger.debug(
		    "Calling chain method '%s' with args '%s'.",
			methodName,
			args.join(' ')
		  );

          if (methodName) {
            const methodFn = (globalThis as any)[methodName];

            if (typeof methodFn === 'function') {
              value = methodFn(value, ...args);
            } else {
              // Special methods.
              switch (methodName) {
                case 'fromIso':
                  if (typeof value === 'number') {
                    break;
                  }

                  value = new Date(value).getTime().toString();
                  break;
                case 'toIso':
                  if (typeof value === 'string') {
                    break;
                  }

                  value = new Date(parseInt(value)).toISOString();
                  break;
                case 'toFixed':
                case 'toPrecision':
                case 'toExponential':
                  const parsedNumber = this._parseNumber(this._getVarValue(vars, args[0], request, routeTemplate));
                  if (isNaN(parsedNumber)) {
                    throw new Error(`Cannot replace body template, invalid argument for ${methodName}: ${args[0]}`);
                  }

                  const parsedValue2 = this._parseNumber(value);
                  if (isNaN(parsedValue2)) {
                    throw new Error(`Cannot replace body template, invalid value for ${methodName}: ${value}`);
                  }

                  value =
                    typeof value === 'string'
                      ? (parsedValue2 as any)[methodName](parsedNumber).toString()
                      : (parsedValue2 as any)[methodName](parsedNumber);
                  break;
                case 'incDate':
                  const parsedIncDate = this._parseNumber(this._getVarValue(vars, args[0], request, routeTemplate));
                  if (isNaN(parsedIncDate)) {
                    throw new Error(`Cannot replace body template, invalid argument for incDate: ${args[0]}`);
                  }

                  if (typeof value === 'string') {
                    value = new Date(new Date(value).getTime() + parsedIncDate).toISOString();
                  } else if (typeof value === 'number') {
                    value += parsedIncDate;
                  }

                  break;
                case 'decDate':
                  const parsedDecDate = this._parseNumber(this._getVarValue(vars, args[0], request, routeTemplate));
                  if (isNaN(parsedDecDate)) {
                    throw new Error(`Cannot replace body template, invalid argument for decDate: ${args[0]}`);
                  }

                  if (typeof value === 'string') {
                    value = new Date(new Date(value).getTime() - parsedDecDate).toISOString();
                  } else if (typeof value === 'number') {
                    value -= parsedDecDate;
                  }

                  break;
                case 'add':
                  const parsed = this._parseNumber(this._getVarValue(vars, args[0], request, routeTemplate));
                  if (isNaN(parsed)) {
                    throw new Error(`Cannot replace body template, invalid argument for add: ${args[0]}`);
                  }

                  const parsedValue = this._parseNumber(value);
                  if (isNaN(parsedValue)) {
                    throw new Error(`Cannot replace body template, invalid value for add: ${value}`);
                  }

                  value = typeof value === 'string' ? (parsedValue + parsed).toString() : parsedValue + parsed;
                  break;
                case 'mul':
                  const parsedMul = this._parseNumber(this._getVarValue(vars, args[0], request, routeTemplate));
                  if (isNaN(parsedMul)) {
                    throw new Error(`Cannot replace body template, invalid argument for mul: ${args[0]}`);
                  }

                  const parsedValueMul = this._parseNumber(value);
                  if (isNaN(parsedValueMul)) {
                    throw new Error(`Cannot replace body template, invalid value for mul: ${value}`);
                  }

                  value =
                    typeof value === 'string' ? (parsedValueMul * parsedMul).toString() : parsedValueMul * parsedMul;
                  break;
                case 'div':
                  const parsedDiv = this._parseNumber(this._getVarValue(vars, args[0], request, routeTemplate));
                  if (isNaN(parsedDiv)) {
                    throw new Error(`Cannot replace body template, invalid argument for div: ${args[0]}`);
                  }

                  const parsedValueDiv = this._parseNumber(value);
                  if (isNaN(parsedValueDiv)) {
                    throw new Error(`Cannot replace body template, invalid value for div: ${value}`);
                  }

                  value =
                    typeof value === 'string' ? (parsedValueDiv / parsedDiv).toString() : parsedValueDiv / parsedDiv;
                  break;
                case 'sub':
                  const parsedSub = this._parseNumber(this._getVarValue(vars, args[0], request, routeTemplate));
                  if (isNaN(parsedSub)) {
                    throw new Error(`Cannot replace body template, invalid argument for sub: ${args[0]}`);
                  }

                  const parsedValueSub = this._parseNumber(value);
                  if (isNaN(parsedValueSub)) {
                    throw new Error(`Cannot replace body template, invalid value for sub: ${value}`);
                  }

                  value =
                    typeof value === 'string' ? (parsedValueSub - parsedSub).toString() : parsedValueSub - parsedSub;
                  break;
                case 'toLowerCase':
                case 'toUpperCase':
                case 'trim':
                case 'trimStart':
                case 'trimEnd':
                case 'trimLeft':
                case 'trimRight':
                case 'toString':
                  value = (value as any)[methodName]();
                  break;
                // String methods with one argument.
                case 'split':
                case 'repeat':
                case 'padStart':
                case 'padEnd':
                  value = (value as any)[methodName](this._getVarValue(vars, args[0], request, routeTemplate));
                  break;

                // Array methods with one argument.
                case 'join':
                  if (!Array.isArray(value)) {
                    break;
                  }

                  value = (value as any)[methodName](this._getVarValue(vars, args[0], request, routeTemplate));
                  break;

                // Math methods with one argument.
                case 'abs':
                case 'acos':
                case 'acosh':
                case 'asin':
                case 'asinh':
                case 'atan':
                case 'atanh':
                case 'cbrt':
                case 'ceil':
                case 'clz32':
                case 'cos':
                case 'cosh':
                case 'exp':
                case 'expm1':
                case 'floor':
                case 'fround':
                case 'log':
                case 'log1p':
                case 'log10':
                case 'log2':
                case 'round':
                case 'sign':
                case 'sin':
                case 'sinh':
                case 'sqrt':
                case 'tan':
                case 'tanh':
                case 'trunc':
                  const parsedMath = this._parseNumber(value);
                  if (isNaN(parsedMath)) {
                    throw new Error(`Cannot replace body template, invalid argument for ${methodName}: ${value}`);
                  }

                  value =
                    typeof value === 'string'
                      ? (Math as any)[methodName](parsedMath).toString()
                      : (Math as any)[methodName](parsedMath);
                  break;
                // Math methods with two arguments.
                case 'atan2':
                case 'hypot':
                case 'max':
                case 'min':
                case 'pow':
                case 'random':
                  const parsedMath1 = this._parseNumber(value);
                  if (isNaN(parsedMath1)) {
                    throw new Error(`Cannot replace body template, invalid argument for ${methodName}: ${value}`);
                  }

                  const parsedMath2 = this._parseNumber(this._getVarValue(vars, args[0], request, routeTemplate));
                  if (isNaN(parsedMath2)) {
                    throw new Error(`Cannot replace body template, invalid argument for ${methodName}: ${args[0]}`);
                  }

                  value =
                    typeof value === 'string'
                      ? (Math as any)[methodName](parsedMath1, parsedMath2).toString()
                      : (Math as any)[methodName](parsedMath1, parsedMath2);
                  break;
                case 'setVar':
                  // Like: {{setVar name type value}}
                  const varName = args[0];
                  const varType = args[1];

                  // Join the rest of the arguments.
                  const varValue = this._replaceVarExpression(vars, args.slice(2).join(' '), request, routeTemplate);

                  if (varType === 'number') {
                    const parsedVarValue = this._parseNumber(math.evaluate(varValue));
                    if (isNaN(parsedVarValue)) {
                      throw new Error(`Cannot replace body template, invalid value for setVar: ${varValue}`);
                    }

                    vars.set(varName, parsedVarValue);
                  } else if (varType === 'boolean') {
                    vars.set(varName, varValue === 'true');
				  } else if (varType === 'empty') {
					vars.set(varName, '');
                  } else {
                    vars.set(varName, varValue);
                  }

                  if (updateExternalVars) externalVars.set(varName, vars.get(varName));

                  break;
                case 'setVarIf':
                  // Like: {{setVarIf name type left right operator value}}
                  // e.g. {{setVarIf name number 1 2 eq 3}}
                  // e.g. {{setVarIf name number $var1 $var2 eq 3}}

                  const varNameIf = args[0];
                  const varTypeIf = args[1];
                  const left = this._getVarValue(vars, args[2], request, routeTemplate);
                  const right = this._getVarValue(vars, args[3], request, routeTemplate);
                  const operator = args[4];
                  const valueIf = this._replaceVarExpression(vars, args.slice(5).join(' '), request, routeTemplate);

                  let result = false;
                  switch (operator) {
                    case 'eq':
                      result = left === right;
                      break;
                    case 'ne':
                      result = left !== right;
                      break;
                    case 'gt':
                      result = left > right;
                      break;
                    case 'ge':
                      result = left >= right;
                      break;
                    case 'lt':
                      result = left < right;
                      break;
                    case 'le':
                      result = left <= right;
                      break;
                    default:
                      throw new Error(`Cannot replace body template, invalid operator for setVarIf: ${operator}`);
                  }

                  if (result) {
                    if (varTypeIf === 'number') {
                      const parsedVarValueIf = this._parseNumber(math.evaluate(valueIf));
                      if (isNaN(parsedVarValueIf)) {
                        throw new Error(`Cannot replace body template, invalid value for setVarIf: ${valueIf}`);
                      }

                      vars.set(varNameIf, parsedVarValueIf);
                    } else if (varTypeIf === 'boolean') {
                      vars.set(varNameIf, valueIf === 'true');
					} else if (varTypeIf === 'empty') {
					  vars.set(varNameIf, '');
                    } else {
                      vars.set(varNameIf, valueIf);
                    }

                    if (updateExternalVars) externalVars.set(varNameIf, vars.get(varNameIf));
                  }

                  break;
                case 'setVarBatchConditional':
                  // Like: {{setVarBatchConditional name type expressions}}
                  // e.g. {{setVarBatchConditional name number 1 eq 2 then 3, 4 eq 5 then 6}}
                  // e.g. {{setVarBatchConditional name number $var1 eq 2 then 3, 4 eq 5 then 6}}

                  const varNameBatchConditional = args[0];
                  const varTypeBatchConditional = args[1];
                  const expressions = args.slice(2).join(' ').split(';');
				  let hasDefault = false;
				  let defaultSetTo;
				  
                  for (const expression of expressions) {
                    const [left, operator, right, , ...setToRaw] = expression
                      .trim()
                      .split(' ')
                      .map((s) => s.trim());
					  
					const setTo = setToRaw.join(' ');

                    const actualLeft = this._getVarValue(vars, left, request, routeTemplate);
					const actualRight = this._getVarValue(vars, right, request, routeTemplate);

                    let result = false;
                    switch (operator) {
                      case 'eq':
                        result = actualLeft === actualRight;
                        break;
                      case 'ne':
                        result = actualLeft !== actualRight;
                        break;
                      case 'gt':
                        result = actualLeft > actualRight;
                        break;
                      case 'ge':
                        result = actualLeft >= actualRight;
                        break;
                      case 'lt':
                        result = actualLeft < actualRight;
                        break;
                      case 'le':
                        result = actualLeft <= actualRight;
                        break;
					  case 'def':
						hasDefault = true;
						defaultSetTo = this._replaceVarExpression(vars, setTo, request, routeTemplate);
						break;
                      default:
                        throw new Error(
                          `Cannot replace body template, invalid operator for setVarBatchConditional: ${operator}`,
                        );
                    }

                    if (result) {					
                      const actualSetTo = this._replaceVarExpression(vars, setTo, request, routeTemplate);

                      if (varTypeBatchConditional === 'number') {
                        const parsedVarValueBatchConditional = this._parseNumber(math.evaluate(actualSetTo));
                        if (isNaN(parsedVarValueBatchConditional)) {
                          throw new Error(
                            `Cannot replace body template, invalid value for setVarBatchConditional: ${actualSetTo}`,
                          );
                        }

                        vars.set(varNameBatchConditional, parsedVarValueBatchConditional);
                      } else if (varTypeBatchConditional === 'boolean') {
                        vars.set(varNameBatchConditional, actualSetTo === 'true');
					  } else if (varTypeBatchConditional === 'empty') {
					    vars.set(varNameBatchConditional, '');
                      } else {
                        vars.set(varNameBatchConditional, actualSetTo);
                      }

                      if (updateExternalVars)
                        externalVars.set(varNameBatchConditional, vars.get(varNameBatchConditional));

                      break;
                    }
                  }
				  
				  if (hasDefault) {
				    if (varTypeBatchConditional === 'number') {
                      const parsedVarValueBatchConditional = this._parseNumber(math.evaluate(defaultSetTo));
                      if (isNaN(parsedVarValueBatchConditional)) {
                        throw new Error(
                          `Cannot replace body template, invalid default for setVarBatchConditional: ${defaultSetTo}`,
                        );
                      }

                      vars.set(varNameBatchConditional, parsedVarValueBatchConditional);
                    } else if (varTypeBatchConditional === 'boolean') {
                      vars.set(varNameBatchConditional, defaultSetTo === 'true');
					} else if (varTypeBatchConditional === 'empty') {
					  vars.set(varNameBatchConditional, '');
                    } else {
                      vars.set(varNameBatchConditional, defaultSetTo);
                    }

                    if (updateExternalVars)
                      externalVars.set(varNameBatchConditional, vars.get(varNameBatchConditional));
				  }

                  break;
                case 'default':
                  // Like: {{default type value}}

                  // Do not replace if value is not undefined, nan, null, or empty string.
                  if (
                    value !== undefined &&
                    (typeof value !== 'number' || !isNaN(value)) &&
                    value !== null &&
                    value !== ''
                  ) {
                    break;
                  }

                  const defaultType = args[0];
                  const defaultValue = this._replaceVarExpression(
                    vars,
                    args.slice(1).join(' '),
                    request,
                    routeTemplate,
                  );

                  if (defaultType === 'number') {
                    const parsedDefaultValue = this._parseNumber(math.evaluate(defaultValue));
                    if (isNaN(parsedDefaultValue)) {
                      throw new Error(`Cannot replace body template, invalid value for default: ${defaultValue}`);
                    }

                    value = parsedDefaultValue;
                  } else if (defaultType === 'boolean') {
                    value = defaultValue === 'true';
				  } else if (defaultType === 'empty') {
				    value = '';
                  } else {
                    value = defaultValue;
                  }

                  break;
				case 'setValue':
				  // Like: {{setValue type value}}
				  
				  const setValueType = args[0];
                  const setValueValue = this._replaceVarExpression(
                    vars,
                    args.slice(1).join(' '),
                    request,
                    routeTemplate,
                  );

                  if (setValueType === 'number') {
                    const parsedDefaultValue = this._parseNumber(math.evaluate(setValueValue));
                    if (isNaN(parsedDefaultValue)) {
                      throw new Error(`Cannot replace body template, invalid value for setValue: ${setValueValue}`);
                    }

                    value = parsedDefaultValue;
                  } else if (setValueType === 'boolean') {
                    value = setValueValue === 'true';
				  } else if (setValueType === 'empty') {
				    value = '';
                  } else {
                    value = setValueValue;
                  }

                  break;
                default:
                  throw new Error(`Cannot replace body template, method not found: ${methodName}`);
              }
            }
          }
        }
      }

      if (typeof value === 'number' && !isNaN(value)) {
        // replace the template that is like "{{xxx}}" with the value removing the quotes.
        const quotedRegex = new RegExp(`"${regex.source}"`);
        body = body.replace(quotedRegex, value.toString());
      } else {
        body = body.replace(regex, value);
      }

      regex.lastIndex = 0;

      match = regex.exec(body);
    }

    return body;
  }

  private static _getVarValue(vars: Map<string, any>, rawArg: string, request: Request, routeTemplate: RegExp): any {
    // Is a variable if it is like this: ${varName}
    // For a request variable, it is like this: ${request.path.xxx}, ${request.query.xxx}, ${request.headers.xxx} etc.
    const varRegex = /^\${([a-zA-Z0-9-_.]+)}$/;
    const match = varRegex.exec(rawArg);
    if (match) {
      const varName = match[1];

      if (varName.startsWith('request.')) {
        const varNameParts = varName.split('.');
        if (varNameParts.length < 3) {
          throw new Error(`Cannot replace body template, invalid request variable: ${varName}`);
        }

        const varType = varNameParts[1];
        const varNameWithoutType = varNameParts.slice(2).join('.');
        switch (varType) {
          case 'path':
            const routeMatch = routeTemplate.exec(request.path);
            if (routeMatch) {
              const value = routeMatch.groups?.[varNameWithoutType];
              if (value) {
                return value;
              }
            }

            throw new Error(`Cannot replace body template, request path variable not found: ${varName}`);
          case 'query':
            const value = request.query[varNameWithoutType];
            if (value) {
              return value;
            }

            throw new Error(`Cannot replace body template, request query variable not found: ${varName}`);
          case 'headers':
            const headerValue = request.headers[varNameWithoutType];
            if (headerValue) {
              return headerValue;
            }

            throw new Error(`Cannot replace body template, request header variable not found: ${varName}`);
          default:
            throw new Error(`Cannot replace body template, invalid request variable: ${varName}`);
        }
      }

      if (vars.has(varName)) {
        const value = vars.get(varName);
		if (typeof value === 'function') return value();
		
		return value;
      } else {
        throw new Error(`Cannot replace body template, variable not found: ${varName}`);
      }
    }

    return rawArg;
  }

  private static _replaceVarExpression(
    vars: Map<string, any>,
    expression: string,
    request: Request,
    routeTemplate: RegExp,
  ): string {
    // Like _getVarValue but replaces all the variables in the expression.
    // e.g: ${var1} + ${var2} => 1 + 2
    const varRegex = /\${([a-zA-Z0-9-_.]+)}/;
    let match = varRegex.exec(expression);
    while (match) {
      const varName = match[0];
      const value = this._getVarValue(vars, varName, request, routeTemplate);
      expression = expression.replace(match[0], value);

      varRegex.lastIndex = 0;
      match = varRegex.exec(expression);
    }

    return expression;
  }

  private static _parseNumber(value: string): number {
    if (typeof value === 'number') {
      return value;
    }

    // If the value is a decimal number, parse it as a float.
    if (value.indexOf('.') !== -1) {
      return parseFloat(value);
    }

    // If the value is a hexadecimal number, parse it as a float.
    if (value.indexOf('0x') === 0) {
      return parseInt(value, 16);
    }

    // If the value is a binary number, parse it as a float.
    if (value.indexOf('0b') === 0) {
      return parseInt(value, 2);
    }

    // If the value is an octal number, parse it as a float.
    if (value.indexOf('0o') === 0) {
      return parseInt(value, 8);
    }

    // If the value is a number, parse it as an integer.
    if (!isNaN(parseInt(value, 10))) {
      return parseInt(value, 10);
    }

    // Manage numbers that have xxexx format.
    const match = value.match(/(\d+)e(\d+)/);
    if (match) {
      return parseInt(match[1], 10) * Math.pow(10, parseInt(match[2], 10));
    }

    return NaN;
  }

  private static _header(request: Request, name: string): string[] {
    const value = request.headers[name];

    if (typeof value === 'string') {
      return [value];
    } else if (Array.isArray(value)) {
      return value;
    }

    return [];
  }

  private static _query(request: Request, name: string): string[] {
    const value = request.query[name];

    if (typeof value === 'string') {
      return [value];
    } else if (Array.isArray(value)) {
      return value as string[];
    }

    return [];
  }

  private static _uuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
