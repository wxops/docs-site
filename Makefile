.PHONY: help install dev clean build serve version version-clean version-list

##@ Local Development

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} \
	     /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 } \
	     /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) }' $(MAKEFILE_LIST)

install: ## Install dependencies (respects package-lock.json)
	npm ci

dev: ## Run the local dev server (hot reload, does NOT check broken links)
	npm run start

##@ Build & Validation

clean: ## Remove build cache and output — do this before build if links seem stale
	rm -rf .docusaurus build

build: clean ## Clean build with strict link/anchor checking (onBrokenLinks: throw)
	npm run build
	@echo ""
	@echo "Build clean — no broken links or anchors."

serve: build ## Build, then serve the production build locally for a final look
	npm run serve

##@ Versioning — see https://docusaurus.io/docs/versioning

version-list: ## Show currently cut versions
	@cat versions.json

version: ## Cut a new version from the current docs/ (Next) tree: make version V=0.6.0
	@if [ -z "$(V)" ]; then \
		echo "Usage: make version V=0.6.0"; exit 1; \
	fi
	@if grep -q "\"$(V)\"" versions.json 2>/dev/null; then \
		echo "error: \"$(V)\" already exists in versions.json — docusaurus docs:version"; \
		echo "  hard-fails on a version name that's already cut, it never overwrites."; \
		echo "  To re-cut it from scratch, run: make version-clean V=$(V)  first."; \
		exit 1; \
	fi
	npx docusaurus docs:version $(V)
	@echo ""
	@echo "Cut \"$(V)\". One manual step left — add a matching entry to"
	@echo "docusaurus.config.ts's presets[0][1].docs.versions block:"
	@echo "  \"$(V)\": { label: \"$(V)\", badge: true },"
	@echo "Skipping this makes the version exist on disk but never show up in the"
	@echo "version dropdown."

version-clean: ## Remove a cut version so it can be re-cut fresh: make version-clean V=0.5.x
	@if [ -z "$(V)" ]; then \
		echo "Usage: make version-clean V=0.5.x"; exit 1; \
	fi
	@if [ ! -d "versioned_docs/version-$(V)" ]; then \
		echo "error: versioned_docs/version-$(V) does not exist — nothing to clean."; \
		exit 1; \
	fi
	rm -rf "versioned_docs/version-$(V)"
	rm -f "versioned_sidebars/version-$(V)-sidebars.json"
	node -e "const fs=require('fs'); const f='versions.json'; \
		const v=JSON.parse(fs.readFileSync(f,'utf8')); \
		fs.writeFileSync(f, JSON.stringify(v.filter(x=>x!=='$(V)'), null, 2)+'\n');"
	@echo ""
	@echo "Removed versioned_docs/version-$(V), versioned_sidebars/version-$(V)-sidebars.json,"
	@echo "and \"$(V)\" from versions.json."
	@echo ""
	@echo "MANUAL STEP STILL NEEDED — remove the \"$(V)\": {...} entry from"
	@echo "docusaurus.config.ts's versions block too. Leaving it there makes the next"
	@echo "build throw: Invalid docs option \"versions\": unknown versions ($(V)) found."
	@echo ""
	@echo "Then re-cut with: make version V=$(V)"
	@echo ""
	@echo "Reminder: the re-cut snapshot is whatever is CURRENTLY in docs/ (Next) at"
	@echo "that moment — if Next has moved on to work meant for a later version, check"
	@echo "that before re-cutting, or the wrong content gets frozen into \"$(V)\"."
