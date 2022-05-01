IMAGE_TAG=$(shell git rev-parse HEAD | cut -c1-7)

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
