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
    File Name: base_environment.ts
    Description: A base class for loading environment variables.
    Written by: Nikita Petko
*/

import { baseUrl, nodeModulesPath } from '../../import_handler';
import multicastReplicator from '@lib/replicator';
import dotenvLoader from '@lib/environment/dotenv_loader';
import * as baseEnvironmentMetrics from '@lib/metrics/base_environment_metrics';

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import environment, {
  DefaultValueGetter,
  EnvironmentVariableType,
  EnvironmentVariableArrayType,
} from '@mfdlabs/environment';
import stackTrace from 'stack-trace';
import logger, { LogLevel } from '@mfdlabs/logging';

const baseEnvironmentLogger = new logger('base-environment', LogLevel.Debug);

/**
 * A class for loading environment variables from .env files programmatically.
 */
export default abstract class BaseEnvironment extends environment {
  private static _trackedValues: Record<string, [BaseEnvironment, unknown, string, string]> = {};
  private static _registeredEnvironments: Record<string, BaseEnvironment> = {};
  private static _replicator: multicastReplicator = new multicastReplicator(5000, '224.0.0.3');
  private static _dependants: Map<string, string[]> = new Map();

  private static _tryReplicate(environmentName: string, key: string, value: unknown): void {
    baseEnvironmentLogger.debug(`Try replicate change for %s.%s to multicast group`, environmentName, key);

    try {
      this._replicator.send(
        JSON.stringify({
          environmentName,
          key,
          value,
          hostname: os.hostname(),
        }),
      );
    } catch (e) {
      // Ignore errors.
    }
  }

  private _environmentName: string;

  private _callAllGetters(): number {
    // List all getters and call them to ensure they are loaded.
    const getters = Object.entries(Object.getOwnPropertyDescriptors(this.constructor.prototype))
      .filter(([key, descriptor]) => key !== 'constructor' && typeof descriptor.get === 'function')
      .map(([key]) => key);

    for (const getter of getters) {
      try {
        this[getter]();
      } catch (e) {
        // Ignore errors.
      }
    }

    return getters.length;
  }

