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
    File Name: dns_metrics.ts
    Description: Metrics for DNS clients.
    Written by: Nikita Petko
*/

import * as prometheus from 'prom-client';

/**
 * Number of times a DNS query was sent.
 */
export const queriesSent = new prometheus.Counter({
  name: 'dns_queries_sent',
  help: 'Number of times a DNS query was sent',
  labelNames: ['server', 'type', 'class', 'name'],
});

/**
 * Number of times UDP DNS query was sent.
 */
export const udpQueriesSent = new prometheus.Counter({
  name: 'dns_udp_queries_sent',
  help: 'Number of times UDP DNS query was sent',
  labelNames: ['server', 'type', 'class', 'name'],
});

/**
 * Number of times TCP DNS query was sent.
 */
export const tcpQueriesSent = new prometheus.Counter({
  name: 'dns_tcp_queries_sent',
  help: 'Number of times TCP DNS query was sent',
  labelNames: ['server', 'type', 'class', 'name'],
});

/**
 * Number of failed DNS queries.
 */
export const queriesFailed = new prometheus.Counter({
  name: 'dns_queries_failed',
  help: 'Number of failed DNS queries',
  labelNames: ['server', 'type', 'class', 'name'],
});

/**
 * Average time it took to resolve a DNS query.
 */
export const queryTime = new prometheus.Histogram({
  name: 'dns_query_time',
  help: 'Average time it took to resolve a DNS query',
  labelNames: ['server', 'type', 'class', 'name'],
  buckets: [0.001, 0.01, 0.1, 1, 10, 100, 1000],
});
