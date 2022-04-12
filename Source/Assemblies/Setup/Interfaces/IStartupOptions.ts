import { Express as IExpressApplication } from 'express-serve-static-core';

export interface IStartupOptions {
    Application: IExpressApplication;
    SiteName: string;
    UseSsl?: bool;
    UseInsecure?: bool;
    SslPort?: int;
    InsecurePort?: int;
    UseSslV2?: bool;

    CertificateFileName?: string;
    CertificateKeyFileName?: string;
    RootCertificateFileName?: string;
    CertificateKeyPassword?: string;
    UseSslDirectoryName?: bool;
}
