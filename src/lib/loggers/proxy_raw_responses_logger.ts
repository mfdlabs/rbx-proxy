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
    File Name: proxy_raw_responses_logger.ts
    Description: Logger for the setup.
    Written by: Nikita Petko
*/

import proxyRawResponsesLoggerEnvironment from '@lib/environment/loggers/proxy_raw_responses_logger_environment';

import logger, { LogLevel } from '@mfdlabs/logging';

/**
 * Logger for the setup.
 */
export = new logger(
  proxyRawResponsesLoggerEnvironment.singleton.loggerName,
  proxyRawResponsesLoggerEnvironment.singleton.enabled ? LogLevel.Debug : LogLevel.None,
  proxyRawResponsesLoggerEnvironment.singleton.enabled,
  false,
  proxyRawResponsesLoggerEnvironment.singleton.cutLogPrefix,
  false,
);
