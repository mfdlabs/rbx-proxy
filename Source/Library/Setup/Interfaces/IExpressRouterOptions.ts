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
    File Name: IExpressRouterOptions.ts
    Description: Represents the options for the Express router.
    Written by: Nikita Petko
*/

/**
 * Represents the options for the Express router.
 */
export interface IExpressRouterOptions {

    /**
     * Determines if routes should be case sensitive.
     * 
     * @example
     * ```ts
     * // if true:
     * // /x and /X are different routes
     * // /x and /X/ are different routes
     * // /x/ and /X/ are different routes
     * // /x/ and /X are different routes
     * ```
     */
    caseSensitive?: boolean;

    /**
     * Preserve the `req.params` values from the parent router. 
     * If the parent and the child have conflicting param names, the child’s value take precedence.
     */
    mergeParams?: boolean;

    /**
     * Enable strict routing.
     * 
     * @example
     * ```ts
     * // if true:
     * // /x/ and /x are different routes
     * ```
     */
    strict?: boolean;
}
