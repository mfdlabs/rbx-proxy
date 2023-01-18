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
    Description: The entry point of the DNS resolver client.
                 Used as as subsitute for the native dns module as it does not allow for custom resolvers.
    Written by: Nikita Petko
*/

import * as dnsMetrics from '@lib/metrics/dns_metrics';

import * as dns from 'dns'; // For getting default DNS servers.
import * as net from 'net';
import * as dgram from 'dgram';

import ip from '@mfdlabs/net';

/**
 * The type for DNS record types.
 * @see https://www.iana.org/assignments/dns-parameters/dns-parameters.xhtml#dns-parameters-4
 */
export type RRType = 'A' | 'AAAA' | 'ANY' | 'CNAME' | 'MX' | 'NS' | 'PTR' | 'SOA' | 'SRV' | 'TXT';

/**
 * The type for DNS record classes.
 * @see https://www.iana.org/assignments/dns-parameters/dns-parameters.xhtml#dns-parameters-2
 */
export type RRClass = 'IN' | 'CS' | 'CH' | 'HS' | 'ANY';

/**
 * Class representing a DNS record.
 * @see https://www.iana.org/assignments/dns-parameters/dns-parameters.xhtml#dns-parameters-4
 */
export class DnsRecord {
  /**
   * Constructs a new DNS record.
   * @param {string} name The name of the record.
   * @param {RRType} type The type of the record.
   * @param {RRClass} rrClass The class of the record.
   * @param {number} ttl The TTL of the record.
   * @param {string} value The data of the record.
   */
  public constructor(
    public readonly name: string,
    public readonly type: RRType,
    public readonly rrClass: RRClass,
    public readonly ttl: number,
    public readonly value: string,
  ) {}
}

/**
 * Used as as subsitute for the native dns module as it does not allow for custom resolvers.
 */
export default class DnsResolver {
  /**
   * @internal This member is private and should not be accessed directly.
   */
  private _udpSocket: dgram.Socket;

  /**
   * @internal This member is private and should not be accessed directly.
   */
  private _tcpSocket: net.Socket;

  /**
   * @internal This member is private and should not be accessed directly.
   */
  private readonly _addresses: [string, number][];

  /**
   * @internal This member is private and should not be accessed directly.
   */
  private readonly _tryTcpAfterUdp: boolean;

  /**
   * Constructs a new DNS resolver.
   * @param {string[]=} addresses The addresses of the DNS servers. Defaults to the system's default DNS servers.
   * @param {boolean=} tryTcpAfterUdp Whether to try TCP after UDP if the first attempt fails. Defaults to true.
   * @throws {Error} If the addresses is not an array of strings.
   * @throws {Error} If the tryTcpAfterUdp is not a boolean.
   */
  public constructor(addresses?: string[], tryTcpAfterUdp: boolean = true) {
    if (typeof addresses !== 'undefined' && !Array.isArray(addresses)) {
      throw new Error('Addresses must be an array of strings.');
    }

    if (typeof tryTcpAfterUdp !== 'boolean') {
      throw new Error('tryTcpAfterUdp must be a boolean.');
    }

    if (typeof addresses === 'undefined') {
      addresses = dns.getServers();
    }

    this._addresses = DnsResolver._parseAddresses(addresses);
    this._tryTcpAfterUdp = tryTcpAfterUdp;
  }

  private static _parseAddresses(addresses: string[]): [string, number][] {
    return addresses.map((address) => {
      if (ip.isIPv6(address)) {
        let port = 53;
        if (address.startsWith('[') && address.endsWith(']')) {
          address = address.slice(1, -1);

          const portIndex = address.lastIndexOf(':');
          if (portIndex !== -1) {
            port = parseInt(address.slice(portIndex + 1));
            address = address.slice(0, portIndex);
          }
        }

        return [address, port];
      }

      const [host, port] = address.split(':');
      return [host, parseInt(port || '53')];
    });
  }

