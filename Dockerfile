#  Copyright 2022 Nikita Petko <petko@vmminfra.net>
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

FROM node:lts-alpine

# make the 'app' folder the current working directory
WORKDIR /opt/proxy

# copy project files and folders to the current working directory (i.e. 'app' folder)
COPY . .

# build app for production
RUN npm run build-full

CMD [ "npm", "start" ]