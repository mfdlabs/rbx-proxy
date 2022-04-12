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
    File Name: IStartupOptions.ts
    Description: Represents the options for the startup process.
    Written by: Nikita Petko
*/

import { Express } from 'express';

/**
 * Represents the options for the startup process.
 */
export interface IStartupOptions {
    /**
     * The Express application to configure.
     */
    Application: Express;

    /**
     * The host, or IP address, to listen on.
     * If you want to listen on a host then supply it here and it will attempt to resolve it and bind to the address it resolves to.
     * If you want to listen on every interface that is IPv4 then supply '0.0.0.0'
     * If you want to listen on every interface that is IPv6 then supply '::'
     * 
     * If not specified then it will default to '::'
     */
    Hostname?: string;

    /**
     * Determines if the SSL server should be enabled.
     * This is can be paired with SslPort to override the default port of 443.
     * 
     * If you specify this then you must also specify CertificateFileName and CertificateKeyFileName.
     * 
     * This will default to false.
     */
    UseSsl?: bool;

    /**
     * Determine if the HTTP server should be enabled.
     * This is can be paired with InsecurePort to override the default port of 80.
     * 
     * This will default to true.
     */
    UseInsecure?: bool;

    /**
     * An override for the default port of 443.
     * This will only apply if UseSsl is true.
     */
    SslPort?: int;

    /**
     * An override for the default port of 80.
     * This will only apply if UseInsecure is true.
     */
    InsecurePort?: int;

    /**
     * This determines if we should use HTTP/2.0 over HTTP/1.1 for SSL.
     * This will only apply if UseSsl is true.
     */
    UseSslV2?: bool;

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Certificate and Key Options
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * This represents the name of the certificate file.
     * You need to include the extension.
     * 
     * If UseSslDirectory is false then you will need to supply the absolute path to the certificate file.
     */
    CertificateFileName?: string;

    /**
     * This represents the name of the certificate key file.
     * You need to include the extension.
     * 
     * If UseSslDirectory is false then you will need to supply the absolute path to the certificate key file.
     */
    CertificateKeyFileName?: string;

    /**
     * This represents the name of the certificate's root/chain file.
     * You need to include the extension.
     * 
     * This is optional but recommended if you actually have a root certificate.
     * 
     * If UseSslDirectory is false then you will need to supply the absolute path to the certificate root/chain file.
     */
    RootCertificateFileName?: string;

    /**
     * This represents the password for the certificate key file if it is encrypted.
     * 
     * This is not required but we highly recommend you encrypt your certificate keys.
     */
    CertificateKeyPassword?: string;

    /**
     * This determines if we should use the __sslDirName from Directories.ts.
     */
    UseSslDirectory?: bool;
}
