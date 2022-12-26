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
    File Name: hostname_resolution_middleware_metrics.ts
    Description: Metrics for the hostname resolution middleware.
    Written by: Nikita Petko
*/

import * as prometheus from 'prom-client';

/**
 * Number of requests that had no hostname.
 */
export const requestThatHadNoHostname = new prometheus.Counter({
  name: 'requests_that_had_no_hostname_total',
  help: 'Total number of requests that had no hostname.',
  labelNames: ['method', 'endpoint', 'caller'],
});

/**
 * Number of hostnames that did not resolve.
 */
export const hostnamesThatDidNotResolve = new prometheus.Counter({
  name: 'hostnames_that_did_not_resolve_total',
  help: 'Total number of hostnames that did not resolve.',
  labelNames: ['hostname'],
});
