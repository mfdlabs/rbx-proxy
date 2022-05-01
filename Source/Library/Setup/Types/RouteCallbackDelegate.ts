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
    File Name: RouteCallbackDelegate.ts
    Description: Represents the typeof callback for the route.
    Written by: Nikita Petko
*/

import { NextFunction, Request, Response } from 'express';

/**
 * The callback to be invoked when a route is matched.
 * 
 * @param {Request} request The request object.
 * @param {Response} response The response object.
 * @param {NextFunction} next The next function to be invoked.
 * @return {any} This can return anything but will most likely be a promise.
 */
export type RouteCallbackDelegate = (request: Request, Response: Response, next: NextFunction) => any;
