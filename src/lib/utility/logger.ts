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
    File Name: logger.ts
    Description: A console and file logger.
    Written by: Nikita Petko
*/

import webUtility from '@lib/utility/webUtility';
import environment from '@lib/utility/environment';
import { projectDirectoryName } from '@lib/directories';

import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import net from '@mfdlabs/net';

/**
 * Log colors.
 * Only ingested internally.
 */
enum LogColor {
  Reset = '\x1b[0m',
  BrightBlack = '\x1b[90m',
  BrightRed = '\x1b[91m',
  BrightYellow = '\x1b[93m',
  BrightBlue = '\x1b[94m',
  BrightMagenta = '\x1b[95m',
  BrightWhite = '\x1b[97m',
}

/**
 * Log level to number resolution table.
 * Only ingested internally.
 */
const logLevels = ['none', 'error', 'warning', 'info', 'debug', 'verbose'];

/**
 * A simple console and file Logger.
 */
abstract class Logger {
  ////////////////////////////////////////////////////////////////////////////////
  // Private fields
  ////////////////////////////////////////////////////////////////////////////////

  private static readonly _localIP = net.getLocalIPv4();
  private static readonly _machineId = webUtility.getMachineID();
  private static readonly _baseDirName = Logger._getBaseDirName();
  private static readonly _fileName = util.format(
    'log_%s_%s_%s.log',
    process.version,
    Logger._getFileSafeDateNowIsoString(),
    process.pid.toString(16).toUpperCase(),
  );
  private static readonly _logFileDir = Logger._getDirNameByOS();
  private static readonly _fullyQualifiedLogFileName = path.join(Logger._logFileDir, Logger._fileName);
  private static readonly _processId = process.pid.toString(16);
  private static readonly _platform = process.platform;
  private static readonly _architechture = process.arch;
  private static readonly _nodeVersion = process.versions.node;
  private static readonly _architechtureFmt = `${Logger._platform}-${Logger._architechture}`;
  private static _logLevel = environment.logLevel.toLowerCase();

  ////////////////////////////////////////////////////////////////////////////////

  ////////////////////////////////////////////////////////////////////////////////
  // Private Helper Methods
  ////////////////////////////////////////////////////////////////////////////////

