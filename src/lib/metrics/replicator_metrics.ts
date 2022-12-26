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
    File Name: replicator_metrics.ts
    Description: Metrics for multicast replicator clients.
    Written by: Nikita Petko
*/

import * as prometheus from 'prom-client';

/**
 * Number of times a message was sent.
 */
export const messagesSent = new prometheus.Counter({
  name: 'replicator_messages_sent',
  help: 'Number of times a message was sent',
  labelNames: ['group'],
});

/**
 * Number of times a message was received.
 */
export const messagesReceived = new prometheus.Counter({
  name: 'replicator_messages_received',
  help: 'Number of times a message was received',
  labelNames: ['group'],
});
