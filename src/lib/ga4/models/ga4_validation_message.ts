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

/**
 * Represents an error message from the GA4 validation service.
 *
 * @internal This class is not intended for use by application developers.
 */
export default class GA4ValidationMessage {
  /**
   * Where the invalid data was found.
   */
  public fieldPath: string;

  /**
   * The description of the error.
   */
  public description: string;

  /**
   * The simple name of the error.
   */
  public validationCode: string;
}
