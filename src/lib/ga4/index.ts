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

import {
  collectorUrl,
  disallowedParameterStartStrings,
  disallowedUserPropertyStartStrings,
  ReservedEventName,
  reservedEventNames,
  ReservedParameterName,
  reservedParameterNames,
  ReservedUserPropertyName,
  reservedUserPropertyNames,
  validatorUrl,
} from './ga4Constants';
import converters from './helpers/converters';
import ga4Event from './models/ga4Event';
import ga4EventRequest from './models/ga4EventRequest';
import ga4ValidationMessage from './models/ga4ValidationMessage';

import axios from 'axios';

/**
 * This represents the new client for Google Analytics v4.00.
 */
abstract class GA4 {
  // Determines if the GA client is initialized.
  private static _initialized: boolean = false;

  // The Metrics ID
  private static _metricsId: string;

  // The API secret.
  private static _apiSecret: string;

  // Determines if server side validation is enabled.
  private static _serverSideValidation: boolean = false;

  // The info logger function.
  private static _logInfo: (message: string, ...args: any[]) => void;

  // The error logger function.
  private static _logError: (message: string, ...args: any[]) => void;

  private static blockUntilTruthy(value: boolean, timeout: number, message: string) {
    this._logInfo?.call(this, 'GA4: Blocking until %s is true.', message);

    return new Promise<void>((resolve, reject) => {
      const interval = setInterval(() => {
        if (value) {
          clearInterval(interval);
          resolve();
        }

        if (timeout <= 0) {
          clearInterval(interval);
          reject(new Error(`GA4: Timeout while waiting for ${message}`));
        }
      }, timeout);
    });
  }

  private static async validateEventServerSide(rawEvent: object) {
    if (!this._serverSideValidation) return true;

    this._logInfo?.call(this, 'GA4: Validating event.');

    const url =
      validatorUrl + '?measurement_id=' + encodeURI(this._metricsId) + '&api_secret=' + encodeURI(this._apiSecret);

    const response = await axios.post(url, rawEvent, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const validationMessages = response?.data?.validationMessages as ga4ValidationMessage[];

    if (validationMessages) {
      if (validationMessages.length === 0) return true;

      let message = '';
      for (const validationMessage of validationMessages) {
        message +=
          validationMessage.validationCode +
          '(' +
          validationMessage.fieldPath +
          '): ' +
          validationMessage.description +
          '\n';
      }

      this._logError?.call(this, 'GA4: Event validation failed.\n%s', message);
      return false;
    }

    return true;
  }

  private static validateEvent(event: ga4EventRequest) {
    const eventNames = event.events.filter((e) => reservedEventNames.includes(e.name as ReservedEventName));

    if (eventNames.length > 0) {
      this._logError?.call(
        this,
        "GA4: Event validation failed. Event name(s) '%s' are reserved.",
        eventNames.map((e) => e.name).join(', '),
      );
      return false;
    }

    if (event.userProperties) {
      const reservedPropertyNames = Object.keys(event.userProperties).filter((p) =>
        reservedUserPropertyNames.includes(p as ReservedUserPropertyName),
      );

      if (reservedPropertyNames.length > 0) {
        this._logError?.call(
          this,
          "GA4: Event validation failed. User property name(s) '%s' are reserved.",
          reservedPropertyNames.join(', '),
        );
        return false;
      }

      const disallowedPropertyNames = disallowedUserPropertyStartStrings.some((s) =>
        Object.keys(event.userProperties).some((p) => p.startsWith(s)),
      );

      if (disallowedPropertyNames) {
        this._logError?.call(
          this,
          "GA4: Event validation failed. User property name(s) '%s' are disallowed.",
          reservedPropertyNames.join(', '),
        );
        return false;
      }
    }

    // Iterate each event and validate the params.
    for (const evt of event.events) {
      if (!evt.params) continue;

      const reservedParamNames = Object.keys(evt.params).filter((p) =>
        reservedParameterNames.includes(p as ReservedParameterName),
      );

      if (reservedParamNames.length > 0) {
        this._logError?.call(
          this,
          "GA4: Event validation failed. Event parameter name(s) '%s' are reserved.",
          reservedParamNames.join(', '),
        );
        return false;
      }

      const disallowedParamNames = disallowedParameterStartStrings.some((s) =>
        Object.keys(evt.params).some((p) => p.startsWith(s)),
      );

      if (disallowedParamNames) {
        this._logError?.call(
          this,
          "GA4: Event validation failed. Event parameter name(s) '%s' are disallowed.",
          reservedParamNames.join(', '),
        );
        return false;
      }
    }

    return true;
  }

  private static async sendInternal(request: ga4EventRequest) {
    if (!this._initialized) return;

    this._logInfo?.call(this, 'GA4: Sending event to Google Analytics.');

    const url =
      collectorUrl + '?measurement_id=' + encodeURI(this._metricsId) + '&api_secret=' + encodeURI(this._apiSecret);

    // convert each key to snake case
    const snakeCaseRequest = {};
    for (const key of Object.keys(request)) {
      this._logInfo?.call(this, 'GA4: Converting key %s to snake case.', key);
      snakeCaseRequest[converters.toSnakeCase(key)] = request[key];
    }

    // convert the event keys to snake case
    const events = request.events;
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const snakeCaseEvent = {};
      for (const key of Object.keys(event)) {
        this._logInfo?.call(this, 'GA4: Converting key %s to snake case.', key);
        snakeCaseEvent[converters.toSnakeCase(key)] = event[key];
      }
      events[i] = snakeCaseEvent as ga4Event;
    }

    if (!this.validateEvent(request)) return;
    if (!(await this.validateEventServerSide(snakeCaseRequest))) return;

    const response = await axios.post(url, snakeCaseRequest, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.status !== 204) {
      this._logError?.call(this, 'GA4: Unknown error: %s', response.data);
      return;
    }

    this._logInfo?.call(this, 'GA4: Event sent to Google Analytics.');
  }

