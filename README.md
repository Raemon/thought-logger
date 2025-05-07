# Memory assistant app

This is an Electron app that regularly takes screenshot and keylog data, and makes it accessible via a local web server.

```
yarn make
codesign --deep --force --verbose --sign - out/make/zip/darwin/arm64/thought-logger.app
```



```yarn start```




# Building, Signing, and Distributing `thought-logger`

This document provides instructions for building, signing, and distributing the `thought-logger` Electron app both locally and for wider distribution.

---

## Local Build and Testing

### Build Locally
1. Ensure you have all dependencies installed:
   ```bash
   yarn install
   ```
2. Generate distributables:
   ```bash
   yarn run make
   ```
3. Check the output folder for artifacts:
   ```bash
   ls out/make
   ```

### Sign Locally
For macOS, if you wish to run the app locally without signing:
1. If absent, create the app by double-clicking the `.zip` file to give a `.app` file in the output folder.

To sign locally:
1. Use the `codesign` utility:
   ```bash
   codesign --deep --force --verbose --sign - out/make/zip/darwin/arm64/thought-logger.app
   ```

### Run Locally
After signing:
- Move the `.app` file into the Applications folder
- Double-click the `.app` file to launch the application.
- Permissions can be set in System Settings > Privacy & Security for
   - Screen Recording
   - Accessibility (Key Logging)
- Quit thought-logger with ⌘-q and Reopen for full functionality.
- Capture Thoughts. 🧠🥅 
---

## Wide Distribution

Documentation Note: The following steps are untested.

### Prepare for Distribution
1. Ensure your macOS developer tools are installed and configured:
   ```bash
   xcode-select --install
   ```
   Ensure your Apple Developer ID is configured.

2. Build the app with `yarn run make`, ensuring the `forge.config.ts` includes:
   ```javascript
   electronPackagerConfig: {
     platform: "darwin",
     arch: "arm64",
   }
   ```

### Code Signing
Sign the app using your Apple Developer ID:
```bash
codesign --deep --force --verbose \
  --sign "Developer ID Application: Your Name (TEAM_ID)" \
  /path/to/thought-logger.app
```

### Notarize the App
1. Archive the app into a `.zip` file:
   ```bash
   ditto -c -k --sequesterRsrc --keepParent /path/to/thought-logger.app thought-logger.zip
   ```
2. Submit the `.zip` file for notarization:
   ```bash
   xcrun altool --notarize-app \
     --primary-bundle-id "com.electron.thought-logger" \
     --username "your-apple-id" \
     --password "app-specific-password" \
     --file thought-logger.zip
   ```
3. Once notarization is complete, staple the ticket:
   ```bash
   xcrun stapler staple /path/to/thought-logger.app
   ```

### Distribute
- Share the notarized `.zip` file or wrap it in a `.dmg` for cleaner distribution.
- Use `electron-builder` to create a `.dmg` if required:
  ```bash
  yarn add electron-builder
  yarn run electron-builder --mac --x64 --arm64
  ```

---

## Common Issues

### Gatekeeper Blocking Unsigned Apps
If the app is unsigned, macOS may block it from running. Use:
```bash
sudo spctl --master-disable
```
for testing unsigned apps locally.

### Signing Errors
Ensure your Developer ID is correctly installed. Check with:
```bash
security find-identity -v -p codesigning
```

### Debugging Notarization
Use this command to check notarization logs:
```bash
xcrun altool --notarization-info <REQUEST_UUID> --username "your-apple-id" --password "app-specific-password"
```

# Use `thought-logger` with Claude Desktop

1. Start ThoughtLogger to start the MCP server.
2. Create Claude's configuration file if it does not exist.
   On OSX: `~/Library/Application Support/Claude/claude_desktop_config.json`
   On Windows: `%APPDATA%\Claude\claude_desktop_config.json`
3. Replace the file's contents with this:
   ```json
   {
     "mcpServers": {
       "remote": {
         "command": "npx",
         "args": [
           "-y",
           "mcp-remote",
           "http://localhost:8765/mcp"
         ]
       }
     }
   }
   ```
4. If Claude Desktop is running, restart it.
5. You should see a hammer icon in the bottom right corner of the input box. Click it to verify that the `keylogs` command appears.
6. Ask Claude about your keylogs!
