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
    File Name: load_balancer_responder.ts
    Description: This is a responder for LB level messages.
    Written by: Nikita Petko
*/

import webUtility from '@lib/utility/web_utility';
import { readPackageJson } from '@lib/utility/npm_utility';

import htmlEncode from 'escape-html';
import { Request, Response } from 'express';

const { name, version } = readPackageJson();

/**
 * This class is a responder for LB level messages.
 */
export default class LoadBalancerResponder {
  /**
   * This method will send a message to the client.
   *
   * @param {[string, string?, boolean?]} message The message to send.
   * @param {Request} request The request object.
   * @param {Response} response The response object.
   * @param {number=} statusCode The status code to send.
   * @param {[string, string?, boolean?]?} titleOrUserFacingMessage The title of the message or a user-facing message for API based responses.
   * @param {boolean=} noCache Whether to send no-cache headers.
   * @param {Record<string, string>?} extraHeaders Extra headers to send.
   * @param {[boolean, string, string?][]?} extraDetails Extra details to send.
   * @param {boolean=} inContainer Whether to send the message in a container.
   * @returns {void} Nothing.
   */
  public static sendMessage(
    message: [string, string?, boolean?],
    request: Request,
    response: Response,
    statusCode: number = 200,
    titleOrUserFacingMessage?: [string, string?, boolean?],
    noCache: boolean = true,
    extraHeaders?: Record<string, string>,
    extraDetails?: [boolean, string, string?, boolean?][],
    inContainer: boolean = true,
  ): void {
    if (noCache) response.noCache();
    if (extraHeaders) for (const key in extraHeaders) response.header(key, extraHeaders[key]);

    // If the request is from a browser, send a HTML page.
    if (webUtility.isBrowser(request.headers['user-agent'])) {
      // If title is not specified, use '${statusCode} ${statusMessage}'.
      if (!titleOrUserFacingMessage?.[0]) {
        const statusMessage = this._getStatusMessage(statusCode) ?? '';
        titleOrUserFacingMessage = [`${statusCode} ${statusMessage}`];
      }

      const [, , isRawMessage] = message;

      // Escape the message and title.
      message[0] = (isRawMessage ? message[0] : htmlEncode(message[0]))
        .replace(/\n/g, '<br>')
        .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
        .replace(/ /g, '&nbsp;');

      // html tags that have spaces will have their spaces replaced with &nbsp; we need to replace them back with spaces, but only for parts of the message that have html tags.
      // regex: /(<[^>]+>)/g but also matches &nbsp; so we need to replace it back with a space.
      if (isRawMessage) {
        message[0] = message[0].replace(/(<[^>]+>)/g, (match) => {
          if (match.includes('&nbsp;')) return match.replace(/&nbsp;/g, ' ');

          return match;
        });
      }

      const [, , isRawTitle] = titleOrUserFacingMessage;

      titleOrUserFacingMessage[0] = isRawTitle ? titleOrUserFacingMessage[0] : htmlEncode(titleOrUserFacingMessage[0]);

      const [, messageStyle] = message;
      const [, titleStyle] = titleOrUserFacingMessage;

      let html = `
<html>
  <head>
    <title>${titleOrUserFacingMessage[0]}</title>

    <link rel="preconnect" href="https://fonts.gstatic.com">
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://content.cdn.arc-cloud.net/arc/css/rbx.css">
  </head>
  <body>
    ${inContainer ? `<div class="container"><h1 class="title">${name} v${version}</h1>` : ''}
      <h2${this._isErrorStatusCode(statusCode) ? ' class="error"' : ''}${titleStyle ? ` style="${titleStyle}"` : ''}>${
        titleOrUserFacingMessage[0]
      }</h2>
      <p${messageStyle ? ` style="${messageStyle}"` : ''}>${message[0]}</p>
`;

      if (extraDetails) {
        for (const [isBold, detail, customStyle, isRaw] of extraDetails) {
          let encodedDetail = (isRaw ? detail : htmlEncode(detail))
            .replace(/\n/g, '<br>')
            .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
            .replace(/ /g, '&nbsp;');

          // html tags that have spaces will have their spaces replaced with &nbsp; we need to replace them back with spaces, but only for parts of the message that have html tags.
          // regex: /(<[^>]+>)/g but also matches &nbsp; so we need to replace it back with a space.
          if (isRaw) {
            encodedDetail = encodedDetail.replace(/(<[^>]+>)/g, (match) => {
              if (match.includes('&nbsp;')) return match.replace(/&nbsp;/g, ' ');
              return match;
            });
          }

          html += `<p${customStyle ? ` style="${customStyle}"` : ''}>${isBold ? '<b>' : ''}${encodedDetail}${
            isBold ? '</b>' : ''
          }</p>`;
        }
      }

      html += `${inContainer ? '</div>' : ''}</body></html>`;

      // add pre-fetching headers
      response.header('Link', [
        '<https://content.cdn.arc-cloud.net/arc/css/rbx.css>; rel=preload; as=style',
        '<https://fonts.googleapis.com/css2?family=Roboto:wght@300;700&display=swap>; rel=preload; as=style',
      ]);

      response.contentType('text/html');
      response.status(statusCode).send(html);
      return;
    }

    // Update message to remove html tags.
    message[0] = message[0].replace(/<[^>]*>/g, '');

    const responseBody = {
      code: statusCode,
      message: message[0],
    };

    if (titleOrUserFacingMessage?.[0])
      responseBody['userFacingMessage'] = titleOrUserFacingMessage[0].replace(/<[^>]*>/g, '');
    if (extraDetails) responseBody['extraDetails'] = extraDetails.map(([, detail]) => detail.replace(/<[^>]*>/g, ''));

    // Send the message as JSON.
    response.contentType('application/json');
    response.status(statusCode).send(responseBody);
  }

