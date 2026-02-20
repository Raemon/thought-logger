#!/bin/bash

set -e

# Warning and confirmation
RED='\033[0;31m'
BOLD='\033[1m'
RESET='\033[0m'

echo ""
echo -e "${RED}${BOLD}⚠️  WARNING: This will DELETE ALL your ThoughtLogger data!  ⚠️${RESET}"
echo ""
echo "This script will remove:"
echo "  - All keylogs"
echo "  - All screenshots"
echo "  - All summaries"
echo "  - Your encryption password"
echo ""
echo -e "${RED}${BOLD}This action cannot be undone!${RESET}"
echo ""
read -p 'Type "blow away my data" to continue: ' confirmation

if [ "$confirmation" != "blow away my data" ]; then
	echo "Aborted."
	exit 1
fi

TARGET_DIR=~/Library/Application\ Support/thought-logger/files
TEMPLATES_DIR=sample_data/templates

# Delete existing password and files
security delete-generic-password -s "ThoughtLogger" -a "Log file encryption" 2>/dev/null || true
rm -rf "$TARGET_DIR"/*

# Create keylogs directory
mkdir -p "$TARGET_DIR/keylogs"

# Generate keylogs for the last 14 days
for i in $(seq 0 13); do
	DATE=$(date -v-${i}d +"%Y-%m-%d")
	YEAR_MONTH=$(date -v-${i}d +"%Y-%m")

	# Create month directory
	mkdir -p "$TARGET_DIR/keylogs/$YEAR_MONTH"

	# Alternate between day1 and day2 templates
	if [ $((i % 2)) -eq 0 ]; then
		TEMPLATE="day1"
	else
		TEMPLATE="day2"
	fi

	# Process each template file for this day
	for template_file in $TEMPLATES_DIR/keylog_${TEMPLATE}*.log; do
		if [ -f "$template_file" ]; then
			# Extract the suffix (e.g., ".processed.by-app.log" or just ".log")
			filename=$(basename "$template_file")
			suffix="${filename#keylog_${TEMPLATE}}"

			# Replace {{DATE}} with actual date and write to target
			output_file="$TARGET_DIR/keylogs/$YEAR_MONTH/${DATE}${suffix}"
			sed "s/{{DATE}}/$DATE/g" "$template_file" >"$output_file"
		fi
	done
done

echo "Test data reset complete. Generated keylogs for the last 14 days."
