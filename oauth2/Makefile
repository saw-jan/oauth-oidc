SHELL := bash

SERVICES = \
	auth-server \
	resource-server \
	secure-client

.PHONY: install
install:
	@for service in $(SERVICES); do \
		make -C $$service install; \
	done

.PHONY: serve
serve:
	@for service in $(SERVICES); do \
		cd $$service && pnpm serve & \
	done; \
	wait
