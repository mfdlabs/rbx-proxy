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
    File Name: globals.d.ts
    Description: These are the global declarations for types such as uint, ulong, etc.
                 This was only needed because of the way our developers like to use Types.
    Written by: Nikita Petko
*/

declare type int = number;
declare type uint = number;
declare type double = number;
declare type long = number;
declare type ulong = number;
declare type float = number;
declare type short = number;
declare type ushort = number;
declare type byte = number;
declare type bool = boolean;
declare type char = number;
declare type sbyte = number;
declare type decimal = number;
declare type DateTime = Date;
declare type IntPtr = number;
