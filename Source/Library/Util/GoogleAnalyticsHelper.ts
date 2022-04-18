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
    File Name: GoogleAnalyticsHelper.ts
    Description: A wrapper class for the GA4 client.
    Written by: Nikita Petko
*/

import { Logger } from './Logger';
import { GlobalEnvironment } from './GlobalEnvironment';
import { GoogleAnalyticsMetricsProtocol } from 'Library/GA4/GA4';

import net from '@mfdlabs/net';

/**
 * A wrapper class for the GA4 client.
 */
export abstract class GoogleAnalyticsHelper {
    private static _isInitialized: bool = false;
    private static _clientId = net.getLocalIPv4();

    public static Initialize(): void {
        if (!GlobalEnvironment.EnableGA4Client) return;
        if (this._isInitialized) return;

        if (
            GlobalEnvironment.GA4MeasurementID &&
            GlobalEnvironment.GA4MeasurementID.length > 0 &&
            GlobalEnvironment.GA4ApiSecret &&
            GlobalEnvironment.GA4ApiSecret.length > 0
        ) {
            if (GlobalEnvironment.GA4EnableLogging) GoogleAnalyticsMetricsProtocol.OverrideLoggers(Logger.Info, Logger.Error);

            GoogleAnalyticsMetricsProtocol.Initialize(
                GlobalEnvironment.GA4MeasurementID,
                GlobalEnvironment.GA4ApiSecret,
                GlobalEnvironment.GA4EnableValidation,
            );
            this._isInitialized = true;
        }
    }

    public static async FireServerEventGA4(category: string, action: string, label?: string): Promise<void> {
        if (!GlobalEnvironment.EnableGA4Client) return;
        if (!this._isInitialized) return;

        await GoogleAnalyticsMetricsProtocol.FireEvent(this._clientId, 'server_event', {
            event_category: category,
            event_action: action,
            event_label: label ?? '',
        });
    }
}
