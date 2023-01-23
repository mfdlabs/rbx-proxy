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
    File Name: metrics_middleware.ts
    Description: This file contains the metrics middleware.
    Written by: <blah blah blah>
*/

import webUtility from '@lib/utility/web_utility';
import baseEnvironment from '@lib/environment/base_environment';
import pathEnvironment from '@lib/environment/path_environment';
import configMiddlewareLogger from '@lib/loggers/middleware/config_middleware_logger';

import net from '@mfdlabs/net';
import htmlEncode from 'escape-html';
import { NextFunction, Request, Response } from 'express';

export default class ConfigMiddleware {
  /**
   * Invokes the middleware.
   * @param {Request} request The request object.
   * @param {Response} response The response object.
   * @param {NextFunction} next The next function to call.
   * @returns {void} Nothing.
   */
  public static async invoke(request: Request, response: Response, next: NextFunction): Promise<void> {
    if (!pathEnvironment.singleton.useConfigMiddleware) return next();

    if (request.path.toLowerCase() === pathEnvironment.singleton.configPath) {
      const allowedIPv4Addresses = pathEnvironment.singleton.allowedIPv4Addresses;
      const allowedIPv6Addresses = pathEnvironment.singleton.allowedIPv6Addresses;

      if (
        !net.isIPv4InCidrRangeList(request.ip, allowedIPv4Addresses) &&
        !net.isIPv6InCidrRangeList(request.ip, allowedIPv6Addresses)
      ) {
        configMiddlewareLogger.warning(`Request from ${request.ip} is not allowed to access the config endpoint.`);

        return response.sendMessage(['IP check failed.'], 403);
      }

      configMiddlewareLogger.information('Request is a config request, responding with env vars.');

      response.noCache();
      response.contentType('text/plain');

      let str = `### Retrieved ${new Date().toISOString()} ###\n\nMACHINE_ID => '${webUtility.getMachineID()}'\nNODE_VERSION => '${
        process.version
      }'\nNODE_PLATFORM => '${process.platform}'\nNODE_ARCH => '${process.arch}'\n`;

      const json = {
        retrieved: new Date().toISOString(),
        machineID: webUtility.getMachineID(),
        nodeVersion: process.version,
        nodePlatform: process.platform,
        nodeArch: process.arch,

        env: [] as {
          name: string;
          value: any;
          type: string;
          environmentVariable: string;
          environmentName: string;
          isOverridden: boolean;
        }[],
      };

      const values = baseEnvironment.getValues();
      let lastEnvironmentName = '';
      for (const key in values) {
        const [env, value] = values[key];

        let envName = env.constructor.name;
        envName = envName.charAt(0).toLowerCase() + envName.slice(1);

        if (envName !== lastEnvironmentName)
          str += `\n\n### ENVIRONMENT: ${envName} (${env.getEnvironmentName()}) ###\n`;

        lastEnvironmentName = envName;

        let valueStr = value;

        // Format the value.
        if (typeof value === 'string') {
          valueStr = `'${value}'`;
        } else if (typeof value === 'object' && value?.constructor?.name !== 'RegExp') {
          valueStr = JSON.stringify(value);
        }

        if (env.isVariableOverridden(key)) {
          str += `[OVERRIDE][${key}] ${baseEnvironment.getTrackedVariableType(
            key,
          )} ${envName}.${baseEnvironment.getCallerForVariable(key)} => ${valueStr}\n`;
        } else {
          str += `[${key}] ${baseEnvironment.getTrackedVariableType(
            key,
          )} ${envName}.${baseEnvironment.getCallerForVariable(key)} => ${valueStr}\n`;
        }

        json.env.push({
          name: baseEnvironment.getCallerForVariable(key),
          value: value instanceof RegExp ? value.toString() : value,
          type: baseEnvironment.getTrackedVariableType(key),
          environmentVariable: key,
          environmentName: `${envName} (${env.getEnvironmentName()})`,
          isOverridden: env.isVariableOverridden(key),
        });
      }

      const { format } = request.query as { [key: string]: string };

      if (format?.toLocaleLowerCase() === 'json') {
        response.contentType('application/json');
        response.send(JSON.stringify(json, null, 2));
        return;
      }

      response.send(str);

      return;
    }

    if (request.path.toLowerCase() === pathEnvironment.singleton.configPath + '/update') {
      const allowedIPv4Addresses = pathEnvironment.singleton.allowedIPv4Addresses;
      const allowedIPv6Addresses = pathEnvironment.singleton.allowedIPv6Addresses;

      if (
        !net.isIPv4InCidrRangeList(request.ip, allowedIPv4Addresses) &&
        !net.isIPv6InCidrRangeList(request.ip, allowedIPv6Addresses)
      ) {
        configMiddlewareLogger.warning(`Request from ${request.ip} is not allowed to access the config endpoint.`);

        return response.sendMessage(['IP check failed.'], 403);
      }

      // If we are POST, PATCH or PUT, then parse the body. Otherwise, just use the query.
      let body: any = {};
      if (request.method === 'POST' || request.method === 'PATCH' || request.method === 'PUT') {
        const rawBody = this._bufferToString(request.body);

        // If there is no body, error.
        if (rawBody === undefined || rawBody === null || rawBody === '') {
          response.sendMessage(['No body was provided.'], 400);
          return;
        }

        try {
          let contentType = request.headers['content-type'];

          if (contentType === undefined) {
            response.sendMessage(['Content-Type header is missing.'], 400);
            return;
          }

          // Make sure if defining the charset, we only use the first part.
          if (contentType.includes(';')) {
            contentType = contentType.split(';')[0];
          }

          switch (contentType.toLowerCase()) {
            case 'application/json':
              body = JSON.parse(rawBody);
              break;
            case 'text/json':
              body = JSON.parse(rawBody);
              break;
            case 'application/x-www-form-urlencoded':
              body = new URLSearchParams(rawBody);
              break;
            default:
              response.sendMessage(
                [
                  `Content-Type is not supported.\nContent-Type: <b>${htmlEncode(
                    contentType,
                  )}</b>\nSupported Content-Types: <b>application/json</b>, <b>text/json</b>, <b>application/x-www-form-urlencoded</b>`,
                  undefined,
                  true,
                ],
                400,
              );
              return;
          }
        } catch (error) {
          response.sendMessage(
            [`Failed to parse body.\nError: <b>${htmlEncode(error.message)}</b>`, undefined, true],
            400,
          );
          return;
        }
      } else {
        body = request.query;
      }

      const { environmentName, key, value } = body;

      if (!environmentName) {
        ConfigMiddleware._requiredParameterMissing('environmentName', request, response);
        return;
      }
      if (!key) {
        ConfigMiddleware._requiredParameterMissing('key', request, response);
        return;
      }

      // Do not allow multiple names.
      if (typeof environmentName !== 'string') {
        ConfigMiddleware._parameterMustBeType('environmentName', 'string', request, response);
        return;
      }
      if (typeof key !== 'string') {
        ConfigMiddleware._parameterMustBeType('key', 'string', request, response);
        return;
      }

      const isEnvironmentVariable = key.toLowerCase().startsWith('env.');

      const actualKey = isEnvironmentVariable ? key.substring(4) : baseEnvironment.getVariableForCaller(key);

      const env = baseEnvironment.getEnvironment(environmentName);
      if (env === undefined) {
        response.sendMessage(
          [`Environment does not exist.\nEnvironment: <b>${htmlEncode(environmentName)}</b>`, undefined, true],
          404,
        );
        return;
      }

      let actualEnvironmentName = env.constructor.name + '.';
      actualEnvironmentName = isEnvironmentVariable
        ? ''
        : actualEnvironmentName.charAt(0).toLowerCase() + actualEnvironmentName.slice(1);

      configMiddlewareLogger.information(
        `Attempting to set variable '%s%s' to value '%s' in environment '%s'.`,
        actualEnvironmentName,
        key,
        value,
        environmentName,
      );

      const isReset = value === undefined || value === null;

      const existsFunc = isEnvironmentVariable
        ? baseEnvironment.doesVariableExistInEnvironment.bind(baseEnvironment)
        : baseEnvironment.doesVariableExistInEnvironmentByCaller.bind(baseEnvironment);

      if (!existsFunc(environmentName, isEnvironmentVariable ? actualKey : key)) {
        response.sendMessage(
          [
            `Variable does not exist.\nVariable: <b>${htmlEncode(actualEnvironmentName)}${htmlEncode(
              key,
            )}</b>\nEnvironment: <b>${htmlEncode(environmentName)}</b>`,
            undefined,
            true,
          ],
          404,
        );

        return;
      }

      if (isReset) {
        if (!env.isVariableOverridden(actualKey)) {
          response.sendMessage(
            [
              `Variable is not overridden, so it cannot be reset.\nVariable: <b>${htmlEncode(
                actualEnvironmentName,
              )}${htmlEncode(key)}</b>\nEnvironment: <b>${htmlEncode(environmentName)}</b>`,
              undefined,
              true,
            ],
            400,
          );

          return;
        }

        const overriddenValue = env.getOverridenVariable(actualKey);

        env.removeOverriddenVariableWithReplication(actualKey);

        response.sendMessage(
          [
            `Variable has been reset.\nVariable: <b>${htmlEncode(actualEnvironmentName)}${htmlEncode(
              key,
            )}</b>\nEnvironment: <b>${htmlEncode(environmentName)}</b>\nValue: <b>${htmlEncode(
              overriddenValue.toString().substring(0, 100),
            )}</b>\nNew Value: <b>${htmlEncode(
              baseEnvironment.getTrackedVariableValue(actualKey)?.toString().substring(0, 100) ?? 'Unknown',
            )}</b>`,
            undefined,
            true,
          ],
          200,
        );

        configMiddlewareLogger.information(
          `Variable '%s%s' has been reset. It had value '%s' but now has value '%s'.`,
          actualEnvironmentName,
          key,
          overriddenValue,
          env.getOrDefault(actualKey),
        );

        return;
      }

      if (env.isVariableOverridden(actualKey)) {
        response.sendMessage(
          [
            `Variable is already overridden.\nVariable: <b>${htmlEncode(actualEnvironmentName)}${htmlEncode(
              key,
            )}</b>\nEnvironment: <b>${htmlEncode(environmentName)}</b>\nValue: <b>${htmlEncode(
              env.getOverridenVariable(actualKey).toString().substring(0, 100),
            )}</b>`,
            undefined,
            true,
          ],
          400,
        );

        return;
      }

      const type = baseEnvironment.getTrackedVariableType(actualKey);

      const [isValid, convetedValue] = this._tryConvertTo(value, type);
      if (!isValid) {
        response.sendMessage(
          [
            `Supplied typeof variable value is not valid.\nVariable: <b>${htmlEncode(
              actualEnvironmentName,
            )}${htmlEncode(key)}</b>\nEnvironment: <b>${htmlEncode(environmentName)}</b>\nActual Type: <b>${htmlEncode(
              typeof value,
            )}</b>\nExpected Type: <b>${htmlEncode(type)}</b>`,
            undefined,
            true,
          ],
          400,
        );

        return;
      }

      env.overrideVariableWithReplication(actualKey, convetedValue);

      response.sendMessage(
        [
          `Variable has been overridden.\nVariable: <b>${htmlEncode(actualEnvironmentName)}${htmlEncode(
            key,
          )}</b>\nEnvironment: <b>${htmlEncode(environmentName)}</b>\nValue: <b>${htmlEncode(
            convetedValue.toString().substring(0, 100),
          )}</b>`,
          undefined,
          true,
        ],
        200,
      );

      configMiddlewareLogger.information(
        `Variable '%s%s' has been overridden with value '%s'.`,
        actualEnvironmentName,
        key,
        convetedValue,
      );

      return;
    }

    next();
  }

