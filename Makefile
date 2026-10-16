BLENDER := $(shell command -v blender 2>/dev/null)
ifeq ($(BLENDER),)
# macOS-specific fallback for when 'blender' isn't on PATH.
# Linux/Windows users should ensure 'blender' is on PATH instead.
BLENDER := /Applications/Blender.app/Contents/MacOS/Blender
endif

.PHONY: install dev build preview blender-models generate-audio clean

install:
	npm install

dev:
	npm run dev

build:
	npm run build

preview:
	npm run preview

blender-models:
	for script in tools/blender/generate_*.py; do \
		[ -e "$$script" ] || continue; \
		echo "Running $$script"; \
		"$(BLENDER)" --background --python "$$script"; \
	done

generate-audio:
	for script in tools/audio/generate_*.py; do \
		[ -e "$$script" ] || continue; \
		echo "Running $$script"; \
		python3 "$$script"; \
	done

clean:
	rm -rf node_modules dist tools/blender/__pycache__ tools/audio/__pycache__