  private static _isErrorStatusCode(statusCode: number): boolean {
    return statusCode >= 400;
  }

  private static _getStatusMessage(statusCode: number): string {
    switch (statusCode) {
      case 200:
        return 'OK';
      case 400:
        return 'Bad Request';
      case 401:
        return 'Unauthorized';
      case 403:
        return 'Forbidden';
      case 404:
        return 'Not Found';
      case 405:
        return 'Method Not Allowed';
      case 406:
        return 'Not Acceptable';
      case 408:
        return 'Request Timeout';
      case 409:
        return 'Conflict';
      case 410:
        return 'Gone';
      case 411:
        return 'Length Required';
      case 412:
        return 'Precondition Failed';
      case 413:
        return 'Payload Too Large';
      case 414:
        return 'URI Too Long';
      case 415:
        return 'Unsupported Media Type';
      case 416:
        return 'Range Not Satisfiable';
      case 417:
        return 'Expectation Failed';
      case 418:
        return "I'm a teapot";
      case 421:
        return 'Misdirected Request';
      case 422:
        return 'Unprocessable Entity';
      case 423:
        return 'Locked';
      case 424:
        return 'Failed Dependency';
      case 425:
        return 'Too Early';
      case 426:
        return 'Upgrade Required';
      case 428:
        return 'Precondition Required';
      case 429:
        return 'Too Many Requests';
      case 431:
        return 'Request Header Fields Too Large';
      case 451:
        return 'Unavailable For Legal Reasons';
      case 500:
        return 'Internal Server Error';
      case 501:
        return 'Not Implemented';
      case 502:
        return 'Bad Gateway';
      case 503:
        return 'Service Unavailable';
      case 504:
        return 'Gateway Timeout';
      case 505:
        return 'HTTP Version Not Supported';
      case 506:
        return 'Variant Also Negotiates';
      case 507:
        return 'Insufficient Storage';
      case 508:
        return 'Loop Detected';
      case 510:
        return 'Not Extended';
      case 511:
        return 'Network Authentication Required';
      default:
        return undefined;
    }
  }
}
