#!/bin/sh

LAST_QUESTION=""
PROJECT_ROOT=$(git rev-parse --show-toplevel)
HTTP_PORT=8765
PREFS_FILE="$HOME/Library/Application Support/thought-logger/preferences.json"

if [ ! -n "$PROJECT_ROOT" ]; then
    echo "QA script must be run from within Thought Logger project directory."
    exit 1
fi

fail () {
    printf "\e[31m"
    if [ -n "$1" ]; then
        echo "$1"
    else
        IFS=' ' set -- $LAST_QUESTION
        noun=$1
        shift
        printf "The %s %s be %s. Fix it before pushing.\n" "$noun" "$SHOULD_HAVE" "$*";
    fi
    printf "\e[0m"
    exit 1
}

is_the () {
    LAST_QUESTION="$@"
    SHOULD_HAVE=
    printf "Is the %s? (y/n): " "$*"
    read answer
    case "$answer" in
        [Yy]*)
            SHOULD_HAVE="shouldn't"
            return
            ;;
        [Nn]*)
            SHOULD_HAVE="should"
            return 1
            ;;
        * )
            echo "Please answer yes or no."
            is_the $@
            ;;
    esac
}

yarn run typecheck || fail "Fix type errors"
yarn run lint || fail "Fix lint errors"
yarn run test || fail "Fix test failures"

osascript -e "tell app \"Terminal\" to do script \"cd $PROJECT_ROOT;yarn run start\""
is_the shell showing errors && fail

open http://localhost:$HTTP_PORT/yesterday
is_the browser showing yesterday\'s keylogs || fail

open http://localhost:$HTTP_PORT/today
echo "Type something and refresh the browser."
is_the browser showing today\'s keylogs || fail

echo "Open the settings tab."
echo "Modify each setting."
is_the UI reflecting your setting changes || fail

cp "$PREFS_FILE" "/tmp/prefs.json"
osascript -e "tell app \"Terminal\" to do script \"echo $PREFS_FILE | entr -c diff /_ /tmp/prefs.json\""
is_the diff reflecting your setting changes || fail
