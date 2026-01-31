#!/bin/sh

BUILD_COMMAND="swift build -c release --package-path src/native/MacKeyServer"

mkdir -p bin
$BUILD_COMMAND && cp $($BUILD_COMMAND --show-bin-path)/MacKeyServer ./bin/
