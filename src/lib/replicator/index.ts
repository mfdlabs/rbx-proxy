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
    File Name: index.ts
    Description: The entry point of the multicast replicator. Does not support IPv6 as of now.
    Written by: Nikita Petko
*/

import * as replicatorMetrics from '@lib/metrics/replicator_metrics';

import net from '@mfdlabs/net';
import * as dgram from 'dgram';

/**
 * The type for callbacks with no arguments.
 */
export type Callback = () => void;

/**
 * The type for callbacks when a message is received.
 * @param {string} message The message received.
 */
export type MessageCallback = (message: string, address: string) => void;

/**
 * The multicast replicator. Does not support IPv6 as of now.
 */
export default class MulticastReplicator {
  /**
   * @internal This member is private and should not be accessed directly.
   */
  private _socket: dgram.Socket;

  /**
   * @internal This member is private and should not be accessed directly.
   */
  private _port: number;

  /**
   * @internal This member is private and should not be accessed directly.
   */
  private _address: string;

  /**
   * @internal This member is private and should not be accessed directly.
   */
  private _started: boolean;

  /**
   * Create a new multicast replicator.
   * @param {number} port The port to use.
   * @param {string} address The address to use.
   * @returns {MulticastReplicator} The multicast replicator.
   * @throws {Error} If the port is not a number.
   * @throws {Error} If the port is not in the range 1-65535.
   * @throws {Error} If the address is not a string.
   * @throws {Error} If the address is not a valid IPv4 address.
   * @throws {Error} If the address is not a multicast address.
   */
  public constructor(port: number, address: string) {
    if (typeof port !== 'number') {
      throw new Error('The port is not a number.');
    }
    if (port < 1 || port > 65535) {
      throw new Error('The port is not in the range 1-65535.');
    }
    if (typeof address !== 'string') {
      throw new Error('The address is not a string.');
    }
    if (!net.isIPv4(address)) {
      throw new Error('The address is not a valid IPv4 address.');
    }
    if (!net.isIPv4InCidrRange(address, '224.0.0.0/4')) {
      throw new Error('The address is not a multicast address.');
    }

    this._socket = dgram.createSocket('udp4');
    this._port = port;
    this._address = address;
  }

  /**
   * Start the replicator.
   * @param {Callback} callback The callback to call when the replicator is started.
   * @param {MessageCallback} messageCallback The callback to call when a message is received.
   * @returns {void} Nothing.
   * @throws {Error} If the replicator is already started.
   */
  public start(callback: Callback, messageCallback: MessageCallback): void {
    if (this._started) {
      throw new Error('The replicator is already started.');
    }

    this._socket.bind(this._port, () => {
      this._socket.setBroadcast(true);
      this._socket.setMulticastTTL(128);
      this._socket.addMembership(this._address);

      this._started = true;

      this._socket.on('message', (message, remote) => {
        replicatorMetrics.messagesReceived.inc({
          group: this._address,
        });

        messageCallback(message.toString(), remote.address);
      });

      callback();
    });
  }

  /**
   * Stop the replicator.
   * @param {Callback} callback The callback to call when the replicator is stopped.
   * @returns {void} Nothing.
   * @throws {Error} If the replicator is not started.
   */
  public stop(callback: Callback): void {
    if (!this._started) {
      throw new Error('The replicator is not started.');
    }

    this._socket.close(() => {
      this._started = false;

      callback();
    });
  }

  /**
   * Stop in the background with and timeout if it takes too long.
   * @param {number} timeout The timeout in milliseconds.
   * @returns {void} Nothing.
   */
  public stopInBackground(timeout: number): void {
    if (!this._started) {
      return;
    }

    this._socket.close();

    this._started = false;

    setTimeout(() => {
      if (this._started) {
        this._socket.close();

        this._started = false;
      }
    }, timeout);
  }

  /**
   * Send a message to the multicast group.
   * @param {string} message The message to send.
   * @returns {void} Nothing.
   * @throws {Error} If the replicator is not started.
   * @throws {Error} If the message is empty.
   * @throws {Error} If the message is too long.
   * @throws {Error} If the message contains invalid characters.
   */
  public send(message: string): void {
    if (!this._started) {
      throw new Error('The replicator is not started.');
    }

    if (message === '') {
      throw new Error('The message is empty.');
    }

    if (message.length > 65507) {
      throw new Error('The message is too long.');
    }

    if (!message.match(/^[ -~]+$/)) {
      throw new Error('The message contains invalid characters.');
    }

    replicatorMetrics.messagesSent.inc({
      group: this._address,
    });

    this._socket.send(message, this._port, this._address);
  }

  /**
   * Get the port of the replicator.
   * @returns {number} The port of the replicator.
   */
  public get port(): number {
    return this._port;
  }

  /**
   * Get the address of the replicator.
   * @returns {string} The address of the replicator.
   */
  public get address(): string {
    return this._address;
  }

  /**
   * Get the started state of the replicator.
   * @returns {boolean} The started state of the replicator.
   */
  public get started(): boolean {
    return this._started;
  }
}