  private static _convertFileToSourceName(
    file: string,
    isNodeModule: boolean = false,
    isCoreModule: boolean = false,
  ): string {
    // If it is under src/xxx.ts then we want to convert it to xxx.
    // If it is under src/lib/xxx.ts then we want to convert it to @lib/xxx. the same for subdirectories of lib like @lib/xxx/yyy.

    // convert \\ to / for windows
    file = file.replace(/\\/g, '/');

    const newBaseUrl = path.resolve(baseUrl, '..').replace(/\\/g, '/');

    // Remove the base url from the file. baseUrl is __dirname.
    file = file.replace(baseUrl.replace(/\\/g, '/'), '');
    file = file.replace(newBaseUrl, '');

    // Remove the .ts from the file.
    file = file.replace(/\.ts$/, '');
    file = file.replace(/\.js$/, '');

    // Remove the src/ from the file.
    file = file.replace(/^\/src/, '');

    // If it is under lib/ then we want to add @ to the start.
    file = file.replace(/^\/lib/, '@lib');

    // if relative path like ./xxx or ./lib/xxx make it xxx
    file = file.replace(/^\.\//, '');

    // Make sure it does not start with a /.
    file = file.replace(/^\//, '');

    // If the file ends in /index then remove it. If the file is only index then make it @entrypoint.
    file = file.replace(/\/index$/, '');
    file = file.replace(/^index$/, '@entrypoint');

    // if it is just the file on its own (no slashes) then make it @entrypoint/xxx
    if (!file.includes('/') && file !== '@entrypoint' && !isNodeModule && !isCoreModule) {
      file = '@entrypoint/' + file;
    }

    if (isNodeModule) {
      // Remove @ from the start.
      file = file.replace(/^@/, '');

      file = '@node_modules/' + file;
    }

    if (isCoreModule) {
      file = '@node/' + file;
    }

    return file;
  }

  private static _isNodeModule(file: string): boolean {
    const nodeModulePath = path.join(nodeModulesPath, file);

    return fs.existsSync(nodeModulePath);
  }

  private static _isCoreModule(file: string): boolean {
    // Is this part of nodejs? Like fs, path, etc.
    return require.resolve.paths(file) === null;
  }

  private static _getTypeBasedOnValue(value: unknown): string {
    // If it is an object, check the prototype.
    if (typeof value === 'object' && value !== null) {
      // Special for array though. array<innerType> should be returned.
      if (Array.isArray(value)) {
        return `array<${BaseEnvironment._getTypeBasedOnValue(value[0])}>`;
      }

      return value.constructor.name.toLowerCase();
    }

    return typeof value;
  }

  private static _deepEquals(a: unknown, b: unknown): boolean {
    if (a === b) {
      return true;
    }

    if (typeof a !== typeof b) {
      return false;
    }

    if (typeof a === 'object' && a !== null && b !== null) {
      const aKeys = Object.keys(a);
      const bKeys = Object.keys(b);

      if (aKeys.length !== bKeys.length) {
        return false;
      }

      for (const key of aKeys) {
        if (!BaseEnvironment._deepEquals(a[key], b[key])) {
          return false;
        }
      }

      return true;
    }

    return false;
  }

  public getOrDefault<T = unknown>(
    key: string,
    defaultValue?: DefaultValueGetter<T>,
    optionalType?: EnvironmentVariableType | EnvironmentVariableArrayType,
  ): T {
    // Throw if the variable is registered in a different environment.
    if (
      BaseEnvironment.isVariableTracked(key) &&
      BaseEnvironment.getEnvironmentNameForVariable(key) !== this._environmentName
    ) {
      throw new Error(
        `Variable ${key} is already registered in environment ${BaseEnvironment.getEnvironmentNameForVariable(key)}`,
      );
    }

    dotenvLoader.reloadEnvironment();

    baseEnvironmentMetrics.variableReads.inc({
      environment: this._environmentName,
      variable: key,
      overridden: super.isVariableOverridden(key).toString(),
    });

    const caller = new Error().stack?.split('at ')?.[2]?.split(' ')[1] ?? 'unknown';

    try {
      const value = super.getOrDefault(key, defaultValue, optionalType);

      // Overwrite if the variable value changed.
      if (!BaseEnvironment._deepEquals(BaseEnvironment.getTrackedVariableValue<T>(key), value)) {
        // Caller is always a getter. We want to know which getter called this.
        // Stack formats it as "at <class>.get <getterName> [as <alias>] (<file>:<line>:<column>)"

        BaseEnvironment._trackedValues[key] = [
          this,
          value,
          optionalType ?? BaseEnvironment._getTypeBasedOnValue(value),
          caller,
        ];
      }

      return value;
    } catch (e) {
      BaseEnvironment._trackedValues[key] = [this, e.message, 'error', caller];

      throw e;
    } finally {
      // Determine who the true caller is. (getOrDefault -> getter -> caller)
      const fileName = stackTrace.parse(new Error())[2].getFileName();
      const actualCaller = BaseEnvironment._convertFileToSourceName(
        fileName,
        BaseEnvironment._isNodeModule(fileName),
        BaseEnvironment._isCoreModule(fileName),
      );
      let envName = this.constructor.name;
      envName = envName.charAt(0).toLowerCase() + envName.slice(1);
      const name = `${envName}.${caller}`;

      if (BaseEnvironment._dependants.has(name)) {
        const dependantList = BaseEnvironment._dependants.get(name);
        const oldList = dependantList.join(',');

        if (!dependantList.includes(actualCaller)) {
          dependantList.push(actualCaller);
          BaseEnvironment._dependants.set(name, dependantList);

          baseEnvironmentMetrics.configurationDependencies.remove(name, oldList);

          for (const [key, value] of BaseEnvironment._dependants) {
            baseEnvironmentMetrics.configurationDependencies.set(
              { variable_name: key, parent_variable_dependency_names: value.join(',') },
              value.length,
            );
          }
        }
      } else {
        baseEnvironmentLogger.warning("Initial read on variable '%s'", name);

        BaseEnvironment._dependants.set(name, [actualCaller]);

        baseEnvironmentMetrics.configurationDependencies.set(
          { variable_name: name, parent_variable_dependency_names: actualCaller },
          1,
        );
      }
    }
  }

  public overrideVariable<T = unknown>(variable: string, value: T): void {
    super.overrideVariable(variable, value);

    baseEnvironmentMetrics.variablesOverridden.inc({ environment: this._environmentName, variable });

    baseEnvironmentLogger.debug(`Overridden variable: ${variable} with value: ${value}`);
  }

  public overrideVariableWithReplication<T = unknown>(variable: string, value: T): void {
    this.overrideVariable(variable, value);

    BaseEnvironment._tryReplicate(this._environmentName, variable, value);
  }

  public removeOverriddenVariable(variable: string): void {
    super.removeOverriddenVariable(variable);

    baseEnvironmentMetrics.variablesReset.inc({ environment: this._environmentName, variable });

    baseEnvironmentLogger.debug(`Removed overridden variable: ${variable}`);
  }

  public removeOverriddenVariableWithReplication(variable: string): void {
    this.removeOverriddenVariable(variable);

    BaseEnvironment._tryReplicate(this._environmentName, variable, undefined);
  }

  /**
   * Get the values for all registered environment variables.
   * @returns {Record<string, [BaseEnvironment, unknown]>} The values for all registered environment variables.
   */
  public static getValues(): Record<string, [BaseEnvironment, unknown, string, string]> {
    return this._trackedValues;
  }

  /**
   * Get the type of a tracked environment variable.
   * @param {string} variable The name of the environment variable.
   * @returns {string} The type of the environment variable.
   */
  public static getTrackedVariableType(variable: string): string {
    return this._trackedValues[variable]?.[2];
  }

  /**
   * Get the value of a tracked environment variable.
   * @param {string} variable The name of the environment variable.
   * @returns {T} The value of the environment variable.
   */
  public static getTrackedVariableValue<T = unknown>(variable: string): T {
    return this._trackedValues[variable]?.[1] as T;
  }

  /**
   * Gets the state of a variable existing or not.
   * @param {string} variable The name of the environment variable.
   * @returns {boolean} Whether the variable exists or not.
   */
  public static isVariableTracked(variable: string): boolean {
    return variable in this._trackedValues;
  }

  /**
   * Get the name of the environment the variable is registered in.
   * @param {string} variable The name of the environment variable.
   * @returns {string} The name of the environment the variable is registered in.
   */
  public static getEnvironmentNameForVariable(variable: string): string {
    return this._trackedValues[variable]?.[0]?.getEnvironmentName();
  }

  /**
   * Get the name of the function that registered the variable.
   * @param {string} variable The name of the environment variable.
   * @returns {string} The name of the function that registered the variable.
   */
  public static getCallerForVariable(variable: string): string {
    return this._trackedValues[variable]?.[3];
  }

  /**
   * Get the environment variable name for the specified caller.
   * @param {string} caller The name of the caller.
   * @returns {string} The environment variable name for the specified caller.
   */
  public static getVariableForCaller(caller: string): string {
    return Object.entries(this._trackedValues).find(([, [, , , trackedCaller]]) => trackedCaller === caller)?.[0];
  }

  /**
   * Determine if the specified variable exists in the specified environment.
   * @param {string} environmentName The name of the environment.
   * @param {string} variable The name of the environment variable.
   * @returns {boolean} Whether the variable exists in the specified environment.
   */
  public static doesVariableExistInEnvironment(environmentName: string, variable: string): boolean {
    return (
      Object.entries(this._trackedValues).find(
        ([trackedVariable, [trackedEnvironment]]) =>
          trackedVariable === variable && trackedEnvironment.getEnvironmentName() === environmentName,
      ) !== undefined
    );
  }

  /**
   * Determine if the specified variable exists in the specified environment by caller.
   * @param {string} environmentName The name of the environment.
   * @param {string} caller The name of the caller.
   * @returns {boolean} Whether the variable exists in the specified environment.
   */
  public static doesVariableExistInEnvironmentByCaller(environmentName: string, caller: string): boolean {
    return (
      Object.entries(this._trackedValues).find(
        ([, [trackedEnvironment, , , trackedCaller]]) =>
          trackedEnvironment.getEnvironmentName() === environmentName && trackedCaller === caller,
      ) !== undefined
    );
  }

  /**
   * Get the name of the environment.
   * @returns {string} The name of the environment.
   */
  public getEnvironmentName(): string {
    return this._environmentName;
  }

  /**
   * Get the environment with the specified name.
   * @param {string} environmentName The name of the environment.
   * @returns {BaseEnvironment} The environment with the specified name.
   */
  public static getEnvironment(environmentName: string): BaseEnvironment {
    return this._registeredEnvironments[environmentName];
  }

  /**
   * Start the replicator
   * @returns {void} No return value.
   */
  public static startReplicator(): void {
    this._replicator?.start(
      () => {
        baseEnvironmentLogger.information(
          'Replicator started on %s:%d',
          this._replicator?.address,
          this._replicator?.port,
        );
      },
      (message, source) => {
        baseEnvironmentLogger.information("Replicator node '%s' sent message: %s", source, message);

        const { environmentName, key, value, hostname } = JSON.parse(message);

        if (hostname === os.hostname()) {
          baseEnvironmentLogger.warning(
            "Replicator message received from self. Ignoring... (hostname: '%s')",
            hostname,
          );

          return;
        }

        if (environmentName in this._registeredEnvironments) {
          if (value === undefined) {
            this._registeredEnvironments[environmentName].removeOverriddenVariable(key);
          } else {
            this._registeredEnvironments[environmentName].overrideVariable(key, value);
          }
        }
      },
    );
  }

  /**
   * Stop the replicator
   * @returns {void} No return value.
   */
  public static stopReplicator(): void {
    this._replicator?.stopInBackground(100000);
  }

  /**
   * The protected constructor for the BaseEnvironment class.
   * @param {string} environmentName The name of the environment.
   */
  protected constructor(environmentName: string) {
    super();

    this._environmentName = environmentName;

    BaseEnvironment._registeredEnvironments[environmentName] = this;

    const settings = this._callAllGetters();

    baseEnvironmentLogger.debug(`Registered environment: ${environmentName}`);

    baseEnvironmentMetrics.environmentRegistrationTime.set(
      { environment: environmentName, variables: settings, date: new Date().toISOString() },
      1,
    );
  }
}
