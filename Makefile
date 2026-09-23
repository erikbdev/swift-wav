DEST_DIR := Public/static/toolchain

# toolchain
TAG ?= swift-6.3.3-wasm
BASE_URL := https://github.com/erikbdev/swift-toolchain-wasm/releases/download/$(TAG)
WASM_FILES := swift-frontend.wasm swift-ide-test.wasm wasm-ld.wasm
TOOLCHAIN_FILES := $(WASM_FILES) swift-sysroot-core.tar

# libswiftwav
SWIFT_SDK ?= swift-6.3.3-RELEASE_wasm
CONFIGURATION ?= debug
TARGET_TRIPLE := wasm32-unknown-wasip1
BUILD_DIR := .build/$(TARGET_TRIPLE)/$(CONFIGURATION)
MODULES := SwiftWAV SwiftWAVCore SwiftWAVEngine
STAGE_DIR := $(DEST_DIR)/.libswiftwav
SWIFT_SOURCES := $(shell find Sources/SwiftWAV Sources/SwiftWAVCore Sources/SwiftWAVEngine -name '*.swift')

.DEFAULT_GOAL := all
.DELETE_ON_ERROR:
.PHONY: all toolchain libswiftwav clean

all: toolchain libswiftwav

# Precompiled swift-toolchain-wasm release artifacts
# (https://github.com/tothambrus11/swift-toolchain-wasm) that let the
# browser editor compile and run Swift in-process via WASI.
toolchain: $(foreach f,$(TOOLCHAIN_FILES),$(DEST_DIR)/$(f) $(DEST_DIR)/$(f).gz $(DEST_DIR)/$(f).br)

$(DEST_DIR)/%.wasm: | $(DEST_DIR)
	curl -fL --progress-bar -o $@ "$(BASE_URL)/$*.wasm"
	wasm-opt --strip-debug --strip-producers -o $@.stripped $@
	mv $@.stripped $@

$(DEST_DIR)/swift-sysroot-core.tar: | $(DEST_DIR)
	curl -fL --progress-bar -o $@ "$(BASE_URL)/swift-sysroot-core.tar"

# SwiftWAV built for wasm32-unknown-wasip1, bundled with its .swiftmodule
# interfaces into libSwiftWAV.tar — the counterpart to swift-sysroot-core.tar
# that the in-browser compiler worker links user programs against.
libswiftwav: $(DEST_DIR)/libSwiftWAV.tar $(DEST_DIR)/libSwiftWAV.tar.gz $(DEST_DIR)/libSwiftWAV.tar.br

$(BUILD_DIR)/libSwiftWAV.a: $(SWIFT_SOURCES) Package.swift
	swift build --package-path $(CURDIR) --swift-sdk $(SWIFT_SDK) --product SwiftWAV -c $(CONFIGURATION)

$(STAGE_DIR)/libSwiftWAV.a: $(BUILD_DIR)/libSwiftWAV.a | $(STAGE_DIR)
	cp $< $@

$(STAGE_DIR)/%.swiftmodule: $(BUILD_DIR)/libSwiftWAV.a | $(STAGE_DIR)
	cp $(BUILD_DIR)/Modules/$*.swiftmodule $@

$(DEST_DIR)/libSwiftWAV.tar: $(STAGE_DIR)/libSwiftWAV.a $(addprefix $(STAGE_DIR)/,$(addsuffix .swiftmodule,$(MODULES)))
	tar -C $(STAGE_DIR) -cf $@ .

# Shared compression rules: brotli/gzip twins for anything under DEST_DIR,
# used by both the fetched toolchain artifacts and libSwiftWAV.tar.
$(DEST_DIR)/%.gz: $(DEST_DIR)/%
	gzip -9 -f -k $<

$(DEST_DIR)/%.br: $(DEST_DIR)/%
	brotli -q 11 -f -o $@ $<

$(DEST_DIR) $(STAGE_DIR):
	mkdir -p $@

clean:
	rm -rf $(DEST_DIR)
