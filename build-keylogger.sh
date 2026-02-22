#!/bin/sh

BUILD_COMMAND="swift build -c release --package-path src/native/MacKeyServer"
BUILD_COMMAND_SQL="swift build -c release --package-path src/native/MacKeyServerSql"

mkdir -p bin
$BUILD_COMMAND && cp $($BUILD_COMMAND --show-bin-path)/MacKeyServer ./bin/ && $BUILD_COMMAND_SQL && cp $($BUILD_COMMAND_SQL --show-bin-path)/MacKeyServerSql ./bin/
