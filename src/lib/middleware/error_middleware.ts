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
    File Name: error_middleware.ts
    Description: A middleware that handles errors.
    Written by: Nikita Petko
*/

import WebUtility from '@lib/utility/web_utility';
import googleAnalytics from '@lib/utility/google_analytics';
import sentryEnvironment from '@lib/environment/sentry_environment';
import errorMiddlewareLogger from '@lib/loggers/middleware/error_middleware_logger';
import * as errorMiddlewareMetrics from '@lib/metrics/middleware/error_middleware_metrics';

import * as fs from 'fs';
import * as os from 'os';
import htmlEncode from 'escape-html';
import stackTrace from 'stack-trace';
import * as Sentry from '@sentry/node';
import sourceCodeError from 'source-code-error';
import { NextFunction, Request, Response } from 'express';

export default class ErrorMiddleware {
  /**
   * Invokes the middleware.
   * @param {Error} error The error object.
   * @param {Request} request The request object.
   * @param {Response} response The response object.
   * @param {NextFunction} _next The next function to call.
   * @returns {void} Nothing.
   */
  public static invoke(error: Error, request: Request, response: Response, _next: NextFunction): void {
    const errorStack = error instanceof Error ? error.stack : 'Unknown error';
    const uri = `${request.protocol}://${request.hostname}${request.originalUrl}`;

    errorMiddlewareLogger.error(
      'An error occurred while processing a request on URI %s://%s:%d%s (%s): %s',
      request.protocol,
      request.hostname,
      request.socket.localPort,
      request.path,
      request.ip,
      errorStack,
    );

    errorMiddlewareMetrics.errorCounter.inc({
      method: request.method,
      hostname: request.headers.host || 'No Host Header',
      endpoint: request.path,
      caller: request.ip,
    });

    // Log the error
    googleAnalytics.fireServerEventGA4('Server', 'Error', errorStack);

    if (sentryEnvironment.singleton.sentryEnabled) Sentry.captureException(error);

    let message = `An error occurred when sending a request to the upstream.\nUrl: <b>${htmlEncode(
      uri,
    )}</b>\nHost: <b>${os.hostname()}</b>`;

    const startTime = request.context.get('startTime');
    if (typeof startTime === 'number') {
      const endTime = Date.now();
      const duration = endTime - startTime;

      message += `\nDuration: <b>${duration}ms</b>`;
    }

    const additionalContext = request.context.get('errorContext');
    if (additionalContext !== undefined && Array.isArray(additionalContext)) {
      const [context, contextStyle] = additionalContext;

      message += `\nContext: <b${contextStyle !== undefined ? ` style="${contextStyle}"` : ''}>${htmlEncode(
        context,
      )}</b>`;
    }

    if (error instanceof Error && WebUtility.isBrowser(request.headers['user-agent'])) {
      try {
        const stack = stackTrace.parse(error);

        // Get the first frame that has a file set and is not <anonymous>
        const frame = stack.find((frame) => frame.getFileName() !== undefined && frame.getFileName() !== '<anonymous>');

        const fileContent = fs.readFileSync(frame.getFileName(), 'utf8');
        const sourceCode = sourceCodeError({
          message: error.message,
          origin: frame.getFunctionName(),
          line: frame.getLineNumber(),
          column: frame.getColumnNumber(),
          code: fileContent,
          colors: false,

          above: 3,
          below: 3,
        });

        const split = sourceCode.split('\n');

        const before = split.slice(0, 5).join('\n');
        const line = split.slice(5, 7).join('\n');
        const after = split.slice(7, 10).join('\n');

        const code = `${htmlEncode(before)}\n\n<font color="red">${htmlEncode(line)}</font>\n\n${htmlEncode(after)}`;

        response.sendMessage(
          [message, undefined, true],
          500,
          undefined,
          true,
          undefined,
          [
            [
              false,
              code,
              // Courier New monospace font, white border that is sized to the content, 5px padding
              "font-family: 'Courier New', monospace; border: 1px solid white; padding: 10px; box-sizing: border-box; display: inline-block; white-space: pre-wrap; word-break: break-word; overflow-wrap: break-word; overflow: auto;",
              true,
            ],
            [true, errorStack, undefined],
          ],
          false,
        );

        return;
      } catch (error) {
        // Do nothing
      }
    }

    response.sendMessage([message, undefined, true], 500, undefined, true, undefined, [[true, errorStack]], false);
  }
}
