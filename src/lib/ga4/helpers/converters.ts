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
 * Facilitates helpers for string manipulation and conversion.
 * @internal This class is not intended for use by application developers.
 */
class Converters {
  /**
   * Converts a string into a `snake_case` string.
   * @param {string} str The string to convert.
   * @returns {string} The converted string.
   * @example
   * const camelCase = "camelCase";
   * const snakeCase = Converters.ToSnakeCase(camelCase);
   * console.log(snakeCase); // "camel_case"
   * @internal This method is used internally and should not be used by the user.
   */
  public static toSnakeCase(str: string): string {
    // https://stackoverflow.com/a/52964182/16064565
    return str
      .replace(/\W+/g, ' ')
      .split(/ |\B(?=[A-Z])/)
      .map((word) => word.toLowerCase())
      .join('_');
  }

  /**
   * Converts a string into a `camelCase` string.
   * @param {string} str The string to convert.
   * @returns {string} The converted string.
   * @example
   * const snakeCase = "snake_case";
   * const camelCase = Converters.ToCamelCase(snakeCase);
   * console.log(camelCase); // "camelCase"
   * @internal This method is used internally and should not be used by the user.
   */
  public static toCamelCase(str: string): string {
    // https://stackoverflow.com/a/2970667/16064565
    return str.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, (match, index) => {
      if (+match === 0) return ''; // or if (/\s+/.test(match)) for white spaces
      return index === 0 ? match.toLowerCase() : match.toUpperCase();
    });
  }
}

export = Converters;