  /**
   * Overrides the default logger functions.
   * @param {(message: string, ...args: any[]) => void} logInfo The info logger function.
   * @param {(message: string, ...args: any[]) => void} logError The error logger function.
   * @returns {void} Nothing.
   */
  public static overrideLoggers(
    logInfo: (message: string, ...args: any[]) => void,
    logError: (message: string, ...args: any[]) => void,
  ): void {
    this._logInfo?.call(this, 'GA4: Overriding loggers.');
    this._logInfo = logInfo;
    this._logError = logError;
  }

  /**
   * Initializes the library. This must be called before any other method.
   * This can only be called once.
   * @param {string} metricsId The metrics ID.
   * @param {string} apiSecret The API secret.
   * @param {boolean} serverSideValidation Whether to perform server side validation.
   * @returns {void} Nothing.
   */
  public static initialize(metricsId: string, apiSecret: string, serverSideValidation: boolean = false): void {
    if (this._initialized) return;

    this._logInfo?.call(this, 'GA4: Initializing Google Analytics client.');

    this._metricsId = metricsId;
    this._apiSecret = apiSecret;
    this._serverSideValidation = serverSideValidation;

    this._initialized = true;
  }

  /**
   * Sends an event to Google Analytics.
   *
   * As of now, Metrics Protocol only supports sending events.
   * @param {string} clientId The client ID.
   * @param {string} eventName The event name.
   * @param {object?} params The event parameters.
   * @param {object?} properties The user properties.
   * @returns {Promise<void>} Nothing.
   */
  public static async fireEventAsync(
    clientId: string,
    eventName: string,
    params?: object,
    properties?: object,
  ): Promise<void> {
    await this.blockUntilTruthy(this._initialized, 1000, 'GA4: Client is initialized.').catch((e) =>
      this._logError?.call(this, e),
    );

    this._logInfo?.call(this, "GA4: Sending event '%s' to Google Analytics.", eventName);

    if (!clientId) {
      this._logError?.call(this, 'GA4: Cannot fire event, clientId is not specified.');
      throw new Error('GA4: Cannot fire event, clientId is not specified.');
    }
    if (!eventName) {
      this._logError?.call(this, 'GA4: Cannot fire event, eventName is not specified.');
      throw new Error('GA4: Cannot fire event, eventName is not specified.');
    }

    if (!properties) {
      this._logInfo?.call(this, 'GA4: Null user properties, defaulting to empty object.');
      properties = new Map<string, object>();
    }

    if (!params) {
      this._logInfo?.call(this, 'GA4: Null event parameters, defaulting to empty object.');
      params = new Map<string, object>();
    }

    // Convert the properties and params to snake case
    const snakeCaseProperties = {};
    const snakeCaseParams = {};

    for (const key of Object.keys(properties)) {
      this._logInfo?.call(this, 'GA4: Converting key %s to snake case.', key);
      snakeCaseProperties[converters.toSnakeCase(key)] = properties[key];
    }

    for (const key of Object.keys(params)) {
      this._logInfo?.call(this, 'GA4: Converting key %s to snake case.', key);
      snakeCaseParams[converters.toSnakeCase(key)] = params[key];
    }

    // Ensure values are strings
    for (const key of Object.keys(snakeCaseProperties)) {
      this._logInfo?.call(this, 'GA4: Converting value %s to string.', snakeCaseProperties[key]);
      snakeCaseProperties[key] = snakeCaseProperties[key].toString();
    }

    for (const key of Object.keys(snakeCaseParams)) {
      this._logInfo?.call(this, 'GA4: Converting value %s to string.', snakeCaseParams[key]);
      snakeCaseParams[key] = snakeCaseParams[key].toString();
    }

    const request = new ga4EventRequest();
    request.clientId = clientId;
    request.userProperties = snakeCaseProperties as Map<string, string>;
    request.events.push({
      name: eventName,
      params: snakeCaseParams as Map<string, string>,
    });

    await this.sendInternal(request);
  }
}

export = GA4;
