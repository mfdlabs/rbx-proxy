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
    File Name: Logger.ts
    Description: A console and file logger.
    Written by: Nikita Petko
*/

import { __baseDirName } from 'Library/Directories';
import { NetworkingUtility } from './NetworkingUtility';
import { GlobalEnvironment } from './GlobalEnvironment';

import { join as JoinPath } from 'path';
import { format as FormatString } from 'util';
import {
    mkdirSync as CreateDirectory,
    appendFileSync as AppendStringToFile,
    existsSync as CheckDoesFileOrFolderExist,
    rmSync as RemoveDirectory,
} from 'fs';

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
 * A simple console and file logger.
 */
export abstract class Logger {
    ////////////////////////////////////////////////////////////////////////////////
    // Private fields
    ////////////////////////////////////////////////////////////////////////////////

    private static readonly LocalIP = NetworkingUtility.GetLocalIP();
    private static readonly MachineID = NetworkingUtility.GetMachineID();
    private static readonly BaseDirName = Logger.GetBaseDirName();
    private static readonly FileName = FormatString(
        'log_%s_%s_%s.log',
        process.version,
        Logger.GetFileSafeDateNowIsoString(),
        process.pid.toString(16).toUpperCase(),
    );
    private static readonly LogFileDir = Logger.GetDirNameByOS();
    private static readonly FullyQualifiedLogFileName = JoinPath(Logger.LogFileDir, Logger.FileName);
    private static readonly ProcessId = process.pid.toString(16);
    private static readonly Platform = process.platform;
    private static readonly Architechture = process.arch;
    private static readonly NodeVersion = process.versions.node;
    private static readonly ArchitechtureFmt = `${Logger.Platform}-${Logger.Architechture}`;

    ////////////////////////////////////////////////////////////////////////////////

    ////////////////////////////////////////////////////////////////////////////////
    // Private Helper Methods
    ////////////////////////////////////////////////////////////////////////////////

