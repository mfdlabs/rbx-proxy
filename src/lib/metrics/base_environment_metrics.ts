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
    File Name: base_environment_metrics.ts
    Description: Metrics for the base environment class.
    Written by: Nikita Petko
*/

import * as prometheus from 'prom-client';

/**
 * Number of times an environment variable was read.
 */
export const variableReads = new prometheus.Counter({
  name: 'environment_variable_reads',
  help: 'Number of times an environment variable was read',
  labelNames: ['environment', 'variable', 'overridden'],
});

/**
 * Number of times an environment variable was overridden.
 */
export const variablesOverridden = new prometheus.Counter({
  name: 'environment_variables_overridden',
  help: 'Number of times an environment variable was overridden',
  labelNames: ['environment', 'variable'],
});

/**
 * Number of times an environment variable was removed from the override list.
 */
export const variablesReset = new prometheus.Counter({
  name: 'environment_variables_reset',
  help: 'Number of times an environment variable was removed from the override list',
  labelNames: ['environment', 'variable'],
});

/**
 * Environment registristration time.
 */
export const environmentRegistrationTime = new prometheus.Gauge({
  name: 'environment_registration_time',
  help: 'Environment registristration time',
  labelNames: ['environment', 'variables', 'date'],
});