  /**
   * Resolves a domain name.
   * @param {string} domain The domain name to resolve.
   * @param {RRType=} type The type of the record to resolve. Defaults to A.
   * @param {RRClass=} rrClass The class of the record to resolve. Defaults to IN.
   * @returns {Promise<DnsRecord[]>} The resolved addresses.
   * @throws {Error} If the domain is not a string.
   * @throws {Error} If the type is not a string.
   * @throws {Error} If the type is not a valid record type.
   * @throws {Error} If the class is not a string.
   * @throws {Error} If the class is not a valid record class.
   */
  public async resolve(domain: string, type: RRType = 'A', rrClass: RRClass = 'IN'): Promise<DnsRecord[]> {
    if (typeof domain !== 'string') {
      throw new Error('Domain must be a string.');
    }

    if (typeof type !== 'string') {
      throw new Error('Type must be a string.');
    }

    if (!['A', 'AAAA', 'ANY', 'CNAME', 'MX', 'NS', 'PTR', 'SOA', 'SRV', 'TXT'].includes(type)) {
      throw new Error('Type must be a valid record type.');
    }

    if (typeof rrClass !== 'string') {
      throw new Error('Class must be a string.');
    }

    if (!['IN', 'CS', 'CH', 'HS', 'ANY'].includes(rrClass)) {
      throw new Error('Class must be a valid record class.');
    }

    const start = Date.now();
    let lastError: Error | undefined;

    for (const [address, port] of this._addresses) {
      dnsMetrics.queriesSent.labels(address, type, rrClass, domain).inc();

      this._udpSocket = dgram.createSocket(ip.isIPv6(address) ? 'udp6' : 'udp4');

      try {
        return await this._resolveUdp(address, port, domain, type, rrClass);
      } catch (error) {
        dnsMetrics.queriesFailed.labels(address, type, rrClass, domain).inc();

        if (this._tryTcpAfterUdp) {
          this._tcpSocket = net.createConnection(port, address);

          return await this._resolveTcp(address, port, domain, type, rrClass);
        } else {
          lastError = error;
        }
      } finally {
        dnsMetrics.queryTime.labels(address, type, rrClass, domain).observe(Date.now() - start);
      }
    }

    if (lastError) {
      throw lastError;
    }

    throw new Error('No DNS servers available.');
  }

  public resolve4(domain: string): Promise<DnsRecord[]> {
    return this.resolve(domain, 'A');
  }

  public resolve6(domain: string): Promise<DnsRecord[]> {
    return this.resolve(domain, 'AAAA');
  }

  public resolveAny(domain: string): Promise<DnsRecord[]> {
    return this.resolve(domain, 'ANY');
  }

  private static _constructRequest(domain: string, type: RRType, rrClass: RRClass): Buffer {
    const request = Buffer.alloc(12);
    request.writeUInt16BE(0x1234, 0); // ID
    request.writeUInt16BE(0x0120, 2); // Flags (Recursion Desired, Authoritative Answer)
    request.writeUInt16BE(0x0001, 4); // Questions
    request.writeUInt16BE(0x0000, 6); // Answers
    request.writeUInt16BE(0x0000, 8); // Authority
    request.writeUInt16BE(0x0000, 10); // Additional

    const domainParts = domain.split('.');
    let domainBuffer = Buffer.alloc(0);
    for (const part of domainParts) {
      domainBuffer = Buffer.concat([domainBuffer, Buffer.from([part.length]), Buffer.from(part)]);
    }

    domainBuffer = Buffer.concat([domainBuffer, Buffer.from([0x00])]);

    const typeBuffer = Buffer.alloc(2);
    typeBuffer.writeUInt16BE(DnsResolver._getType(type), 0);

    const classBuffer = Buffer.alloc(2);
    classBuffer.writeUInt16BE(DnsResolver._getClass(rrClass), 0);

    return Buffer.concat([request, domainBuffer, typeBuffer, classBuffer]);
  }

  private _resolveTcp(
    address: string,
    port: number,
    domain: string,
    type: RRType,
    rrClass: RRClass,
  ): Promise<DnsRecord[]> {
    dnsMetrics.tcpQueriesSent.labels(address, type, rrClass, domain).inc();

    return new Promise((resolve, reject) => {
      const query = DnsResolver._constructRequest(domain, type, rrClass);

      this._tcpSocket.once('data', (data) => {
        const d = DnsResolver._parseResponse(data, type);

        // We have data, close the socket.
        this._tcpSocket.end();

        resolve(d);
      });

      this._tcpSocket.once('error', (error) => {
        reject(error);
      });

      this._tcpSocket.write(query);
    });
  }

  private _resolveUdp(
    address: string,
    port: number,
    domain: string,
    type: RRType,
    rrClass: RRClass,
  ): Promise<DnsRecord[]> {
    dnsMetrics.udpQueriesSent.labels(address, type, rrClass, domain).inc();

    const query = DnsResolver._constructRequest(domain, type, rrClass);

    return new Promise((resolve, reject) => {
      this._udpSocket.once('message', (message) => {
        resolve(DnsResolver._parseResponse(message, type));
      });

      this._udpSocket.once('error', (error) => {
        reject(error);
      });

      this._udpSocket.send(query, port, address);
    });
  }

  private static _getType(type: RRType): number {
    switch (type) {
      case 'A':
        return 0x0001;
      case 'AAAA':
        return 0x001c;
      case 'ANY':
        return 0x00ff;
      case 'CNAME':
        return 0x0005;
      case 'MX':
        return 0x000f;
      case 'NS':
        return 0x0002;
      case 'PTR':
        return 0x000c;
      case 'SOA':
        return 0x0006;
      case 'SRV':
        return 0x0021;
      case 'TXT':
        return 0x0010;
    }
  }

