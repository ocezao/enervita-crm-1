#!/bin/sh
set -e
export MIMO_API_KEY=
exec node --import tsx src/server.ts
