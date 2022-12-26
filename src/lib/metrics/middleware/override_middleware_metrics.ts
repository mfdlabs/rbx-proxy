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
    File Name: override_mddileware_metrics.ts
    Description: Metrics for the override middleware.
    Written by: Nikita Petko
*/

import * as prometheus from 'prom-client';

/**
 * Response time histogram.
 */
export const responseTimeHistogram = new prometheus.Histogram({
  name: 'request_duration_seconds',
  help: 'Duration of HTTP requests in seconds.',
  labelNames: ['method', 'hostname', 'endpoint', 'status', 'caller'],
  buckets: [0.003, 0.03, 0.1, 0.3, 1.5, 10],
});
