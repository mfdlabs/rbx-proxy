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
    File Name: crawler_check_middleware_logger.ts
    Description: Logger for the crawler check middleware.
    Written by: Nikita Petko
*/

import crawlerCheckMiddlewareLoggerEnvironment from '@lib/environment/loggers/middleware/crawler_check_middleware_logger_environment';

import logger from '@mfdlabs/logging';

/**
 * Logger for the crawler check middleware.
 */
export = new logger(
  crawlerCheckMiddlewareLoggerEnvironment.singleton.loggerName,
  crawlerCheckMiddlewareLoggerEnvironment.singleton.logLevel,
  crawlerCheckMiddlewareLoggerEnvironment.singleton.logToFileSystem,
  crawlerCheckMiddlewareLoggerEnvironment.singleton.logToConsole,
  crawlerCheckMiddlewareLoggerEnvironment.singleton.cutLogPrefix,
  crawlerCheckMiddlewareLoggerEnvironment.singleton.logWithColor,
);
