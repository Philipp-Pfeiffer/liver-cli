#!/bin/bash
set -e

echo "Rebuilding ethanol-rs WASM..."

# Clone ethanol-rs if not present
if [ ! -d "vendor/ethanol-rs/src" ]; then
  echo "Please clone ethanol-rs into vendor/ethanol-rs/"
  exit 1
fi

cd vendor/ethanol-rs
wasm-pack build --target nodejs --release --features wasm

echo "WASM rebuild complete. Commit the pkg/ directory."