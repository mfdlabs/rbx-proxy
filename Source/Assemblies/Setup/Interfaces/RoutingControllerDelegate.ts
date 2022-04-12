import { NextFunction, Request, Response } from 'express';

export type RoutingControllerDelegate = (request: Request, Response: Response, next: NextFunction) => any;
