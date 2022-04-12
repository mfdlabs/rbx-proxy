import { format as FormatString } from 'util';
import {
    mkdirSync as CreateDirectory,
    appendFileSync as AppendStringToFile,
    existsSync as CheckDoesFileOrFolderExist,
    rmSync as RemoveDirectory,
} from 'fs';
import { NetworkingUtility } from './NetworkingUtility';
import { GlobalEnvironment } from './GlobalEnvironment';
import { __baseDirName } from 'Assemblies/Directories';
import { join as JoinPath } from 'path';

enum LogColor {
    Reset = '\x1b[0m',
    Black = '\x1b[30m',
    Red = '\x1b[31m',
    Green = '\x1b[32m',
    Yellow = '\x1b[33m',
    Blue = '\x1b[34m',
    Magenta = '\x1b[35m',
    Cyan = '\x1b[36m',
    White = '\x1b[37m',
    BrightBlack = '\x1b[90m',
    BrightRed = '\x1b[91m',
    BrightGreen = '\x1b[92m',
    BrightYellow = '\x1b[93m',
    BrightBlue = '\x1b[94m',
    BrightMagenta = '\x1b[95m',
    BrightCyan = '\x1b[96m',
    BrightWhite = '\x1b[97m',
}

export class Logger {
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

    public static Log(message: string, ...args: any[]) {
        Logger.LogColorString('LOG', LogColor.BrightWhite, message, ...args);
        Logger.LogLocally('LOG', message, ...args);
    }

    public static Warn(message: string, ...args: any[]) {
        Logger.LogColorString('WARN', LogColor.BrightYellow, message, ...args);
        Logger.LogLocally('WARN', message, ...args);
    }

    public static Trace(message: string, ...args: any[]) {
        Logger.LogColorString('TRACE', LogColor.BrightRed, message, ...args);
        Logger.LogLocally('TRACE', message, ...args);
    }

    public static Debug(message: string, ...args: any[]) {
        Logger.LogColorString('DEBUG', LogColor.BrightMagenta, message, ...args);
        Logger.LogLocally('DEBUG', message, ...args);
    }

    public static Info(message: string, ...args: any[]) {
        Logger.LogColorString('INFO', LogColor.BrightBlue, message, ...args);
        Logger.LogLocally('INFO', message, ...args);
    }

    public static Error(message: string, ...args: any[]) {
        Logger.LogColorString('ERROR', LogColor.BrightRed, message, ...args);
        Logger.LogLocally('ERROR', message, ...args);
    }

}
