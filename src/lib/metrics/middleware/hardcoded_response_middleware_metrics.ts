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
    File Name: hardcoded_response_middleware_metrics.ts
    Description: Metrics for the hardcoded response middleware.
    Written by: Nikita Petko
*/

import * as prometheus from 'prom-client';

/**
 * Total number of hardcoded responses sent by the server.
 */
export const hardcodedResponses = new prometheus.Counter({
  name: 'hardcoded_responses_total',
  help: 'Total number of hardcoded responses sent by the server.',
  labelNames: ['method', 'hostname', 'endpoint', 'template', 'caller'],
});
