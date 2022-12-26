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
    File Name: reverse_proxy_middleware_metrics.ts
    Description: Metrics for the reverse middleware.
    Written by: Nikita Petko
*/

import * as prometheus from 'prom-client';

/**
 * Requests that are from Cloudflare.
 */
export const requestsThatAreFromCloudflare = new prometheus.Counter({
  name: 'requests_from_cloudflare_total',
  help: 'Total number of requests that are from Cloudflare',
  labelNames: ['method', 'hostname', 'endpoint', 'caller'],
});

/**
 * Requests that are from authorized reverse proxies.
 */
export const requestsThatAreFromAuthorizedReverseProxies = new prometheus.Counter({
  name: 'requests_from_authorized_reverse_proxies_total',
  help: 'Total number of requests that are from authorized reverse proxies',
  labelNames: ['method', 'hostname', 'endpoint', 'caller'],
});

/**
 * Requests that had their IP address overriden.
 */
export const overridenIpAddresses = new prometheus.Counter({
  name: 'overriden_ip_addresses_total',
  help: 'Total number of overriden IP addresses',
  labelNames: ['actual_ip', 'overriden_ip'],
});

/**
 * Requests that had their port overriden.
 */
export const overridenPorts = new prometheus.Counter({
  name: 'overriden_ports_total',
  help: 'Total number of overriden ports',
  labelNames: ['actual_port', 'overriden_port'],
});

/**
 * Requests that had their hostname overriden.
 */
export const overridenHostnames = new prometheus.Counter({
  name: 'overriden_hostnames_total',
  help: 'Total number of overriden hostnames',
  labelNames: ['actual_hostname', 'overriden_hostname'],
});

/**
 * Requests that had their protocol overriden.
 */
export const overridenProtocols = new prometheus.Counter({
  name: 'overriden_protocols_total',
  help: 'Total number of overriden protocols',
  labelNames: ['actual_protocol', 'overriden_protocol'],
});