  private static _convertTo(value: any, type: string): any {
    try {
      // If the value is already the type (except object), then just return it.
      if (typeof value === type && type !== 'object' && !type.startsWith('array<')) {
        return value;
      }

      // Special check for arrays, type is like 'array<innerType>'.
      if (type.startsWith('array<')) {
        const innerType = type.replace('array<', '').replace('>', '');

        if (Array.isArray(value)) {
          return value.map((v) => this._convertTo(v, innerType));
        }

        // If it is a string, split it by comma.
        if (typeof value === 'string') {
          return value.split(',').map((v) => this._convertTo(v, innerType));
        }

        return undefined;
      }

      switch (type) {
        case 'string':
          return value;
        case 'number':
          return Number(value);
        case 'bigint':
          return BigInt(value);
        case 'boolean':
          return value === 'true';
        case 'regexp':
          return new RegExp(value);
        case 'object':
          return JSON.parse(value);
        default:
          return undefined;
      }
    } catch (error) {
      return undefined;
    }
  }

  private static _requiredParameterMissing(parameterName: string, request: Request, response: Response): void {
    response.sendMessage(
      [`Required parameter missing.\nParameter: <b>${htmlEncode(parameterName)}</b>`, undefined, true],
      400,
    );
  }

  private static _parameterMustBeType(parameterName: string, type: string, request: Request, response: Response): void {
    response.sendMessage(
      [
        `Parameter must be of type <b>${htmlEncode(type)}</b>.\nParameter: <b>${htmlEncode(parameterName)}</b>`,
        undefined,
        true,
      ],
      400,
    );
  }

  private static _tryConvertTo(value: any, type: string): [boolean, any] {
    const convertedValue = this._convertTo(value, type);

    if (Array.isArray(convertedValue)) {
      return [convertedValue.every((v) => v !== undefined), convertedValue];
    }

    if (typeof convertedValue === 'number') {
      return [!Number.isNaN(convertedValue), convertedValue];
    }

    return [convertedValue !== undefined, convertedValue];
  }

  private static _bufferToString(buffer: Buffer): string {
    return buffer.toString('utf8');
  }
}
