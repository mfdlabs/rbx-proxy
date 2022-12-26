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
    File Name: healthcheck_middleware_logger.ts
    Description: Logger for the healthcheck middleware.
    Written by: Nikita Petko
*/

import healthcheckMiddlewareLoggerEnvironment from '@lib/environment/loggers/middleware/healthcheck_middleware_logger_environment';

import logger from '@mfdlabs/logging';

/**
 * Logger for the healthcheck middleware.
 */
export = new logger(
    healthcheckMiddlewareLoggerEnvironment.singleton.loggerName,
  healthcheckMiddlewareLoggerEnvironment.singleton.logLevel,
  healthcheckMiddlewareLoggerEnvironment.singleton.logToFileSystem,
  healthcheckMiddlewareLoggerEnvironment.singleton.logToConsole,
  healthcheckMiddlewareLoggerEnvironment.singleton.cutLogPrefix,
  healthcheckMiddlewareLoggerEnvironment.singleton.logWithColor,
);