  private static _getClass(rrClass: RRClass): number {
    switch (rrClass) {
      case 'IN':
        return 0x0001;
      case 'CS':
        return 0x0002;
      case 'CH':
        return 0x0003;
      case 'HS':
        return 0x0004;
      case 'ANY':
        return 0x00ff;
    }
  }

  private static _parseResponse(response: Buffer, requestedType: RRType): DnsRecord[] {
    const records: DnsRecord[] = [];

    const id = response.readUInt16BE(0);
    response.readUInt16BE(2); // Flags
    const questions = response.readUInt16BE(4);
    const answers = response.readUInt16BE(6);
    response.readUInt16BE(8); // Authority

    if (id !== 0x1234) {
      throw new Error('Invalid ID.');
    }

    if (questions !== 0x0001) {
      throw new Error('Invalid questions.');
    }

    if (answers === 0x0000) {
      return records;
    }

    let offset = 12;
    while (response[offset] !== 0x00) {
      offset += response[offset] + 1;
    }
    offset += 5;

    for (let i = 0; i < answers; i++) {
      const name = this._parseName(response, offset);
      const type = this._parseType(response.readUInt16BE(offset + 2));
      const rrClass = this._parseClass(response.readUInt16BE(offset + 4));
      const ttl = response.readUInt32BE(offset + 6);
      const length = response.readUInt16BE(offset + 10);
      const data = this._parseData(response, offset + 12, type, length);

      records.push({
        name,
        type,
        rrClass,
        ttl,
        value: data.toString(),
      });

      offset += 12 + length;
    }

    // Sort records by putting the requested type first.
    records.sort((a, b) => {
      if (a.type === requestedType) {
        return -1;
      }

      if (b.type === requestedType) {
        return 1;
      }

      return 0;
    });

    return records;
  }

  private static _parseName(response: Buffer, offset: number): string {
    let name = '';
    let length = response[offset];

    while (length !== 0x00) {
      if ((length & 0xc0) === 0xc0) {
        const pointer = response.readUInt16BE(offset) & 0x3fff;
        name += this._parseName(response, pointer);
        offset += 2;
        break;
      }

      name += response.slice(offset + 1, offset + length + 1).toString() + '.';
      offset += length + 1;
      length = response[offset];
    }

    return name;
  }

  private static _parseType(type: number): RRType {
    switch (type) {
      case 0x0001:
        return 'A'; // IPv4
      case 0x001c:
        return 'AAAA'; // IPv6
      case 0x00ff:
        return 'ANY'; // Any
      case 0x0005:
        return 'CNAME'; // Canonical name
      case 0x000f:
        return 'MX'; // Mail exchange
      case 0x0002:
        return 'NS'; // Name server
      case 0x000c:
        return 'PTR'; // Pointer
      case 0x0006:
        return 'SOA'; // Start of authority
      case 0x0021:
        return 'SRV'; // Service
      case 0x0010:
        return 'TXT'; // Text
    }
  }

  private static _parseClass(rrClass: number): RRClass {
    switch (rrClass) {
      case 0x0001:
        return 'IN'; // Internet
      case 0x0002:
        return 'CS'; // CSNET
      case 0x0003:
        return 'CH'; // CHAOS
      case 0x0004:
        return 'HS'; // Hesiod
      case 0x00ff:
        return 'ANY'; // Any
    }
  }

  private static _parseData(response: Buffer, offset: number, type: RRType, length: number): string | number {
    switch (type) {
      case 'A':
        return response.slice(offset, offset + length).join('.');
      case 'AAAA':
        return response.slice(offset, offset + length).join(':');
      case 'CNAME':
        return this._parseName(response, offset);
      case 'MX':
        return this._parseMxData(response, offset);
      case 'NS':
        return this._parseName(response, offset);
      case 'PTR':
        return this._parseName(response, offset);
      case 'SOA':
        return this._parseName(response, offset);
      case 'SRV':
        return this._parseSrvData(response, offset);
      case 'TXT':
        return response.slice(offset, offset + length).toString('ascii');
    }
  }

  private static _parseMxData(response: Buffer, offset: number): string {
    const preference = response.readUInt16BE(offset);
    const name = this._parseName(response, offset + 2);
    return `${preference} ${name}`;
  }

  private static _parseSrvData(response: Buffer, offset: number): string {
    const priority = response.readUInt16BE(offset);
    const weight = response.readUInt16BE(offset + 2);
    const port = response.readUInt16BE(offset + 4);
    const name = this._parseName(response, offset + 6);
    return `${priority} ${weight} ${port} ${name}`;
  }
}
