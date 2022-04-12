import { networkInterfaces as GetNetworkInterfaces, hostname as GetMachineHost } from 'os';
import { lookup as LookupHostname } from 'dns';
import { get as GetRequest } from 'http';
import { execSync as Execute } from 'child_process';

export class NetworkingUtility {
    ////////////////////////////////////////////////////////////////////////////////
    // Private Static Methods
    ////////////////////////////////////////////////////////////////////////////////

    /**
     * Parses a big integer string into an array of digit values.
     * @param {string} bigint The big integer string.
     * @param {number} base The base of the big integer.
     * @returns The array of digit values.
     */
    private static ParseBigInt(bigint: string, base: number): int[] {
        //convert bigint string to array of digit values
        for (var values = [], i = 0; i < bigint.length; i++) {
            values[i] = parseInt(bigint.charAt(i), base);
        }
        return values;
    }

    /**
     * Format a big integer into a string.
     * @param {int[]} values The array of digit values.
     * @param {number} base The base of the big integer.
     * @returns The big integer string.
     */
    private static FormatBigInt(values: int[], base: int): string {
        //convert array of digit values to bigint string
        for (var bigint = '', i = 0; i < values.length; i++) {
            bigint += values[i].toString(base);
        }
        return bigint;
    }

    /**
     * Converts the base of a big integer.
     * @param {string} bigint The big integer string.
     * @param {number} inputBase The base of the big integer.
     * @param {number} outputBase The base to convert to.
     * @returns The converted big integer string.
     */
    private static ConvertBase(bigint: string, inputBase: number, outputBase: number): bigint {
        var inputValues = NetworkingUtility.ParseBigInt(bigint, inputBase),
            outputValues = [],
            remainder: number,
            len = inputValues.length,
            pos = 0,
            i: number;
        while (pos < len) {
            remainder = 0; //set remainder to 0
            for (i = pos; i < len; i++) {
                //long integer division of input values divided by output base
                //remainder is added to output array
                remainder = inputValues[i] + remainder * inputBase;
                inputValues[i] = Math.floor(remainder / outputBase);
                remainder -= inputValues[i] * outputBase;
                if (inputValues[i] == 0 && i == pos) {
                    pos++;
                }
            }
            outputValues.push(remainder);
        }
        outputValues.reverse(); //transform to big-endian/msd order
        return BigInt(NetworkingUtility.FormatBigInt(outputValues, outputBase));
    }

    ////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////

    ////////////////////////////////////////////////////////////////////////////////
    /// Public Static Constants
    ////////////////////////////////////////////////////////////////////////////////

    /**
     * A regex that compresses IPv6 addresses.
     */
    public static readonly CompressIPv6Regex = /\b:?(?:0+:?){2,}/;

    /**
     * A regex that extracts an IPv4 address from an IPv6 address.
     */
    public static readonly ExtractIPv4FromIPv6Regex = /([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})/;

    /**
     * A regex that verifies an embedded IPv4 address within an IPv6 address.
     */
    public static readonly ValidateIPv4Regex = /((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})/;

    /**
     * A regex to match IPv6 addresses. It is advised to use the IsIPv6 function instead of this.
     */
    public static readonly IPv6Regex =
        /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;

    /**
     * A regex to match IPv4 addresses. It is advised to use the IsIPv4 function instead of this.
     */
    public static readonly IPv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

    /**
     * A regex to match ethernet network interfaces from netwokInterfaces().
     */
    public static readonly EthernetInterfaceRegex = /^eth[0-9]+$/;

    /**
     * A regex to match WiFi network interfaces from netwokInterfaces().
     */
    public static readonly WifiInterfaceRegex = /^(wlan[0-9]+|WiFi)$/gi;

