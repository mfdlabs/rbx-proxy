// This file hooks onto the standard input stream and listens to exit signals.

import { Logger } from "Assemblies/Util/LoggingUtility";

export function StandardInHandler() {
	process.stdin.resume();

	process.on('SIGINT', () => {
		console.log('Got SIGINT. Will start shutdown procedure within 1 second.');
		setTimeout(() => {
			Logger.TryClearLogs();
			process.exit(0);
		}, 1000);
	});
	process.on('SIGUSR1', () => {
		console.log('Got SIGUSR1. Will start shutdown procedure within 1 second.');
		setTimeout(() => {
			return process.exit(0);
		}, 1000);
	});
	process.on('SIGUSR2', () => {
		console.log('Got SIGUSR2. Will clear LocalLog within 1 second.');
		setTimeout(() => {}, 1000);
	});

	process.on('SIGALRM', () => {
		console.log('Alarm clock');
		process.exit(0);
	});

	process.on('SIGHUP', () => {
		console.log('Hangup');
		process.exit(0);
	});

	process.on('SIGIO', () => {
		console.log('I/O possible');
		process.exit(0);
	});

	process.on('SIGPOLL', () => {
		console.log('I/O possible');
		process.exit(0);
	});

	process.on('SIGPROF', () => {
		console.log('Profiling timer expired');
		process.exit(0);
	});

	process.on('SIGVTALRM', () => {
		console.log('Virtual timer expired');
		process.exit(0);
	});

	process.on('SIGPWR', () => {
		console.log('Power failure');
		process.exit(0);
	});

	process.on('SIGSTKFLT', () => {
		console.log('Stack fault');
		process.exit(0);
	});

	process.on('SIGPIPE', () => {
		console.log('Got SIGPIPE. Ignoring.');
	});

	process.on('SIGTERM', () => {
		console.log('Got SIGTERM. Will start shutdown procedure within 1 second.');
		setTimeout(() => {
			Logger.TryClearLogs(true);
			process.exit(0);
		}, 1000);
	});

	process.on('uncaughtException', (ex) => {
		console.log('\n***\nPROCESS EXCEPTION\n***\n');
		console.log('REASON FOR EXCEPTION: %s', ex.stack || '');
	});

	process.on('unhandledRejection', (reason) => {
		console.log('\n***\nPROCESS REJECTION\n***\n');
		console.log('REASON FOR REJECTION: %s', reason || '');
	});

	if (process.stdin.setRawMode) process.stdin.setRawMode(true);

	process.stdin.setEncoding('utf8');

	process.stdin.on('data', function (key: string) {
		if (key === '\u0003' || key === '\u001b') {
			return process.emit('SIGINT', 'SIGINT');
		}
	});
}
