import { Express as IExpressApplication } from 'express-serve-static-core';
import { IRoutingOptions } from './IRoutingOptions';
import { ISiteRouteSetupOptions } from './ISiteRouteSetupOptions';

export interface IConfigurationOptions {
    Application: IExpressApplication;
    AllowRoutes?: boolean;
    RoutingOpts?: IRoutingOptions;
    RouteConfiguration?: ISiteRouteSetupOptions;
}
