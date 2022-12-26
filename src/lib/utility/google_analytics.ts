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
import ga4logger from '@lib/loggers/ga4_logger';
import ga4Environment from '@lib/environment/ga4_environment';

import net from '@mfdlabs/net';

/**
 * A wrapper class for the GA4 client.
 */
export default abstract class GoogleAnalytics {
  private static _isInitialized = false;
  private static _clientId = net.getLocalIPv4();

  public static initialize(): void {
    if (!ga4Environment.singleton.enableGA4Client) return;
    if (this._isInitialized) return;

    if (
      ga4Environment.singleton.ga4MeasurementID &&
      ga4Environment.singleton.ga4MeasurementID.length > 0 &&
      ga4Environment.singleton.ga4APISecret &&
      ga4Environment.singleton.ga4APISecret.length > 0
    ) {
      if (ga4Environment.singleton.ga4EnableLogging) {
        ga4.overrideLoggers(ga4logger.information.bind(ga4logger), ga4logger.error.bind(ga4logger));
      }

      ga4.initialize(
        ga4Environment.singleton.ga4MeasurementID,
        ga4Environment.singleton.ga4APISecret,
        ga4Environment.singleton.ga4EnableValidation,
      );
      this._isInitialized = true;
    }
  }

  public static async fireServerEventGA4(category: string, action: string, label?: string): Promise<void> {
    if (!ga4Environment.singleton.enableGA4Client) return;
    if (!this._isInitialized) return;

    await ga4.fireEventAsync(this._clientId, 'server_event', {
      event_action: action,
      event_category: category,
      event_label: label ?? '',
    });
  }
}
