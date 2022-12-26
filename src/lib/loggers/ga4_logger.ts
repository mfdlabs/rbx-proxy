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
    File Name: ga4_logger.ts
    Description: Logger for the ga4 client.
    Written by: Nikita Petko
*/

import ga4LoggerEnvironment from '@lib/environment/loggers/ga4_logger_environment';

import logger from '@mfdlabs/logging';

/**
 * Logger for the ga4 client.
 */
export = new logger(
  ga4LoggerEnvironment.singleton.loggerName,
  ga4LoggerEnvironment.singleton.logLevel,
  ga4LoggerEnvironment.singleton.logToFileSystem,
  ga4LoggerEnvironment.singleton.logToConsole,
  ga4LoggerEnvironment.singleton.cutLogPrefix,
  ga4LoggerEnvironment.singleton.logWithColor,
);
