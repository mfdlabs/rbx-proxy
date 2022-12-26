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
    File Name: healthcheck_middleware_metrics.ts
    Description: Metrics for the healthcheck middleware.
    Written by: Nikita Petko
*/

import * as prometheus from 'prom-client';

/**
 * The number of health checks.
 */
export const healthChecks = new prometheus.Counter({
  name: 'health_checks_total',
  help: 'The health of the server',
  labelNames: ['caller'],
});