  private static _getFileSafeDateNowIsoString() {
    const date = new Date();
    return date
      .toISOString()
      .replace(/[^a-z0-9_-]/gi, '')
      .replace(/-/g, '');
  }
  private static _getBaseDirName() {
    if (process.platform === 'win32') {
      return projectDirectoryName.replace(/\//g, '\\');
    }

    return projectDirectoryName;
  }

  private static _getNowAsIsoString() {
    return new Date().toISOString();
  }

  private static _getUptime() {
    return process.uptime().toFixed(7).toString();
  }

  private static _constructLoggerMessage(type: string, message: string, ...args: any[]) {
    const formattedMessage = util.format(message, ...args);

    return util.format(
      '[%s][%s][%s][%s][%s][%s][%s][%s][server][%s] %s\n',
      Logger._getNowAsIsoString(),
      Logger._getUptime(),
      Logger._processId,
      Logger._architechtureFmt,
      Logger._nodeVersion,
      Logger._localIP,
      Logger._machineId,
      Logger._baseDirName,
      type.toUpperCase(),
      formattedMessage,
    );
  }

  private static _getDirNameByOS() {
    switch (process.platform) {
      case 'win32':
        return path.join(process.env.LocalAppData, 'MFDLABS', 'Logs');
      case 'linux' || 'darwin':
        return path.join(process.env.HOME, '.cache', 'MFDLABS', 'Logs');
    }
  }

  private static async _logLocally(type: string, message: string, ...args: any[]) {
    if (!environment.logToFileSystem) return;

    if (!fs.existsSync(Logger._logFileDir)) fs.mkdirSync(Logger._logFileDir, { recursive: true });

    fs.appendFileSync(Logger._fullyQualifiedLogFileName, Logger._constructLoggerMessage(type, message, ...args));
  }

  private static _getColorSection(content: any) {
    return util.format('[%s%s%s]', LogColor.BrightBlack, content, LogColor.Reset);
  }

  private static _getSharedColorString() {
    return util.format(
      '%s%s%s%s%s%s%s%s%s',
      Logger._getColorSection(Logger._getNowAsIsoString()),
      Logger._getColorSection(Logger._getUptime()),
      Logger._getColorSection(Logger._processId),
      Logger._getColorSection(Logger._architechtureFmt),
      Logger._getColorSection(Logger._nodeVersion),
      Logger._getColorSection(Logger._localIP),
      Logger._getColorSection(Logger._machineId),
      Logger._getColorSection(Logger._baseDirName),
      Logger._getColorSection('server'),
    );
  }

  private static async _logColorString(type: string, color: LogColor, message: string, ...args: any[]) {
    if (!environment.logToConsole) return;

    const formattedMessage = util.format(message, ...args);

    const formattedStr = util.format(
      '%s[%s%s%s] %s%s%s',
      Logger._getSharedColorString(),
      color,
      type.toUpperCase(),
      LogColor.Reset,
      color,
      formattedMessage,
      LogColor.Reset,
    );

    if (type.toLowerCase() === 'trace') {
      console.trace(formattedStr);
    } else {
      console.log(formattedStr);
    }
  }

  private static _checkLogLevel(type: string): boolean {
    // If the environment loglevel is neither of the valid values, set it to 'info'
    if (!logLevels.includes(Logger._logLevel)) {
      Logger._logLevel = 'info';
    }

    const actualLogLevel = logLevels.indexOf(Logger._logLevel);
    const logLevelToCheck = logLevels.indexOf(type);

    return actualLogLevel >= logLevelToCheck;
  }

  ////////////////////////////////////////////////////////////////////////////////

  ////////////////////////////////////////////////////////////////////////////////
  // Public Helper Methods
  ////////////////////////////////////////////////////////////////////////////////

  /**
   * Requests that the local log file directory be cleared.
   * @param {boolean} overrideGlobalConfig - If true, the global config will be ignored.
   * @returns {void} - Nothing.
   */
  public static tryClearLocalLog(overrideGlobalConfig: boolean = false): void {
    Logger.log('Try clear logs.');

    if (environment.persistLocalLogs) {
      if (overrideGlobalConfig) {
        Logger.warning('Overriding global config when clearing logs.');
      } else {
        Logger.warning('The local log is set to persist. Please change ENVVAR LOG_PERSIST to change Logger.');
        return;
      }
    }

    Logger.log('Clearing LocalLog...');

    if (fs.existsSync(Logger._logFileDir)) {
      fs.rmSync(Logger._logFileDir, { recursive: true, force: true });
      return;
    }
  }

  ////////////////////////////////////////////////////////////////////////////////

  ////////////////////////////////////////////////////////////////////////////////
  // Public Log Methods
  ////////////////////////////////////////////////////////////////////////////////

  /**
   * Logs a regular message.
   * @param {string} message - The message to log.
   * @param {any[]} ...args - The arguments to pass to the message.
   * @returns {void} - Nothing.
   */
  public static async log(message: string, ...args: any[]): Promise<void> {
    if (!Logger._checkLogLevel('info')) return;

    Logger._logColorString('LOG', LogColor.BrightWhite, message, ...args);
    Logger._logLocally('LOG', message, ...args);
  }

  /**
   * Logs a warning message.
   * @param {string} message - The message to log.
   * @param {any[]} ...args - The arguments to pass to the message.
   * @returns {void} - Nothing.
   */
  public static async warning(message: string, ...args: any[]): Promise<void> {
    if (!Logger._checkLogLevel('warning')) return;

    Logger._logColorString('WARN', LogColor.BrightYellow, message, ...args);
    Logger._logLocally('WARN', message, ...args);
  }

  /**
   * Logs a trace message.
   * @param {string} message - The message to log.
   * @param {any[]} ...args - The arguments to pass to the message.
   * @returns {void} - Nothing.
   * @remarks This will create a trace back directly from this method, not the method that called it.
   */
  public static async trace(message: string, ...args: any[]): Promise<void> {
    if (!Logger._checkLogLevel('debug')) return;

    Logger._logColorString('TRACE', LogColor.BrightMagenta, message, ...args);
    Logger._logLocally('TRACE', message, ...args);
  }

  /**
   * Logs a debug message.
   * @param {string} message - The message to log.
   * @param {any[]} ...args - The arguments to pass to the message.
   * @returns {void} - Nothing.
   */
  public static async debug(message: string, ...args: any[]): Promise<void> {
    if (!Logger._checkLogLevel('debug')) return;

    Logger._logColorString('DEBUG', LogColor.BrightMagenta, message, ...args);
    Logger._logLocally('DEBUG', message, ...args);
  }

  /**
   * Logs an info message.
   * @param {string} message - The message to log.
   * @param {any[]} ...args - The arguments to pass to the message.
   * @returns {void} - Nothing.
   */
  public static async information(message: string, ...args: any[]): Promise<void> {
    if (!Logger._checkLogLevel('info')) return;

    Logger._logColorString('INFO', LogColor.BrightBlue, message, ...args);
    Logger._logLocally('INFO', message, ...args);
  }

  /**
   * Logs an error message.
   * @param {string} message - The message to log.
   * @param {any[]} ...args - The arguments to pass to the message.
   * @returns {void} - Nothing.
   */
  public static async error(message: string, ...args: any[]): Promise<void> {
    if (!Logger._checkLogLevel('error')) return;

    Logger._logColorString('ERROR', LogColor.BrightRed, message, ...args);
    Logger._logLocally('ERROR', message, ...args);
  }

  ////////////////////////////////////////////////////////////////////////////////
}

export = Logger;