    private static GetFileSafeDateNowIsoString() {
        const date = new Date();
        return date
            .toISOString()
            .replace(/[^a-z0-9_-]/gi, '')
            .replace(/-/g, '');
    }
    private static GetBaseDirName() {
        if (process.platform === 'win32') {
            return __baseDirName.replace(/\//g, '\\');
        }

        return __baseDirName;
    }

    private static GetNowAsIsoString() {
        return new Date().toISOString();
    }

    private static GetUptime() {
        return process.uptime().toFixed(7).toString();
    }

    private static ConstructLoggerMessage(type: string, message: string, ...args: any[]) {
        const formattedMessage = FormatString(message, ...args);

        return FormatString(
            '[%s][%s][%s][%s][%s][%s][%s][%s][server][%s] %s\n',
            Logger.GetNowAsIsoString(),
            Logger.GetUptime(),
            Logger.ProcessId,
            Logger.ArchitechtureFmt,
            Logger.NodeVersion,
            Logger.LocalIP,
            Logger.MachineID,
            Logger.BaseDirName,
            type.toUpperCase(),
            formattedMessage,
        );
    }

    private static GetDirNameByOS() {
        switch (process.platform) {
            case 'win32':
                return JoinPath(process.env.LocalAppData, 'MFDLABS', 'Logs');
            case 'linux' || 'darwin':
                return JoinPath(process.env.HOME, '.cache', 'MFDLABS', 'Logs');
        }
    }

    private static LogLocally(type: string, message: string, ...args: any[]) {
        if (!CheckDoesFileOrFolderExist(Logger.LogFileDir)) CreateDirectory(Logger.LogFileDir, { recursive: true });

        AppendStringToFile(Logger.FullyQualifiedLogFileName, Logger.ConstructLoggerMessage(type, message, ...args));
    }

    private static GetColorSection(content: any) {
        return FormatString('[%s%s%s]', LogColor.BrightBlack, content, LogColor.Reset);
    }

    private static GetSharedColorString() {
        return FormatString(
            '%s%s%s%s%s%s%s%s%s',
            Logger.GetColorSection(Logger.GetNowAsIsoString()),
            Logger.GetColorSection(Logger.GetUptime()),
            Logger.GetColorSection(Logger.ProcessId),
            Logger.GetColorSection(Logger.ArchitechtureFmt),
            Logger.GetColorSection(Logger.NodeVersion),
            Logger.GetColorSection(Logger.LocalIP),
            Logger.GetColorSection(Logger.MachineID),
            Logger.GetColorSection(Logger.BaseDirName),
            Logger.GetColorSection('server'),
        );
    }

    private static LogColorString(type: string, color: LogColor, message: string, ...args: any[]) {
        const formattedMessage = FormatString(message, ...args);

        const formattedStr = FormatString(
            '%s[%s%s%s] %s%s%s',
            Logger.GetSharedColorString(),
            color,
            type.toUpperCase(),
            LogColor.Reset,
            color,
            formattedMessage,
            LogColor.Reset,
        );

        console.log(formattedStr);
    }

    ////////////////////////////////////////////////////////////////////////////////

    ////////////////////////////////////////////////////////////////////////////////
    // Public Helper Methods
    ////////////////////////////////////////////////////////////////////////////////

    /**
     * Requests that the local log file directory be cleared.
     * @param {bool} overrideGlobalConfig - If true, the global config will be ignored.
     * @returns {void} - Nothing.
     */
    public static TryClearLogs(overrideGlobalConfig: bool = false) {
        Logger.Log('Try clear logs.');

        if (GlobalEnvironment.PersistLocalLogs) {
            if (overrideGlobalConfig) {
                Logger.Warn('Overriding global config when clearing logs.');
            } else {
                Logger.Warn('The local log is set to persist. Please change ENVVAR LOG_PERSIST to change this.');
                return;
            }
        }

        Logger.Log('Clearing LocalLog...');

        if (CheckDoesFileOrFolderExist(Logger.LogFileDir)) {
            RemoveDirectory(Logger.LogFileDir, { recursive: true, force: true });
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
    public static Log(message: string, ...args: any[]): void {
        Logger.LogColorString('LOG', LogColor.BrightWhite, message, ...args);
        Logger.LogLocally('LOG', message, ...args);
    }

    /**
     * Logs a warning message.
     * @param {string} message - The message to log.
     * @param {any[]} ...args - The arguments to pass to the message.
     * @returns {void} - Nothing.
     */
    public static Warn(message: string, ...args: any[]): void {
        Logger.LogColorString('WARN', LogColor.BrightYellow, message, ...args);
        Logger.LogLocally('WARN', message, ...args);
    }

    /**
     * Logs a trace message.
     * @param {string} message - The message to log.
     * @param {any[]} ...args - The arguments to pass to the message.
     * @returns {void} - Nothing.
     * @remarks This will create a trace back directly from this method, not the method that called it.
     */
    public static Trace(message: string, ...args: any[]): void {
        const msg = FormatString(message, ...args);
        const trace = new Error(msg).stack;

        Logger.LogColorString('TRACE', LogColor.BrightRed, trace);
        Logger.LogLocally('TRACE', trace);
    }

    /**
     * Logs a debug message.
     * @param {string} message - The message to log.
     * @param {any[]} ...args - The arguments to pass to the message.
     * @returns {void} - Nothing.
     */
    public static Debug(message: string, ...args: any[]) {
        Logger.LogColorString('DEBUG', LogColor.BrightMagenta, message, ...args);
        Logger.LogLocally('DEBUG', message, ...args);
    }

    /**
     * Logs an info message.
     * @param {string} message - The message to log.
     * @param {any[]} ...args - The arguments to pass to the message.
     * @returns {void} - Nothing.
     */
    public static Info(message: string, ...args: any[]) {
        Logger.LogColorString('INFO', LogColor.BrightBlue, message, ...args);
        Logger.LogLocally('INFO', message, ...args);
    }

    /**
     * Logs an error message.
     * @param {string} message - The message to log.
     * @param {any[]} ...args - The arguments to pass to the message.
     * @returns {void} - Nothing.
     */
    public static Error(message: string, ...args: any[]) {
        Logger.LogColorString('ERROR', LogColor.BrightRed, message, ...args);
        Logger.LogLocally('ERROR', message, ...args);
    }

    ////////////////////////////////////////////////////////////////////////////////
}
