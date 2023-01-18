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
	File Name: updateVersion.js
	Description: Gets ran in in the Makefile to update the version number in the package.json and embed the git commit hash into the code.
	Written by: Yaakov T.
*/

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const fileName = path.resolve(__dirname, 'package.json');
const contents = fs.readFileSync(fileName, { encoding: 'utf-8' });

const data = JSON.parse(contents);
const version = data.version;
const commit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).toString().trim();

// Format
// {major}.{minor}.{patch}-{commitHash}.{subversion}

const parsedVersion = version.split('.');
let major = parseInt(parsedVersion[0]);
let minor = parseInt(parsedVersion[1]);
let patchStr = parsedVersion[2];
let patch = parseInt(patchStr);
const commitHash = patchStr.split('-')[1];
let subversion = parseInt(parsedVersion[3]);

if (commitHash === commit) {
  subversion += 1;

  data.version = `${major}.${minor}.${patch}-${commit}.${subversion}`;
} else {
  // If patch reaches 10, increment minor and reset patch
  if (patch === 9) {
    patch = 0;
    minor += 1;
  } else {
    patch += 1;
  }

  // If minor reaches 10, increment major and reset minor
  if (minor === 9) {
    minor = 0;
    major += 1;
  }

  data.version = `${major}.${minor}.${patch}-${commit}.0`;
}

console.log(`Version: ${data.version}`);

fs.writeFileSync(fileName, JSON.stringify(data, null, 2), { encoding: 'utf-8' });