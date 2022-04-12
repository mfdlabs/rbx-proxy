import { NextFunction, Request, Response } from 'express';

export interface IRoutingController {
    RequestMethod: string;
    Callback(request: Request, Response: Response, next: NextFunction): any;
}
