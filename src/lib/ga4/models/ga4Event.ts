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

/**
 * Represents a Google Analytics Metrics protocol event as defined in
 * https://developers.google.com/analytics/devguides/collection/protocol/v1/reference#event
 * @internal This class is not intended for use by application developers.
 */
class GA4Event {
  /**
   * **Required**. The name for the event.
   * See the [events](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference/events) reference for all options.
   */
  public name: string;

  /**
   * **Optional**. The parameters for the event.
   * See [events](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference/events) for the suggested parameters for each event.
   */
  public params: Map<string, string>;
}

export = GA4Event;
