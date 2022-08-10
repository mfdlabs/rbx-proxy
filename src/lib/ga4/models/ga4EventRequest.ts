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

import GA4Event from './ga4Event';

/**
 * This class is a wrapper for event information. It is only ingested by the Google Analytics client.
 * @internal This class is not intended for use by application developers.
 */
export default class GA4EventRequest {
  /**
   * Required.
   * Uniquely identifies a user instance of a web client.
   * See [send event to the Measurement Protocol](https://developers.google.com/gtagjs/reference/api#get_mp_example).
   * @optional This parameter is optional.
   */
  public clientId: string;

  /**
   * Optional.
   * A unique identifier for a user.
   * See [User-ID for cross-platform analysis](https://support.google.com/analytics/answer/9213390) for more information on this identifier
   * @note **user_id** may only include **utf-8**z characters.
   * @optional This parameter is optional.
   */
  public userId?: string;

  /**
   * Optional.
   * A Unix timestamp (in microseconds) for the time to associate with the event.
   * This should only be set to record events that happened in the past.
   * This value can be overridden via `user_property` or event timestamps.
   * Events can be backdated up to 3 calendar days based on the property's timezone.
   * @note This value should be in *microseconds*, not *milliseconds*.
   * @optional This parameter is optional.
   */
  public timestampMicros?: number;

  /**
   * Optional.
   * The user properties for the measurement.
   * See [User properties](https://developers.google.com/analytics/devguides/collection/protocol/ga4/user-properties) for more information.
   * @optional This parameter is optional.
   */
  public userProperties?: Map<string, string>;

  /**
   * Optional.
   * Set to true to indicate these events should not be used for personalized ads.
   * @optional This parameter is optional.
   */
  public nonPersonalizedAds?: boolean;

  /**
   * **Required**. An array of event items.
   * Up to 25 events can be sent per request.
   * See the [events](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference/events) reference for all valid events.
   */
  public events: GA4Event[] = [];
}
