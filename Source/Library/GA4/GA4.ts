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

import axios from 'axios';
import {
    CollectorUrl,
    DisallowedParameterStartStrings,
    DisallowedUserPropertyStartStrings,
    ReservedEventName,
    ReservedEventNames,
    ReservedParameterName,
    ReservedParameterNames,
    ReservedUserPropertyName,
    ReservedUserPropertyNames,
    ValidatorUrl,
} from './GA4Constants';
import { Converters } from './Helpers/Converters';
import { GA4Event } from './Models/GA4Event';
import { GoogleAnalyticsEventRequest } from './Models/GA4EventRequest';
import { GA4ValidationMessage } from './Models/GA4ValidationMessage';

/**
 * @internal
 */
// This represents the new client for Google Analytics v4.00.
export abstract class GoogleAnalyticsMetricsProtocol {
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

    private static BlockUntilTruthy(value: boolean, timeout: number, message: string) {
        this._logInfo?.call(this, 'GA4: Blocking until %s is true.', message);

        return new Promise<void>((resolve, reject) => {
            let interval = setInterval(() => {
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

    private static async ValidateEventServerSide(rawEvent: object) {
        if (!this._serverSideValidation) return true;

        this._logInfo?.call(this, 'GA4: Validating event.');

        let url = ValidatorUrl + '?measurement_id=' + encodeURI(this._metricsId) + '&api_secret=' + encodeURI(this._apiSecret);

        const response = await axios.post(url, rawEvent, {
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const validationMessages = response?.data?.validationMessages as GA4ValidationMessage[];

        if (validationMessages) {
            if (validationMessages.length === 0) return true;

            let message = '';
            for (let validationMessage of validationMessages) {
                message +=
                    validationMessage.validationCode + '(' + validationMessage.fieldPath + '): ' + validationMessage.description + '\n';
            }

            this._logError?.call(this, 'GA4: Event validation failed.\n%s', message);
            return false;
        }

        return true;
    }

    private static ValidateEvent(event: GoogleAnalyticsEventRequest) {
        if (this._serverSideValidation) return true;

        const reservedEventNames = event.Events.filter((e) => ReservedEventNames.includes(e.Name as ReservedEventName));

        if (reservedEventNames.length > 0) {
            this._logError?.call(
                this,
                "GA4: Event validation failed. Event name(s) '%s' are reserved.",
                reservedEventNames.map((e) => e.Name).join(', '),
            );
            return false;
        }

        if (event.UserProperties) {
            const reservedPropertyNames = Object.keys(event.UserProperties).filter((p) =>
                ReservedUserPropertyNames.includes(p as ReservedUserPropertyName),
            );

            if (reservedPropertyNames.length > 0) {
                this._logError?.call(
                    this,
                    "GA4: Event validation failed. User property name(s) '%s' are reserved.",
                    reservedPropertyNames.join(', '),
                );
                return false;
            }

            const disallowedPropertyNames = DisallowedUserPropertyStartStrings.some((s) =>
                Object.keys(event.UserProperties).some((p) => p.startsWith(s)),
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
        for (let evt of event.Events) {
            if (!evt.Params) continue;

            const reservedParamNames = Object.keys(evt.Params).filter((p) => ReservedParameterNames.includes(p as ReservedParameterName));

            if (reservedParamNames.length > 0) {
                this._logError?.call(
                    this,
                    "GA4: Event validation failed. Event parameter name(s) '%s' are reserved.",
                    reservedParamNames.join(', '),
                );
                return false;
            }

            const disallowedParamNames = DisallowedParameterStartStrings.some((s) => Object.keys(evt.Params).some((p) => p.startsWith(s)));

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

    private static async SendInternal(request: GoogleAnalyticsEventRequest) {
        if (!this._initialized) return;

        this._logInfo?.call(this, 'GA4: Sending event to Google Analytics.');

        let url = CollectorUrl + '?measurement_id=' + encodeURI(this._metricsId) + '&api_secret=' + encodeURI(this._apiSecret);

        // convert each key to snake case
        let snakeCaseRequest = {};
        for (let key in request) {
            this._logInfo?.call(this, 'GA4: Converting key %s to snake case.', key);
            snakeCaseRequest[Converters.ToSnakeCase(key)] = request[key];
        }

        // convert the event keys to snake case
        const events = request.Events;
        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            const snakeCaseEvent = {};
            for (let key in event) {
                this._logInfo?.call(this, 'GA4: Converting key %s to snake case.', key);
                snakeCaseEvent[Converters.ToSnakeCase(key)] = event[key];
            }
            events[i] = snakeCaseEvent as GA4Event;
        }

        const response = await axios.post(url, snakeCaseRequest, {
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!this.ValidateEvent(request)) return;
        if (!(await this.ValidateEventServerSide(snakeCaseRequest))) return;

        if (response.status != 204) {
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
    public static OverrideLoggers(
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
    public static Initialize(metricsId: string, apiSecret: string, serverSideValidation: bool = false): void {
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
    public static async FireEvent(clientId: string, eventName: string, params?: object, properties?: object): Promise<void> {
        await this.BlockUntilTruthy(this._initialized, 1000, 'GA4: Client is initialized.').catch((e) => this._logError?.call(this, e));

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
        let snakeCaseProperties = {};
        let snakeCaseParams = {};

        for (let key in properties) {
            this._logInfo?.call(this, 'GA4: Converting key %s to snake case.', key);
            snakeCaseProperties[Converters.ToSnakeCase(key)] = properties[key];
        }

        for (let key in params) {
            this._logInfo?.call(this, 'GA4: Converting key %s to snake case.', key);
            snakeCaseParams[Converters.ToSnakeCase(key)] = params[key];
        }

        // Ensure values are strings
        for (let key in snakeCaseProperties) {
            this._logInfo?.call(this, 'GA4: Converting value %s to string.', snakeCaseProperties[key]);
            snakeCaseProperties[key] = snakeCaseProperties[key].toString();
        }

        for (let key in snakeCaseParams) {
            this._logInfo?.call(this, 'GA4: Converting value %s to string.', snakeCaseParams[key]);
            snakeCaseParams[key] = snakeCaseParams[key].toString();
        }

        let request = new GoogleAnalyticsEventRequest();
        request.ClientId = clientId;
        request.UserProperties = snakeCaseProperties as Map<string, string>;
        request.Events.push({
            Name: eventName,
            Params: snakeCaseParams as Map<string, string>,
        });

        await this.SendInternal(request);
    }
}

