.PHONY: dev build start test typecheck image-server image-server-npm

dev:
	cd web && bun run dev

test:
	cd web && bun run test

typecheck:
	cd web && bun run typecheck

# Default local dev mode: build server image from ./web source in this branch.
image-server:
	./scripts/build-push-companion-server.sh $(TAG)

# Release-like mode: build server image from npm package.
image-server-npm:
	COMPANION_SOURCE=npm ./scripts/build-push-companion-server.sh $(TAG)
