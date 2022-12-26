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
    File Name: send_axios_request_middleware_metrics.ts
    Description: Metrics for the send axios request middleware.
    Written by: Nikita Petko
*/

import * as prometheus from 'prom-client';

/**
 * Total number of proxy requests.
 */
export const totalProxyRequests = new prometheus.Counter({
  name: 'axios_request_total',
  help: 'Total number of proxy requests.',
  labelNames: ['method', 'upstream', 'downstream', 'caller'],
});

/**
 * Total number of proxy requests with forwarded headers.
 */
export const requestsWithForwardedHeaders = new prometheus.Counter({
  name: 'axios_requests_with_forwarded_headers_total',
  help: 'Total number of proxy requests with forwarded headers.',
  labelNames: ['method', 'upstream', 'downstream', 'caller'],
});

/**
 * Total number of proxy requests with a body.
 */
export const requestsWithBody = new prometheus.Counter({
  name: 'axios_requests_with_body_total',
  help: 'Total number of proxy requests with a body.',
  labelNames: ['method', 'upstream', 'downstream', 'caller'],
});

/**
 * Total number of proxy requests with a transformed origin.
 */
export const requestsWithTransformedOrigin = new prometheus.Counter({
  name: 'axios_requests_with_transformed_origin_total',
  help: 'Total number of proxy requests with a transformed origin.',
  labelNames: ['method', 'upstream', 'downstream', 'actual_origin', 'transformed_origin', 'caller'],
});

/**
 * Total number of proxy requests with a transformed referer.
 */
export const requestsWithTransformedReferer = new prometheus.Counter({
  name: 'axios_requests_with_transformed_referer_total',
  help: 'Total number of proxy requests with a transformed referer.',
  labelNames: ['method', 'upstream', 'downstream', 'actual_referer', 'transformed_referer', 'caller'],
});

/**
 * Total number of proxy requests without certificate verification.
 */
export const requestsWithoutCertificateVerification = new prometheus.Counter({
  name: 'axios_requests_without_certificate_verification_total',
  help: 'Total number of proxy requests without certificate verification.',
  labelNames: ['method', 'upstream', 'downstream', 'caller'],
});

/**
 * Total number of proxy requests that responded with a debug message.
 */
export const totalDebugProxyRequests = new prometheus.Counter({
  name: 'axios_debug_requests_total',
  help: 'Total number of debug proxy requests.',
  labelNames: ['method', 'upstream', 'downstream', 'caller'],
});

/**
 * Total number of proxy requests that timed out.
 */
export const timedOutProxyRequests = new prometheus.Counter({
  name: 'axios_requests_timed_out_total',
  help: 'Total number of timed out proxy requests.',
  labelNames: ['method', 'upstream', 'downstream', 'caller'],
});

/**
 * Total number of proxy requests that responded with unknown errors.
 */
export const unknownProxyErrors = new prometheus.Counter({
  name: 'axios_requests_with_unknown_error_total',
  help: 'Total number of unknown proxy errors.',
  labelNames: ['method', 'upstream', 'downstream', 'caller'],
});

/**
 * Proxy request duration.
 */
export const proxyRequestDuration = new prometheus.Histogram({
  name: 'axios_requests_duration_seconds',
  help: 'Duration of proxy requests.',
  labelNames: ['method', 'upstream', 'downstream', 'caller'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10],
});

/**
 * Total number of successful proxy requests.
 */
export const proxySuccessfulRequests = new prometheus.Counter({
  name: 'axios_successful_requests_total',
  help: 'Total number of successful proxy requests.',
  labelNames: ['method', 'upstream', 'downstream', 'status', 'caller'],
});

/**
 * Total number of proxy requests that responded with a redirect.
 */
export const proxyRequestsWithTransformedRedirectLocation = new prometheus.Counter({
  name: 'axios_requests_with_transformed_redirect_location_total',
  help: 'Total number of proxy requests with a transformed redirect location.',
  labelNames: [
    'method',
    'upstream',
    'downstream',
    'actual_redirect_location',
    'transformed_redirect_location',
    'caller',
  ],
});

/**
 * Total number of proxy requests that responded with a CORS override.
 */
export const proxyRequestsWithCorsOverride = new prometheus.Counter({
  name: 'axios_requests_with_cors_override_total',
  help: 'Total number of proxy requests with a CORS override.',
  labelNames: ['method', 'upstream', 'downstream', 'caller'],
});

/**
 * Total number of proxy requests that had response bodies that aborted.
 */
export const proxyRequestsThatHadAbortedResponses = new prometheus.Counter({
  name: 'axios_requests_with_aborted_response_total',
  help: 'Total number of proxy requests that had an aborted response.',
  labelNames: ['method', 'upstream', 'downstream', 'caller'],
});