    /**
     * A regex to match the request User-Agent as a potential bot.
     */
    public static readonly CrawlerRegex =
        /[Ss]lurp|[Tt]eoma|Scooter|Mercator|MSNBOT|Gulliver|[Ss]pider|[Aa]rchiver|[Cc]rawler|[Bb]ot[) \/_-]|Mediapartners-Google|[Pp]ython-(?=urllib|requests)|c[uU][rR][lL]|wxWidgets|facebookexternalhit|PowerShell|DOSarrest|Feedfetcher|Roblox diag2|BingPreview|Jakarta|LuaSocket|VortaxiaWebflow|ADmantX|A6-Indexer|Dalvik|Roblox\/WinHttp|Roblox\/WinInet$|Java\/1|^Get Request$|XaxisSemanticsClassifier|compatible;\\s+Synapse|^Google favicon$|SkypeUriPreview|[Ll]ynx|[Uu]ptime\\.com|package http|^expo9|WebIndex|ogic[Mm]onitor|HitLeap|StatusCake|statuscake/gi;

    /**
     * A constant that represents the maximum number of segments in an IPv6 address.
     */
    public static readonly ValidIPv6GroupsCount = 8;

    /**
     * A constant that represents the maximum number of numbers allowed in an IPv6 address hexidecimal segment.
     */
    public static readonly ValidIPv6GroupSize = 4;

    /**
     * A constant that represents the largest possible RFC1918 IPv4 address.
     */
    public static readonly MaxRFC1918IPv4Cidr = '10.0.0.0/8';

    /**
     * A constant that represents the second largest possible RFC1918 IPv4 address.
     */
    public static readonly SecondMaxRFC1918IPv4Cidr = '172.16.0.0/12';

    /**
     * A constant that represents the smallest possible RFC1918 IPv4 address.
     */
    public static readonly MinRFC1918IPv4Cidr = '192.168.0.0/16';

    /**
     * A constant that represents the IPv4 loopback CIDR.
     */
    public static readonly IPv4LoopbackCidr = '127.0.0.0/8';

    /**
     * A constant that represents the IPv6 RFC4193 private network CIDR.
     */
    public static readonly IPv6PrivateCidr = 'fc00::/7';

    /**
     * A constant that represents the IPv6 RFC3879 private network CIDR.
     */
    public static readonly IPv6LinkLocalCidr = 'fec0::/10';

    /**
     * A constant that represents the IPv6 loopback CIDR.
     */
    public static readonly IPv6LoopbackCidr = '::1/128';

    /**
     * A constant that represents the IPv4 Link-Local address.
     */
    public static readonly IPv4LinkLocal = '169.254.0.0/16';

    /**
     * A constant that represents the IPv6 Link-Local address.
     */
    public static readonly IPv6LinkLocal = 'fe80::/10';

    ////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////

    ////////////////////////////////////////////////////////////////////////////////
    /// Public Static Functions
    ////////////////////////////////////////////////////////////////////////////////

    /**
     * Attempts to expand a compressed IPv6 address like ::1 to a full IPv6 address.
     *
     * @example
     * ```ts
     * const ip = 'fe80::215:5dff:fe02:1c37';
     *
     * NetworkingUtility.DecompressIPv6(ip); // 'fe80:0000:0000:0000:0215:5dff:fe02:1c37'
     * ```
     * @param {string} ip The input IPv6 address.
     * @returns The expanded IPv6 address.
     */
    public static DecompressIPv6(ip: string) {
        // decompresses an IPv6 address
        // by expanding the :: notation
        // and filling in the missing leading zeroes
        if (!NetworkingUtility.IsIPv6(ip)) {
            return ip;
        }

        let fullAddress = '';
        let expandedAddress = '';

        // Look for embedded IPv4 addresses
        if (NetworkingUtility.ValidateIPv4Regex.test(ip)) {
            let IPv4 = '';

            const groups = ip.match(NetworkingUtility.ExtractIPv4FromIPv6Regex);

            for (let i = 1; i < groups.length; i++) {
                IPv4 += ('00' + parseInt(groups[i], 10).toString(16)).slice(-2) + (i === 2 ? ':' : '');
            }

            ip = ip.replace(NetworkingUtility.ExtractIPv4FromIPv6Regex, IPv4);
        }

        if (ip.indexOf('::') === -1)
            // All eight groups are present
            fullAddress = ip;
        else {
            // Consecutive groups of zeroes have been collapsed with ::
            const sides = ip.split('::');
            let groupsPresent = 0;

            for (let i = 0; i < sides.length; i++) groupsPresent += sides[i].split(':').length;

            fullAddress += sides[0] + ':';
            for (let i = 0; i < NetworkingUtility.ValidIPv6GroupsCount - groupsPresent; i++) fullAddress += '0000:';

            fullAddress += sides[1];
        }

        const groups = fullAddress.split(':');
        for (let i = 0; i < NetworkingUtility.ValidIPv6GroupsCount; i++) {
            while (groups[i].length < NetworkingUtility.ValidIPv6GroupSize) groups[i] = '0' + groups[i];

            expandedAddress += i !== NetworkingUtility.ValidIPv6GroupsCount - 1 ? groups[i] + ':' : groups[i];
        }

        return expandedAddress;
    }

    /**
     * Compresses an IPv6 address.
     *
     * @example
     * ```ts
     * const ip = 'fe80:0000:0000:0000:0215:5dff:fe02:1c37';
     *
     * NetworkingUtility.CompressIPv6(ip); // 'fe80::215:5dff:fe02:1c37'
     * ```
     * @param {string} ip The IPv6 address to compress.
     * @returns The compressed IPv6 address.
     */
    public static CompressIPv6(ip: string) {
        // compresses an IPv6 address
        // by replacing the zero segments with ::, only one :: is allowed, so try elect the longest one
        // and find leading zeroes within the segments and remove them
        if (!NetworkingUtility.IsIPv6(ip)) {
            return ip;
        }

        return ip.replace(NetworkingUtility.CompressIPv6Regex, '::');
    }

    /**
     * Determine if the given IP is a valid IPv4 address.
     *
     * @example
     * ```ts
     * const ip = '127.0.0.1';
     * const IPv6 = '::1';
     *
     * NetworkingUtility.IsIPv4(ip); // true
     * NetworkingUtility.IsIPv4(IPv6); // false
     * ```
     * @param {string} ip The IP address to check.
     * @returns True if the IP is a valid IPv4 address, false otherwise.
     */
    public static IsIPv4(ip: string) {
        return NetworkingUtility.IPv4Regex.test(ip);
    }

    /**
     * Determines if the given IP is a valid IPv6 address.
     *
     * @example
     * ```ts
     * const ip = '::1';
     * const IPv4 = '127.0.0.1';
     *
     * NetworkingUtility.IsIPv6(ip); // true
     * NetworkingUtility.IsIPv6(IPv4); // false
     * ```
     * @param {string} ip The IP address to check.
     * @returns True if the IP is a valid IPv6 address, false otherwise.
     */
    public static IsIPv6(ip: string) {
        return NetworkingUtility.IPv6Regex.test(ip);
    }

    /**
     * Converts the input IPv4 address to an integer.
     *
     * If the input is not a valid IPv4 address, the function will return 0.
     *
     * @example
     * ```ts
     * const ip = '127.0.0.1';
     * cosnt IPv6 = '::1';
     *
     * NetworkingUtility.IPv4ToInt(ip); // 2130706433
     * NetworkingUtility.IPv4ToInt(IPv6); // 0
     * ```
     * @param {string} ip The IP address to convert.
     * @returns The integer representation of the IP address. 0 if the IP is invalid.
     */
    public static IPv4ToInt(ip: string) {
        if (!NetworkingUtility.IsIPv4(ip)) return 0;

        const parts = ip.split('.');

        return (
            parseInt(parts[0], 10) * Math.pow(256, 3) +
            parseInt(parts[1], 10) * Math.pow(256, 2) +
            parseInt(parts[2], 10) * Math.pow(256, 1) +
            parseInt(parts[3], 10)
        );
    }

    /**
     * Convert the input IPv6 address to an integer.
     *
     * If the input is not a valid IPv6 address, the function will return 0n.
     *
     * @example
     * ```ts
     * const ip = '::1';
     *
     * NetworkingUtility.IPv6ToIntSet(ip); //
     * ```
     * @param {string} ip The IP address to convert.
     * @returns The integer representation of the IP address.
     */
    public static IPv6ToInt(ip: string): bigint {
        if (!NetworkingUtility.IsIPv6(ip)) return 0n;

        // Converts the likes of ::1 to 0000:0000:0000:0000:0000:0000:0000:0001
        const fullAddress = NetworkingUtility.DecompressIPv6(ip);

        // Split the address into its segments
        const parts = fullAddress.split(':');

        const newParts = [];

        parts.forEach((it) => {
            let bin = parseInt(it, 16).toString(2);

            while (bin.length < 16) {
                bin = '0' + bin;
            }

            newParts.push(bin);
        });

        const bin = newParts.join('');

        return NetworkingUtility.ConvertBase(bin, 2, 10);
    }

    /**
     * Attempts to convert the input int128 to an IPv6 address.
     *
     * @example
     * ```ts
     * const ip = '::1';
     *
     * NetworkingUtility.IntToIPv6(ip); // '0000:0000:0000:0000:0000:0000:0000:0001'
     * ```
     * @warning This function is not yet implemented.
     * @param {string} ip The IP address to convert.
     * @param {boolean} compress Whether or not to compress the IPv6 address. As in 0000:0000:0000:0000:0000:0000:0000:0001 -> ::1
     * @returns The string representation of the IP address.
     */
    public static IntToIPv6(ip: bigint, compress: bool = true): string {
        throw new Error('Not implemented');

        /*// convert the input to a binary string
        const bin = ip.toString(2);

        // split the binary string into 16-bit segments
        const parts = [];

        for (let i = 0; i < bin.length; i += 16) {
            parts.push(bin.substr(i, 16));
        }

        // convert the segments to hexadecimal
        const hex = parts.map((it) => parseInt(it, 2).toString(16)).join(':');

        // split the hexadecimal string into 8-bit segments
        const segments = [];

        for (let i = 0; i < hex.length; i += 4) {
            segments.push(hex.substr(i, 4));
        }

		// Fill in the missing segments with zeroes
		const missingSegments = 8 - segments.length;
		for (let i = 0; i < missingSegments; i++) {
			segments.unshift('0000');
		}

		// Find any segments that aren't 4 characters long and fill the leading zeroes in
		for (let i = 0; i < segments.length; i++) {
			if (segments[i].length < 4) {
				// found a segment that is less than 4 characters long
				// fill in the leading zeroes
				for (let j = 0; j < 4 - segments[i].length; j++) {
					segments[i] = '0' + segments[i];
				}
			}
		}

        // convert the segments to IPv6
        return segments.join(':');*/
    }

    /**
     * Convert the input integer to an IPv4 address.
     *
     * @example
     * ```ts
     * const ip = 0x7f000001;
     *
     * NetworkingUtility.IntToIPv4(ip); // '127.0.0.1'
     * ```
     * @param {string} ip The IP address to convert.
     * @returns The string representation of the IP address.
     */
    public static IntToIPv4(ip: number) {
        return (ip >>> 24) + '.' + ((ip >>> 16) & 0xff) + '.' + ((ip >>> 8) & 0xff) + '.' + (ip & 0xff);
    }

    /**
     * Determines if the given IP address is within the IP range notation.
     *
     * @example
     * ```ts
     * const ip = '127.0.0.1';
     * const otherIp = '::1';
     * const ipRange = '127.0.0.0-127.255.255.255';
     *
     * NetworkingUtility.IsIpInRange(ip, ipRange); // true
     * NetworkingUtility.IsIpInRange(otherIp, ipRange); // false
     * ```
     * @param {string} ip The IP address to check.
     * @param {string} range The IP range notation to check against.
     * @returns True if the IP is within the range, false otherwise.
     */
    public static IsIPv4InRange(ip: string, range: string) {
        if (ip === '' || range === '') return false;
        if (ip === range) return true;
        if (!NetworkingUtility.IsIPv4(ip)) return false;

        // range might be 255.255.*.* or 1.2.3.0-1.2.3.255
        if (range.indexOf('*') !== -1) {
            // a.b.*.* format
            // Just convert it to A-B format by setting * to 0 for A and 255 for B
            const lower = range.replace(/\*/, '0');
            const upper = range.replace(/\*/, '255');
            range = `${lower}-${upper}`;
        }

        if (range.indexOf('-') !== -1) {
            // A-B format
            const [lower, upper] = range.split('-');

            // Get the lower ip bytes
            const lowerBytes = NetworkingUtility.IPv4ToInt(lower);

            // Get the upper ip bytes
            const upperBytes = NetworkingUtility.IPv4ToInt(upper);

            // Get the ip bytes
            const ipBytes = NetworkingUtility.IPv4ToInt(ip);

            return ipBytes >= lowerBytes && ipBytes <= upperBytes;
        }

        return false;
    }

    /**
     * Determines if the given IP address is within any of the IP range notations.
     *
     * @example
     * ```ts
     * const ip = '127.0.0.1';
     * const otherIPv4 = '10.0.0.1';
     * const otherIp = '::1';
     * const ranges = ['127.0.0.1-127.255.255.255', '10.0.0.0-10.255.255.255'];
     *
     * NetworkingUtility.IsIpInRange(ip, ranges); // true (ip matches 127.0.0.1-127.255.255.255)
     * NetworkingUtility.IsIpInRange(otherIp, ranges); // false (ip doesn't match any of the ranges)
     * NetworkingUtility.IsIpInRange(otherIPv4, ranges); // true (ip matches 10.0.0.0-10.255.255.255)
     * ```
     * @param {string} ip The IP address to check.
     * @param {string[]} rangeList The IP range notations to check against.
     * @returns True if the IP is within any of the ranges, false otherwise.
     */
    public static IsIPv4InRangeList(ip: string, rangeList: string[]) {
        for (const range of rangeList) {
            if (NetworkingUtility.IsIPv4InRange(ip, range)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Determines if the given IPv6 address is within the IP range notation.
     *
     * @example
     * ```ts
     * const ip = '::1';
     * const otherIp = '127.0.0.1';
     * const ipRange = '::1-::ffff';
     *
     * NetworkingUtility.IsIpInRange(ip, ipRange); // true
     * NetworkingUtility.IsIpInRange(otherIp, ipRange); // false
     * ```
     * @param {string} ip The IP address to check.
     * @param {string} range The IP range notation to check against.
     * @returns True if the IP is within the range, false otherwise.
     */
    public static IsIPv6InRange(ip: string, range: string) {
        if (ip === '' || range === '') return false;
        if (ip === range) return true;
        if (!NetworkingUtility.IsIPv6(ip)) return false;

        // range can only be in the format of aaaa:bbbb:cccc:dddd:eeee:ffff:gggg:hhhh-hhhh:iiii:jjjj:kkkk:llll:mmmm:nnnn:oooo:pppp
        if (range.indexOf('-') !== -1) {
            // A-B format
            let [lower, upper] = range.split('-');

            lower = NetworkingUtility.DecompressIPv6(lower);
            upper = NetworkingUtility.DecompressIPv6(upper);

            // Get the lower ip bytes
            const lowerBytes = NetworkingUtility.IPv6ToInt(lower);

            // Get the upper ip bytes
            const upperBytes = NetworkingUtility.IPv6ToInt(upper);

            // Get the ip bytes
            const ipBytes = NetworkingUtility.IPv6ToInt(ip);

            return ipBytes >= lowerBytes && ipBytes <= upperBytes;
        }

        return false;
    }

    /**
     * Determines if the given IPv6 address is within any of the IP range notations.
     *
     * @example
     * ```ts
     * const ip = '::1';
     * const otherIp = '127.0.0.1';
     * const ranges = ['::1-::ffff', '::1-::ffff:ffff:ffff:ffff:ffff:ffff:ffff'];
     *
     * NetworkingUtility.IsIpInRange(ip, ranges); // true (ip matches ::1-::ffff)
     * NetworkingUtility.IsIpInRange(otherIp, ranges); // false (ip doesn't match any of the ranges)
     * ```
     * @param {string} ip The IP address to check.
     * @param {string[]} rangeList The IP range notations to check against.
     * @returns True if the IP is within any of the ranges, false otherwise.
     */
    public static IsIPv6InRangeList(ip: string, rangeList: string[]) {
        for (const range of rangeList) {
            if (NetworkingUtility.IsIPv6InRange(ip, range)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Determines if the given IP address is within the IP netmask notation.
     *
     * @example
     * ```ts
     * const ip = '127.0.0.1';
     * const otherIp = '::1';
     * const netmask = '127.0.0.0/255.0.0.0';
     *
     * NetworkingUtility.IsIpInRange(ip, netmask); // true
     * NetworkingUtility.IsIpInRange(otherIp, netmask); // false
     * ```
     * @note This method is only valid for IPv4 addresses.
     * @param {string} ip The IP address to check.
     * @param {string} netmask The IP netmask notation to check against.
     * @returns True if the IP is within the netmask, false otherwise.
     */
    public static IsIpInNetmask(ip: string, netmask: string) {
        if (ip === '' || netmask === '') return false;
        if (ip === netmask) return true;
        if (netmask === '0.0.0.0/0.0.0.0') return true;
        if (!NetworkingUtility.IsIPv4(ip)) return false;

        if (netmask.indexOf('/') !== -1) {
            let [range, mask] = netmask.split('/');

            if (mask.indexOf('.') !== -1) {
                // netmask is a
                // a.b.c.d/mask
                // replace all * with 0
                mask = mask.replace(/\*/g, '0');

                // Get the mask bytes
                const maskBytes = NetworkingUtility.IPv4ToInt(mask);

                // Get the ip bytes
                const ipBytes = NetworkingUtility.IPv4ToInt(ip);

                // get range bytes
                const rangeBytes = NetworkingUtility.IPv4ToInt(range);

                return (ipBytes & maskBytes) === (rangeBytes & maskBytes);
            }
        }

        return false;
    }

    /**
     * Determines if the given IP address is within any of the IP netmask notations.
     *
     * @example
     * ```ts
     * const ip = '127.0.0.1';
     * const otherIp = '::1';
     * const ranges = ['127.0.0.0/255.0.0.0'];
     *
     * NetworkingUtility.IsIpInRange(ip, ranges); // true (ip matches 127.0.0.0/255.0.0.0)
     * NetworkingUtility.IsIpInRange(otherIp, ranges); // false (ip doesn't match any of the ranges)
     * ```
     * @param {string} ip The IP address to check.
     * @param {string[]} netmaskList The IP netmask notations to check against.
     * @returns True if the IP is within any of the netmasks, false otherwise.
     */
    public static IsIpInNetmaskList(ip: string, netmaskList: string[]) {
        for (const netmask of netmaskList) {
            if (NetworkingUtility.IsIpInNetmask(ip, netmask)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Determines if the given IP address is within the IP CIDR notation.
     *
     * @example
     * ```ts
     * const ip = '127.0.0.1';
     * const otherIp = '::1';
     * const cidr = '127.0.0.0/8';
     *
     * NetworkingUtility.IsIpInRange(ip, cidr); // true
     * NetworkingUtility.IsIpInRange(otherIp, cidr); // false
     * ```
     * @param {string} ip The IP address to check.
     * @param {string} cidr The IP CIDR notation to check against.
     * @returns True if the IP is within the CIDR, false otherwise.
     */
    public static IsIPv4InCidrRange(ip: string, cidr: string) {
        if (ip === '' || cidr === '') return false;
        if (ip === cidr) return true;
        if (cidr === '0.0.0.0/0') return true;
        if (!NetworkingUtility.IsIPv4(ip)) return false;

        let [subnet, mask] = cidr.split('/');

        // Mask is technically optional. If it's not specified, assume it's a /32
        if (mask === undefined) mask = '32';

        const maskAsInt = parseInt(mask);

        // Get ip bytes
        const ipBytes = NetworkingUtility.IPv4ToInt(ip);

        // Get mask bytes
        const maskBytes = -1 << (32 - maskAsInt);

        // Get subnet bytes
        let subnetBytes = NetworkingUtility.IPv4ToInt(subnet);

        // nb: in case the supplied subnet wasn't correctly aligned.
        subnetBytes &= maskBytes;

        return (ipBytes & maskBytes) === subnetBytes;
    }

    /**
     * Determines if the given IP address is within any of the IP CIDR notations.
     *
     * @example
     * ```ts
     * const ip = '127.0.0.1';
     * const otherIp = '::1';
     * const ranges = ['127.0.0.1/8'];
     *
     * NetworkingUtility.IsIpInRange(ip, ranges); // true (ip matches 127.0.0.1/8)
     * NetworkingUtility.IsIpInRange(otherIp, ranges); // false (ip doesn't match any of the ranges)
     * ```
     * @param {string} ip The IP address to check.
     * @param {string[]} cidrList The IP CIDR notations to check against.
     * @returns True if the IP is within any of the CIDRs, false otherwise.
     */
    public static IsIPv4InCidrRangeList(ip: string, cidrList: string[]) {
        for (const cidr of cidrList) {
            if (NetworkingUtility.IsIPv4InCidrRange(ip, cidr)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Determines if the given IPv6 address is within the IP CIDR notation.
     *
     * @example
     * ```ts
     * const ip = '::1';
     * const otherIp = '127.0.0.1';
     * const cidr = '::1/112';
     *
     * NetworkingUtility.IsIpInRange(ip, cidr); // true
     * NetworkingUtility.IsIpInRange(otherIp, cidr); // false
     * ```
     * @param {string} ip The IPv6 address to check.
     * @param {string} cidr The IPv6 CIDR notation to check against.
     * @returns True if the IPv6 is within the CIDR, false otherwise.
     */
    public static IsIPv6InCidrRange(ip: string, cidr: string) {
        if (ip === '' || cidr === '') return false;
        if (ip === cidr) return true;
        if (cidr === '::/0') return true;
        if (!NetworkingUtility.IsIPv6(ip)) return false;

        let [subnet, mask] = cidr.split('/');

        // Mask is technically optional. If it's not specified, assume it's a /128
        if (mask === undefined) mask = '128';

        const maskAsInt = parseInt(mask);

        // Get ip bytes
        const ipBytes = NetworkingUtility.IPv6ToInt(ip);

        // Get mask bytes
        const maskBytes = -1 << (128 - maskAsInt);

        // Get subnet bytes
        let subnetBytes = NetworkingUtility.IPv6ToInt(subnet);

        // nb: in case the supplied subnet wasn't correctly aligned.
        subnetBytes &= BigInt(maskBytes);

        return (ipBytes & BigInt(maskBytes)) === subnetBytes;
    }

    /**
     * Determines if the given IPv6 address is within any of the IP CIDR notations.
     *
     * @example
     * ```ts
     * const ip = '::1';
     * const otherIp = '127.0.0.1';
     * const ranges = ['::1/112'];
     *
     * NetworkingUtility.IsIpInRange(ip, ranges); // true (ip matches ::1/112)
     * NetworkingUtility.IsIpInRange(otherIp, ranges); // false (ip doesn't match any of the ranges)
     * ```
     * @param {string} ip The IPv6 address to check.
     * @param {string[]} cidrList The IPv6 CIDR notations to check against.
     * @returns True if the IPv6 is within any of the CIDRs, false otherwise.
     */
    public static IsIPv6InCidrRangeList(ip: string, cidrList: string[]) {
        for (const cidr of cidrList) {
            if (NetworkingUtility.IsIPv6InCidrRange(ip, cidr)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Determines if the given IP address is within the IP Range, Netmask, or CIDR notation.
     *
     * @example
     * ```ts
     * const ip = '127.0.0.1';
     * const otherIp = '::1';
     * const range = '127.0.0.0-127.255.255.255';
     * const netmask = '127.0.0.0/255.0.0.0';
     * const cidr = '127.0.0.0/8';
     *
     * NetworkingUtility.IsIpInRange(ip, range); // true
     * NetworkingUtility.IsIpInRange(otherIp, range); // false
     * NetworkingUtility.IsIpInRange(ip, netmask); // true
     * NetworkingUtility.IsIpInRange(otherIp, netmask); // false
     * NetworkingUtility.IsIpInRange(ip, cidr); // true
     * NetworkingUtility.IsIpInRange(otherIp, cidr); // false
     * ```
     * @param {string} ip The IP address to check.
     * @param {string} cidrNetmaskOrRange The IP Range, Netmask, or CIDR notation to check against.
     * @returns True if the IP is within the CIDR, false otherwise.
     */
    public static IsIPv4InCidrNetmaskOrRange(ip: string, cidrNetmaskOrRange: string) {
        if (ip === '' || cidrNetmaskOrRange === '') return false;
        if (ip === cidrNetmaskOrRange) return true;
        if (!NetworkingUtility.IsIPv4(ip)) return false;

        return (
            NetworkingUtility.IsIPv4InRange(ip, cidrNetmaskOrRange) ||
            NetworkingUtility.IsIpInNetmask(ip, cidrNetmaskOrRange) ||
            NetworkingUtility.IsIPv4InCidrRange(ip, cidrNetmaskOrRange)
        );
    }

    /**
     * Determines if the given IPv6 address is within the IP Range or CIDR notation.
     *
     * @example
     * ```ts
     * const ip = '::1';
     * const otherIp = '127.0.0.1';
     * const range = '::1-::ffff';
     * const cidr = '::1/112';
     *
     * NetworkingUtility.IsIpInRange(ip, range); // true
     * NetworkingUtility.IsIpInRange(otherIp, range); // false
     * NetworkingUtility.IsIpInRange(ip, cidr); // true
     * NetworkingUtility.IsIpInRange(otherIp, cidr); // false
     * ```
     * @param {string} ip The IPv6 address to check.
     * @param {string} cidrOrRange The IPv6 Range or CIDR notation to check against.
     * @returns True if the IPv6 is within the CIDR, false otherwise.
     */
    public static IsIPv6InCidrOrRange(ip: string, cidrOrRange: string) {
        if (ip === '' || cidrOrRange === '') return false;
        if (ip === cidrOrRange) return true;
        if (!NetworkingUtility.IsIPv6(ip)) return false;

        return NetworkingUtility.IsIPv6InRange(ip, cidrOrRange) || NetworkingUtility.IsIPv6InCidrRange(ip, cidrOrRange);
    }

    /**
     * Determines if the given IP address is within the IP Range, Netmask, or CIDR notations
     *
     * @example
     * ```ts
     * const ip = '127.0.0.1';
     * const otherIp = '::1';
     * const ranges = ['127.0.0.1-127.255.255.255', '127.0.0.0/255.0.0.0', '127.0.0.0/8'];
     *
     * NetworkingUtility.IsIpInRange(ip, ranges); // true (ip matches all of the ranges)
     * NetworkingUtility.IsIpInRange(otherIp, ranges); // false (ip doesn't match any of the ranges)
     * ```
     * @param {string} ip The IP address to check.
     * @param {string[]} cidrNetmaskOrRangeList The IP Range, Netmask, or CIDR notations to check against.
     * @returns True if the IP is within any of the CIDRs, false otherwise.
     */
    public static IsIPv4InCidrNetmaskOrRangeList(ip: string, cidrNetmaskOrRangeList: string[]) {
        for (const cidrNetmaskOrRange of cidrNetmaskOrRangeList) {
            if (NetworkingUtility.IsIPv4InCidrNetmaskOrRange(ip, cidrNetmaskOrRange)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Determines if the given IPv6 address is within the IP Range or CIDR notations
     *
     * @example
     * ```ts
     * const ip = '::1';
     * const otherIp = '127.0.0.1';
     * const ranges = ['::1-::ffff', '::1/112'];
     *
     * NetworkingUtility.IsIpInRange(ip, ranges); // true (ip matches all of the ranges)
     * NetworkingUtility.IsIpInRange(otherIp, ranges); // false (ip doesn't match any of the ranges)
     * ```
     * @param {string} ip The IPv6 address to check.
     * @param {string[]} cidrOrRangeList The IPv6 Range or CIDR notations to check against.
     * @returns True if the IPv6 is within any of the CIDRs, false otherwise.
     */
    public static IsIPv6InCidrOrRangeList(ip: string, cidrOrRangeList: string[]) {
        for (const cidrOrRange of cidrOrRangeList) {
            if (NetworkingUtility.IsIPv6InCidrOrRange(ip, cidrOrRange)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Determines if the given IPv4 address is an RFC1918 address.
     *
     * @example
     * ```ts
     * const ip = '127.0.0.1';
     * const otherIp = '::1';
     * const rfc1918Ip = '10.0.0.1';
     *
     * NetworkingUtility.IsIpInRfc1918Range(ip); // false
     * NetworkingUtility.IsIPv4Rfc1918(otherIp); // false
     * NetworkingUtility.IsIPv4Rfc1918(rfc1918Ip); // true
     * ```
     * @param {string} ip The IPv4 address to check.
     * @returns True if the IP is an RFC1918 address, false otherwise.
     */
    public static IsIPv4Rfc1918(ip: string) {
        return NetworkingUtility.IsIPv4InCidrRangeList(ip, [
            NetworkingUtility.MaxRFC1918IPv4Cidr,
            NetworkingUtility.SecondMaxRFC1918IPv4Cidr,
            NetworkingUtility.MinRFC1918IPv4Cidr,
        ]);
    }

    /**
     * Determines if the given IPv6 address is a loopback address.
     *
     * @example
     * ```ts
     * const ip = '127.0.0.1';
     * const otherIp = '::1';
     *
     * NetworkingUtility.IsIPv4Loopback(ip); // true
     * NetworkingUtility.IsIPv4Loopback(otherIp); // false (because it's an IPv6 address)
     * ```
     * @param {string} ip The IPv6 address to check.
     * @returns True if the IP is a loopback address, false otherwise.
     */
    public static IsIPv4Loopback(ip: string) {
        return NetworkingUtility.IsIPv4InCidrRange(ip, NetworkingUtility.IPv4LoopbackCidr);
    }

    /**
     * Determines if the given IPv6 address is a rfc4193 address.
     *
     * @example
     * ```ts
     * const ip = 'fe80::1';
     * const otherIp = '::1';
     *
     * NetworkingUtility.IsIPv6Rfc4193(ip); // true
     * NetworkingUtility.IsIPv6Rfc4193(otherIp); // false
     * ```
     * @param {string} ip The IPv6 address to check.
     * @returns True if the IP is a link-local address, false otherwise.
     */
    public static IsIPv6Rfc4193(ip: string) {
        return NetworkingUtility.IsIPv6InCidrRange(ip, NetworkingUtility.IPv6PrivateCidr);
    }

    /**
     * Determines if the given IPv6 address is a unique local address.
     *
     * @example
     * ```ts
     * const ip = 'fc00::1';
     * const otherIp = '::1';
     *
     * NetworkingUtility.IsIPv6Rfc3879(ip); // true
     * NetworkingUtility.IsIPv6Rfc3879(otherIp); // false
     * ```
     * @param {string} ip The IPv6 address to check.
     * @returns True if the IP is a unique local address, false otherwise.
     */
    public static IsIPv6Rfc3879(ip: string) {
        return NetworkingUtility.IsIPv6InCidrRange(ip, NetworkingUtility.IPv6LinkLocalCidr);
    }

    /**
     * Determines if the given IPv6 address is a site-local address.
     *
     * @example
     * ```ts
     * const ip = 'fec0::1';
     * const otherIp = '::1';
     *
     * NetworkingUtility.IsIPv6Loopback(ip); // false
     * NetworkingUtility.IsIPv6Loopback(otherIp); // true
     * ```
     * @param {string} ip The IPv6 address to check.
     * @returns True if the IP is a site-local address, false otherwise.
     */
    public static IsIPv6Loopback(ip: string) {
        return NetworkingUtility.IsIPv6InCidrRange(ip, NetworkingUtility.IPv6LoopbackCidr);
    }

    /**
     * Determines if the given IPv4 address is a link-local address.
     *
     * @example
     * ```ts
     * const ip = '169.254.0.1';
     * const otherIp = '::1';
     * const loopbackIp = '127.0.0.1';
     *
     * NetworkingUtility.IsIPv4LinkLocal(ip); // true
     * NetworkingUtility.IsIPv4LinkLocal(otherIp); // false
     * NetworkingUtility.IsIPv4LinkLocal(loopbackIp); // false
     * ```
     * @param ip
     * @returns
     */
    public static IsIPv4LinkLocal(ip: string) {
        return NetworkingUtility.IsIPv4InCidrRange(ip, NetworkingUtility.IPv4LinkLocal);
    }

    public static IsIPv6LinkLocal(ip: string) {
        return NetworkingUtility.IsIPv6InCidrRange(ip, NetworkingUtility.IPv6LinkLocal);
    }

    /**
     * Determines if the given CIDR is an IPv4 CIDR.
     *
     * @example
     * ```ts
     * const ip = '127.0.0.0/8';
     * const otherIp = '::1/128';
     *
     * NetworkingUtility.IsIPv4Cidr(ip); // true
     * NetworkingUtility.IsIPv4Cidr(otherIp); // false
     * ```
     * @param {string} cidr The CIDR to check.
     * @returns True if the CIDR is an IPv4 CIDR, false otherwise.
     */
    public static IsCidrIPv4(cidr: string): boolean {
        return NetworkingUtility.IsIPv4(cidr?.split('/')[0]);
    }

    /**
     * Determines if the given CIDR is an IPv6 CIDR.
     *
     * @example
     * ```ts
     * const ip = '::1/128';
     * const otherIp = '127.0.0.0/8';
     *
     * NetworkingUtility.IsIPv6Cidr(ip); // true
     * NetworkingUtility.IsIPv6Cidr(otherIp); // false
     * ```
     * @param {string} cidr The CIDR to check.
     * @returns True if the CIDR is an IPv6 CIDR, false otherwise.
     */
    public static IsCidrIPv6(cidr: string): boolean {
        return NetworkingUtility.IsIPv6(cidr?.split('/')[0]);
    }

    /**
     * Generates a random UUIDv4 string.
     * @returns A random UUIDv4 string.
     */
    public static GenerateUUIDV4() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = (Math.random() * 16) | 0,
                v = c == 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    /**
     * Resolves the IP address of the given hostname.
     *
     * @example
     * ```ts
     * NetworkingUtility.ResolveHostname('www.google.com'); // '74.125.193.147'
     * ```
     * @param {string} hostname The hostname to resolve.
     * @returns The IP address of the given hostname.
     */
    public static async ResolveHostname(hostname: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            LookupHostname(hostname, (err, address, _) => {
                if (err) {
                    if (err.code === 'ENOTFOUND') {
                        resolve(null);

                        return;
                    }

                    reject(err);
                }
                return resolve(address);
            });
        });
    }

    /**
     * Gets the RFC1918 IP address for the current machine.
     *
     * It will either return the first ethernet interface address or WiFi interface address.
     * @returns The RFC1918 IP address for the current machine.
     */
    public static GetLocalIP(): string {
        if (process.env.MFDLABS_LOCAL_IP !== undefined) return process.env.MFDLABS_LOCAL_IP;

        var netInterfaces = GetNetworkInterfaces();
        for (var interfaceName in netInterfaces) {
            if (!NetworkingUtility.EthernetInterfaceRegex.test(interfaceName) && !NetworkingUtility.WifiInterfaceRegex.test(interfaceName))
                continue;

            var netInterface = netInterfaces[interfaceName];

            for (var i = 0; i < netInterface.length; i++) {
                var alias = netInterface[i];

                if (
                    alias.family === 'IPv4' &&
                    alias.address !== 'localhost' &&
                    !NetworkingUtility.IsIPv4Loopback(alias.address) &&
                    NetworkingUtility.IsIPv4Rfc1918(alias.address)
                ) {
                    return alias.address;
                }
            }
        }
        return '127.0.0.1';
    }

    /**
     * Gets the machine ID for the current machine.
     * @returns	The machine ID for the current machine.
     */
    public static GetMachineID() {
        return process.env.MFDLABS_MACHINE_ID || GetMachineHost();
    }

    /**
     * Encodes the given string into a HTML-safe string.
     * @param {string} str The string to encode.
     * @returns The encoded string.
     */
    public static HtmlEncode(str: string) {
        return str.replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;').replace(/ /g, '&nbsp;').replace(/\n/g, '<br />').replace(/\r/g, '<br />');
    }

    /**
     * Determines if the input user-agent is a crawler.
     * @param {string} userAgent The user-agent to check.
     * @returns True if the user-agent is a crawler, false otherwise.
     */
    public static IsCrawler(userAgent: string) {
        return NetworkingUtility.CrawlerRegex.test(userAgent);
    }

    /**
     * Attempts to fetch the public IP of the current machine from it's network interfaces.
     * It will go through each ethernet and wlan interface and return the first one that isn't loopback or rfc1918.
     *
     * Doesn't support IPv6. (yet)
     * @returns The public IP of the current machine.
     */
    public static GetPublicIPFromInterfaces(): string {
        var netInterfaces = GetNetworkInterfaces();
        for (var interfaceName in netInterfaces) {
            if (!NetworkingUtility.EthernetInterfaceRegex.test(interfaceName) && !NetworkingUtility.WifiInterfaceRegex.test(interfaceName))
                continue;

            var netInterface = netInterfaces[interfaceName];

            for (var i = 0; i < netInterface.length; i++) {
                var alias = netInterface[i];

                if (
                    alias.family === 'IPv4' &&
                    alias.address !== 'localhost' &&
                    !NetworkingUtility.IsIPv4Loopback(alias.address) &&
                    !NetworkingUtility.IsIPv4Rfc1918(alias.address) &&
                    !NetworkingUtility.IsIPv4LinkLocal(alias.address)
                ) {
                    return alias.address;
                }
            }
        }
        return null;
    }

    /**
     * Trys to fetch the public IP address of the current machine.
     * This is really only if you are behind a NAT.
     * If you are not behind a NAT, use getInterfaces() instead.
     * @returns The public IP address of the current machine.
     */
    public static async GetPublicIP() {
        return new Promise<string>((resolve, reject) => {
            GetRequest({ host: 'api.ipify.org', port: 80, path: '/' }, function (resp) {
                resp.on('data', function (ip) {
                    resolve(ip.toString());

                    return;
                });

                resp.on('error', function (err) {
                    reject(err);

                    return;
                });
            });
        });
    }

    /**
     * Gets the route table for the current machine.
     *
     * @note	This is only supported on Windows.
     * @returns    The route table for the current machine.
     */
    public static GetRouteTable() {
        if (process.platform === 'win32') {
            // We will use `route print` to get the route table.
            // It is in the format of:
            // ===========================================================================
            // Interface List
            // 1...........................Software Loopback Interface 1
            // ...
            // ===========================================================================
            //
            // IPv4 Route Table
            // ===========================================================================
            // Active Routes:
            // Network Destination        Netmask          Gateway       Interface  Metric
            //           0.0.0.0          0.0.0.0      192.168.0.1     192.168.0.50     35
            // ...
            // ===========================================================================
            // Persistent Routes:
            //    ...
            // ===========================================================================
            //
            // IPv6 Route Table
            // ===========================================================================
            // Active Routes:
            //  If Metric Network Destination      Gateway
            //   1    331 ::1/128                  On-link
            //   ...
            // ===========================================================================
            // Persistent Routes:
            //    ...
            // ===========================================================================
            //
            // We will only parse the IPv4 route table if IPv4Only is true.

            const routeTable = Execute('route print').toString();
            const routeTableLines = routeTable.split('\r\n'); // we assume it's gonna be \r\n because windows.

            let interfaces = false;
            let IPv4Routes = false;
            let IPv6Routes = false;
            let didHitFirstHeader = false;

            const routes = [];
            for (const line of routeTableLines) {
                if (line.startsWith('===========================================================================')) {
                    // Check if they are all false. If so then we are the first header which means this equals sign comes before the title.
                    if (!interfaces && !IPv4Routes && !IPv6Routes) {
                        interfaces = true;
                        IPv4Routes = false;
                        IPv6Routes = false;
                        didHitFirstHeader = true;

                        continue;
                    }

                    if (didHitFirstHeader) {
                        // We hit the second header, so we are done. Unset the flags.
                        interfaces = false;
                        IPv4Routes = false;
                        IPv6Routes = false;
                        didHitFirstHeader = false;
                    } else {
                        didHitFirstHeader = true;
                    }

                    continue;
                }

                if (line.startsWith('Active Routes:')) {
                    continue;
                }

                if (line.startsWith('Interface List')) {
                    continue;
                }

                // We need to differentiate between the Interface List, IPv4 Route Table, and IPv6 Route Table.

                if (line.startsWith('IPv4 Route Table')) {
                    interfaces = false;
                    IPv4Routes = true;
                    IPv6Routes = false;

                    continue;
                }

                if (line.startsWith('IPv6 Route Table')) {
                    interfaces = false;
                    IPv4Routes = false;
                    IPv6Routes = true;

                    continue;
                }

                if (interfaces) {
                    // We are in the interface list.
                    // It is in the format of:
                    // .... numbers .....Interface Name
                    // We need to parse the interface name. We don't care about the numbers.
                    const interfaceName = line.split('.');

                    // It should be the last item in the array.
                    if (interfaceName.length > 0) {
                        routes.push({
                            type: 'interface',
                            name: interfaceName[interfaceName.length - 1].trim(),
                        });
                    }

                    continue;
                }

                if (IPv4Routes) {
                    // We are in the IPv4 route table.
                    // It is in the format of:
                    // Network Destination        Netmask          Gateway       Interface  Metric
                    // We need to parse the network destination, netmask, gateway, and interface.
                    const route = line.split(' ').filter((x) => x.length > 0);

                    // Check if we are at the header. i.e the first line after the equals signs.
                    // Just check if it starts with a "Network Destination".
                    if (route[0].startsWith('Network')) {
                        continue;
                    }

                    // It should be the last item in the array.
                    if (route.length > 0) {
                        routes.push({
                            type: 'IPv4',
                            network: route[0].trim(),
                            netmask: route[1].trim(),
                            gateway: route[2].trim(),
                            interface: route[3].trim(),
                            metric: parseInt(route[4].trim()),
                        });
                    }

                    continue;
                }

                if (IPv6Routes) {
                    // We are in the IPv6 route table.
                    // It is in the format of:
                    // If Metric Network Destination      Gateway
                    // 1    331 ::1/128                  On-link
                    // ...
                    // We need to parse the network destination, gateway, and interface.
                    const route = line.split(' ').filter((x) => x.length > 0);

                    // Check if we are at the header. i.e the first line after the equals signs.
                    // Just check if it starts with a "If".
                    if (route[0].startsWith('If')) {
                        continue;
                    }

                    // It should be the last item in the array.

                    // If the route length is 1, then it is the unspecified On-link route.
                    if (route.length === 1) {
                        routes.push({
                            type: 'IPv6',
                            if: undefined,
                            metric: undefined,
                            network: undefined,
                            gateway: route[0]?.trim(),
                        });
                    } else if (route.length > 0) {
                        routes.push({
                            type: 'IPv6',
                            if: parseInt(route[0].trim(), 10),
                            metric: parseInt(route[1].trim(), 10),
                            network: route[2].trim(),
                            gateway: route[3]?.trim(), // It is possible for this to be undefined.
                        });
                    }

                    continue;
                }
            }

            return routes;
        } else {
            // The problem here is that I don't know how to get the route table on Linux formatted in the same way as Windows.

            return [];
        }
    }

    /**
     * Attempts to fetch the default gateway of the current machine.
     * @returns The default gateway of the current machine.
     */
    public static GetDefaultGateway() {
        const routes = NetworkingUtility.GetRouteTable();

        return routes.filter((r) => r.type === 'IPv4' && r.gateway !== 'On-link')[0];
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
}
