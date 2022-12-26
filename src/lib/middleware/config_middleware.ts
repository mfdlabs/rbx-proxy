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

import '@lib/extensions/express/response';

import webUtility from '@lib/utility/web_utility';
import baseEnvironment from '@lib/environment/base_environment';
import pathEnvironment from '@lib/environment/path_environment';
import loadBalancerResponder from '@lib/responders/load_balancer_responder';
import configMiddlewareLogger from '@lib/loggers/middleware/config_middleware_logger';

import net from '@mfdlabs/net';
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

        return loadBalancerResponder.sendMessage('IP check failed.', request, response, 403);
      }

      configMiddlewareLogger.information('Request is a config request, responding with env vars.');

      response.noCache();
      response.contentType('text/plain');

      let str = `### Retrieved ${new Date().toISOString()} ###\n\nMACHINE_ID => '${webUtility.getMachineID()}'\nNODE_VERSION => '${
        process.version
      }'\nNODE_PLATFORM => '${process.platform}'\nNODE_ARCH => '${process.arch}'\n`;

      const values = baseEnvironment.getValues();
      let lastEnvironmentName = '';
      for (const key in values) {
        const [env, value] = values[key];

        let envName = env.constructor.name;
        envName = envName.charAt(0).toLowerCase() + envName.slice(1);

        if (envName !== lastEnvironmentName) str += `\n\n### ENVIRONMENT: ${envName} ###\n`;

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
      }
      response.send(str);

      return;
    }

    if (request.path.toLowerCase() === pathEnvironment.singleton.configPath + '/update') {
      // If we are POST, PATCH or PUT, then parse the body. Otherwise, just use the query.
      let body: any = {};
      if (request.method === 'POST' || request.method === 'PATCH' || request.method === 'PUT') {
        const rawBody = this._bufferToString(request.body);

        // If there is no body, error.
        if (rawBody === undefined || rawBody === null || rawBody === '') {
          loadBalancerResponder.sendMessage('No body was provided.', request, response, 400);
          return;
        }

        try {
          let contentType = request.headers['content-type'];

          if (contentType === undefined) {
            loadBalancerResponder.sendMessage('Content-Type header is missing.', request, response, 400);
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
              loadBalancerResponder.sendMessage(
                `Content-Type '${contentType}' is not supported. Only text/json, application/json, application/x-www-form-urlencoded are supported.`,
                request,
                response,
                400,
              );
              return;
          }
        } catch (error) {
          loadBalancerResponder.sendMessage(`Failed to parse body: ${error.message}`, request, response, 400);
          return;
        }
      } else {
        body = request.query;
      }

      const { environmentName, key, value } = body;

      if (!environmentName) {
        loadBalancerResponder.sendMessage("Required parameter 'environmentName' is missing.", request, response, 400);
        return;
      }
      if (!key) {
        loadBalancerResponder.sendMessage("Required parameter 'key' is missing.", request, response, 400);
        return;
      }

      // Do not allow multiple names.
      if (typeof environmentName !== 'string') {
        loadBalancerResponder.sendMessage("Parameter 'environmentName' must be a string.", request, response, 400);
        return;
      }
      if (typeof key !== 'string') {
        loadBalancerResponder.sendMessage("Parameter 'key' must be a string.", request, response, 400);
        return;
      }

      const isEnvironmentVariable = key.toLowerCase().startsWith('env.');

      const actualKey = isEnvironmentVariable ? key.substring(4) : baseEnvironment.getVariableForCaller(key);

      const env = baseEnvironment.getEnvironment(environmentName);
      if (env === undefined) {
        loadBalancerResponder.sendMessage(`Environment '${environmentName}' does not exist.`, request, response, 404);
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
        loadBalancerResponder.sendMessage(
          `Variable '${actualEnvironmentName}${key}' does not exist.`,
          request,
          response,
          404,
        );

        return;
      }

      if (isReset) {
        if (!env.isVariableOverridden(actualKey)) {
          loadBalancerResponder.sendMessage(
            `Variable '${actualEnvironmentName}${key}' is not overridden, so it cannot be reset.`,
            request,
            response,
            400,
          );

          return;
        }

        const overriddenValue = env.getOverridenVariable(actualKey);

        env.removeOverriddenVariableWithReplication(actualKey);

        loadBalancerResponder.sendMessage(
          `Variable '${actualEnvironmentName}${key}' has been reset. It had value '${overriddenValue}' but now has value '${env.getOrDefault(
            actualKey,
          )}'.`,
          request,
          response,
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
        loadBalancerResponder.sendMessage(
          `Variable '${actualEnvironmentName}${key}' is already overridden with value '${env.getOverridenVariable(
            actualKey,
          )}'.`,
          request,
          response,
          400,
        );

        return;
      }

      const type = baseEnvironment.getTrackedVariableType(actualKey);

      const [isValid, convetedValue] = this._tryConvertTo(value, type);
      if (!isValid) {
        loadBalancerResponder.sendMessage(
          `Variable '${actualEnvironmentName}${key}' is of type '${type}' but value '${value}' is not valid.`,
          request,
          response,
          400,
        );

        return;
      }

      env.overrideVariableWithReplication(actualKey, convetedValue);

      loadBalancerResponder.sendMessage(
        `Variable '${actualEnvironmentName}${key}' has been overridden with value '${convetedValue}'.`,
        request,
        response,
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

  private static _tryConvertTo(value: any, type: string): [boolean, any] {
    const convertedValue = this._convertTo(value, type);

    if (Array.isArray(convertedValue)) {
      return [convertedValue.every((v) => v !== undefined), convertedValue];
    }

    return [convertedValue !== undefined, convertedValue];
  }

  private static _bufferToString(buffer: Buffer): string {
    return buffer.toString('utf8');
  }
}
