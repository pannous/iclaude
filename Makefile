.PHONY: dev build start test typecheck

dev:
	cd web && bun run dev

test:
	cd web && bun run test

typecheck:
	cd web && bun run typecheck
