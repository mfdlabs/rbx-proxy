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
 * You send data using the Measurement Protocol by making HTTP POST requests to the following endpoint.
 *
 * See [URL endpoint](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference?client_type=gtag#url_endpoint)
 * @internal This is used internally by GA4.
 */
export const collectorUrl = 'https://www.google-analytics.com/mp/collect';

/**
 * You send validation requests to the following endpoint.
 *
 * This is only used in development, test and staging environments as this may add latency to your application.
 * For production environments, validation is done by the Google Analytics client.
 *
 * See [Sending events for validation](https://developers.google.com/analytics/devguides/collection/protocol/ga4/validating-events?client_type=gtag#sending_events_for_validation)
 * @internal This is used internally by GA4.
 */
export const validatorUrl = 'https://www.google-analytics.com/debug/mp/collect';

/**
 * The following event names are reserved and cannot be used.
 *
 * See [Reserved names](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference?client_type=gtag#reserved_names)
 * @internal This list is used internally by the Google Analytics client.
 */
export const reservedEventNames = [
  'ad_activeview',
  'ad_click',
  'ad_exposure',
  'ad_impression',
  'ad_query',
  'adunit_exposure',
  'app_clear_data',
  'app_install',
  'app_update',
  'app_remove',
  'error',
  'first_open',
  'first_visit',
  'in_app_purchase',
  'notification_dismiss',
  'notification_foreground',
  'notification_open',
  'notification_receive',
  'os_update',
  'screen_view',
  'session_start',
  'user_engagement',
] as const;

// map the above to a type

/**
 * The following event names are reserved and cannot be used.
 *
 * See [Reserved names](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference?client_type=gtag#reserved_names)
 * @internal This list is used internally by the Google Analytics client.
 */
export type ReservedEventName = typeof reservedEventNames[number];

/**
 * The following parameter names are reserved and cannot be used.
 *
 * See [Reserved parameter names](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference?client_type=gtag#reserved_parameter_names)
 * @internal This list is used internally by the Google Analytics client.
 */
export const reservedParameterNames = ['firebase_conversion'] as const;

// map the above to a type

/**
 * The following parameter names are reserved and cannot be used.
 *
 * See [Reserved parameter names](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference?client_type=gtag#reserved_parameter_names)
 * @internal This list is used internally by the Google Analytics client.
 */
export type ReservedParameterName = typeof reservedParameterNames[number];

/**
 * Parameter names cannot begin with the following.
 *
 * See [Reserved parameter names](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference?client_type=gtag#reserved_parameter_names)
 * @internal This list is used internally by the Google Analytics client.
 */
export const disallowedParameterStartStrings = ['google_', 'ga_', 'firebase_'] as const;

/**
 * The following user property names are reserved and cannot be used.
 *
 * See [Reserved user property names](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference?client_type=gtag#reserved_user_property_names)
 * @internal This list is used internally by the Google Analytics client.
 */
export const reservedUserPropertyNames = [
  'first_open_time',
  'first_visit_time',
  'last_deep_link_referrer',
  'user_id',
  'first_open_after_install',
] as const;

// map the above to a type
/**
 * The following user property names are reserved and cannot be used.
 *
 * See [Reserved user property names](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference?client_type=gtag#reserved_user_property_names)
 * @internal This list is used internally by the Google Analytics client.
 */
export type ReservedUserPropertyName = typeof reservedUserPropertyNames[number];

/**
 * User property names cannot begin with the following.
 *
 * See [Reserved user property names](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference?client_type=gtag#reserved_user_property_names)
 * @internal This list is used internally by the Google Analytics client.
 */
export const disallowedUserPropertyStartStrings = ['google_', 'ga_', 'firebase_'] as const;
