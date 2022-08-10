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
	File Name: stdin_handler.ts
	Description: This file hooks onto the standard input stream and listens to exit signals.
	Written by: Nikita Petko
*/

import logger from '@lib/logger';
import environment from '@lib/environment';

const stdinLogger = new logger(
  'stdin-handler',
  environment.logLevel,
  environment.logToFileSystem,
  environment.logToConsole,
  environment.loggerCutPrefix,
);

export default function () {
  process.stdin.resume();

  process.on('SIGINT', () => {
    stdinLogger.log('Got SIGINT. Will start shutdown procedure within 1 second.');
    setTimeout(() => {
      logger.tryClearLocalLog();
      process.exit(0);
    }, 1000);
  });
  process.on('SIGUSR1', () => {
    stdinLogger.log('Got SIGUSR1. Will start shutdown procedure within 1 second.');
    setTimeout(() => {
      return process.exit(0);
    }, 1000);
  });
  process.on('SIGUSR2', () => {
    stdinLogger.log('Got SIGUSR2. Will clear LocalLog within 1 second.');
    setTimeout(() => {
      logger.tryClearLocalLog();
    }, 1000);
  });

  process.on('SIGTERM', () => {
    stdinLogger.log('Got SIGTERM. Will start shutdown procedure within 1 second.');
    setTimeout(() => {
      logger.tryClearLocalLog(true);
      process.exit(0);
    }, 1000);
  });

  process.on('uncaughtException', (ex) => {
    stdinLogger.error('*** BEGIN PROCESS EXCEPTION ***');
    stdinLogger.error('REASON FOR EXCEPTION: %s', ex.stack || '');
    stdinLogger.error('*** END PROCESS EXCEPTION ***');

    if (environment.exitOnUncaughtException) process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    stdinLogger.error('*** BEGIN PROCESS REJECTION ***');
    stdinLogger.error('REASON FOR REJECTION: %s', reason || '');
    stdinLogger.error('*** END PROCESS REJECTION ***');

    if (environment.exitOnUnhandledRejection) process.exit(1);
  });

  if (process.stdin.setRawMode) process.stdin.setRawMode(true);

  process.stdin.setEncoding('utf8');

  process.stdin.on('data', (key: string) => {
    if (key === '\u0003' || key === '\u001b') {
      return process.emit('SIGINT', 'SIGINT');
    }
  });
}
