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

# Run it like this:
# make IMAGE_NAME=<image name>
# Or like this to push to a registry:
# make IMAGE_NAME=<image name> CI=true

IMAGE_TAG=$(shell git rev-parse HEAD)

build:
ifndef IMAGE_NAME
	@echo "IMAGE_NAME is not defined"
else
	@echo "Build the image"
	docker build -t $(IMAGE_NAME):$(IMAGE_TAG) -f Dockerfile .
ifdef CI

	@echo "Copy the image we made into a new tag called \"latest\""
	docker tag $(IMAGE_NAME):$(IMAGE_TAG) $(IMAGE_NAME):latest

	@echo "push the orignal tag to the registry"
	docker push $(IMAGE_NAME):$(IMAGE_TAG)
	
	@echo "push the latest tag to the registry"
	docker push $(IMAGE_NAME):latest

	@echo "delete the local images"
	docker rmi $(IMAGE_NAME):$(IMAGE_TAG)
	docker rmi $(IMAGE_NAME):latest
endif
endif

.PHONY: build
