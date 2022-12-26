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
    File Name: setup_logger.ts
    Description: Logger for the setup.
    Written by: Nikita Petko
*/

import setupLoggerEnvironment from '@lib/environment/loggers/setup_logger_environment';

import logger from '@mfdlabs/logging';

/**
 * Logger for the setup.
 */
export = new logger(
  setupLoggerEnvironment.singleton.loggerName,
  setupLoggerEnvironment.singleton.logLevel,
  setupLoggerEnvironment.singleton.logToFileSystem,
  setupLoggerEnvironment.singleton.logToConsole,
  setupLoggerEnvironment.singleton.cutLogPrefix,
  setupLoggerEnvironment.singleton.logWithColor,
);
