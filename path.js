/*
	Copyright 2021 MFDLABS Corporation.

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
	File Name: path.js
	Description: This file will automatically set the path in the src\lib\directories.ts, to disable this, add this to the top of the file src\lib\directories.ts
				 '// !DISABLE-AUTO-SELECT-DIR'
				 It should instert this automatically the first time.
	Written by: Yaakov T.
*/

const fs = require('fs');

(function () {
  try {
    const dir = __dirname.split('\\').join('/');
    const fileName = `${__dirname}/src/lib/directories.ts`;
    if (!fs.existsSync(fileName)) {
      fs.writeFileSync(
        fileName,
        `// THIS FILE WAS AUTOMATICALLY GENERATED, DO NOT EDIT\n// !DISABLE-AUTO-SELECT-DIR\n\nexport const projectDirectoryName = '${dir}';\n`,
      );
      return;
    }
    let contents = fs.readFileSync(fileName, { encoding: 'utf-8' });
    if (contents.includes('// !DISABLE-AUTO-SELECT-DIR')) {
      console.log(
        `The file ./src/lib/directories.ts was forced to not select the current directory. Most likely because it's already been generated.`,
      );
      return;
    }
    const data = contents.match(/(["'])(?:(?=(\\?))\2.)*?\1/i);
    contents = contents.replace(data[0], `'${dir}'`);
    contents = `// THIS FILE WAS AUTOMATICALLY GENERATED, DO NOT EDIT\n// !DISABLE-AUTO-SELECT-DIR\n\n${contents}`;
    fs.writeFileSync(fileName, contents);
  } catch (e) {}
})();
