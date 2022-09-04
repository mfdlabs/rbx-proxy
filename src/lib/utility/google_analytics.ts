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
    File Name: google_analytics.ts
    Description: A wrapper class for the GA4 client.
    Written by: Nikita Petko
*/

import ga4 from '@lib/ga4';
import logger from '@lib/logger';
import environment from '@lib/environment';

import net from '@mfdlabs/net';

const ga4logger = new logger(
  'ga4',
  environment.logLevel,
  environment.logToFileSystem,
  environment.logToConsole,
  environment.loggerCutPrefix,
);

/**
 * A wrapper class for the GA4 client.
 */
export default abstract class GoogleAnalytics {
  private static _isInitialized = false;
  private static _clientId = net.getLocalIPv4();

  public static initialize(): void {
    if (!environment.enableGA4Client) return;
    if (this._isInitialized) return;

    if (
      environment.ga4MeasurementID &&
      environment.ga4MeasurementID.length > 0 &&
      environment.ga4APISecret &&
      environment.ga4APISecret.length > 0
    ) {
      if (environment.ga4EnableLogging) {
        ga4.overrideLoggers(ga4logger.information.bind(ga4logger), ga4logger.error.bind(ga4logger));
      }

      ga4.initialize(environment.ga4MeasurementID, environment.ga4APISecret, environment.ga4EnableValidation);
      this._isInitialized = true;
    }
  }

  public static async fireServerEventGA4(category: string, action: string, label?: string): Promise<void> {
    if (!environment.enableGA4Client) return;
    if (!this._isInitialized) return;

    await ga4.fireEventAsync(this._clientId, 'server_event', {
      event_action: action,
      event_category: category,
      event_label: label ?? '',
    });
  }
}
