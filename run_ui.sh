#!/usr/bin/env bash

set -eux

socat TCP-LISTEN:9222,fork,reuseaddr TCP:host.docker.internal:9222 &

exec npm start


