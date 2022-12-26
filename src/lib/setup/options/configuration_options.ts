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
    File Name: configuration_options.ts
    Description: Represents the configuration options for the application.
    Written by: Nikita Petko
*/

import * as express from 'express';

/**
 * Represents the configuration options for the application.
 */
export default interface ConfigurationOptions {
  /**
   * The Express application to configure.
   */
  app: express.Application;

  /**
   * These are the options for the Express router.
   */
  routingOptions?: express.RouterOptions;

  /**
   * This signifies if we should trust proxy headers.
   */
  trustProxy?: boolean;

  /**
   * This signifies if we should remove the x-powered-by header.
   */
  noXPowerBy?: boolean;

  /**
   * This signifies if we should remove entity tags.
   */
  noETag?: boolean;

  /**
   * This signifies if we should use the raw buffer as a body.
   */
  rawBufferRequest?: boolean;
}
