# Thought Logger

An Electron application that captures keystrokes and screenshots, making them accessible through a local web server and MCP (Model Context Protocol) interface.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Development](#development)
- [Testing](#testing)
- [Building and Distribution](#building-and-distribution)
- [Configuration](#configuration)
- [Integration with Claude Desktop](#integration-with-claude-desktop)
- [Contributing](#contributing)

## Features

- **Keystroke logging**: Capture and store keyboard input
- **Screenshot capture**: Automatically take screenshots at configurable intervals
- **Local web server**: Access captured data through a web interface
- **MCP server integration**: Connect with AI assistants like Claude Desktop
- **Encryption support**: Secure sensitive data with encryption

## Tech Stack

### Core Framework
- **Electron**: Cross-platform desktop application framework
- **React 19**: User interface library
- **TypeScript**: Type-safe JavaScript development

### Build and Development Tools
- **Vite**: Fast build tool and development server
- **Electron Forge**: Application packaging and distribution
- **Tailwind CSS**: Utility-first CSS framework
- **ESLint**: Code linting and formatting
- **Vitest**: Testing framework with browser support

### Native Components
- **Swift**: Native macOS keylogger implementation
- **Node.js native modules**: keytar for secure credential storage

### Key Dependencies
- **Model Context Protocol SDK**: For AI assistant integration
- **Winston**: Logging framework
- **Zod**: Runtime type validation
- **Date-fns**: Date manipulation utilities

## Project Structure

```
thought-logger/
├── src/
│   ├── electron/          # Main Electron process modules
│   │   ├── server.ts      # Local web server
│   │   ├── screenshots.ts # Screenshot capture logic
│   │   ├── credentials.ts # Credential management
│   │   └── paths.ts       # File path utilities
│   ├── frontend/          # React UI components
│   │   ├── app.tsx        # Main application component
│   │   └── *Settings.tsx  # Various settings panels
│   ├── native/            # Native code
│   │   └── MacKeyServer/  # Swift keylogger for macOS
│   ├── types/             # TypeScript type definitions
│   ├── main.ts            # Electron main process
│   ├── preload.ts         # Preload script
│   └── renderer.tsx       # Renderer process
├── tests/                 # Test files
├── out/                   # Build output
└── forge.config.ts        # Electron Forge configuration
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Swift compiler (for building native keylogger)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd thought-logger

# Install dependencies
yarn install

# Build native components
yarn prepBuild
```

## Permissions (macOS)

The app requires the following permissions:
- Screen Recording (for screenshots)
- Accessibility (for keystroke logging)

Set permissions in: `System Settings > Privacy & Security`

## Development

### Running the Application

```bash
# Start development mode
yarn start
```

### Code Quality

```bash
# Run linting
yarn lint

# Run type checking
yarn typecheck
```

## Testing

The project uses Vitest for both main process and renderer process testing.

### Running Tests

```bash
# Run all tests
yarn test

# Run main process tests only
yarn test:main

# Run renderer process tests only
yarn test:renderer
```

### Test Structure

- `tests/main/`: Tests for Electron main process modules
- `tests/renderer/`: Tests for React components and renderer process
- `tests/setup.ts`: Shared test configuration

## Building and Distribution

### Local Build

```bash
# Build the application
yarn make

# Package without creating distributables
yarn package
```

### Platform-Specific Builds

Electron Forge automatically creates platform-specific distributables:
- macOS: `.app` in ZIP archive
- Windows: `.exe` installer
- Linux: `.deb` and `.rpm` packages

### Code Signing (macOS)

For local testing without signing:
```bash
# Ad-hoc signing for local use
codesign --deep --force --verbose --sign - out/make/zip/darwin/arm64/thought-logger.app
```

For distribution with Developer ID:
```bash
# Sign with Developer ID
codesign --deep --force --verbose \
  --sign "Developer ID Application: Your Name (TEAM_ID)" \
  /path/to/thought-logger.app
```

### Notarization (macOS)

1. Archive the app:
```bash
ditto -c -k --sequesterRsrc --keepParent /path/to/thought-logger.app thought-logger.zip
```

2. Submit for notarization:
```bash
xcrun altool --notarize-app \
  --primary-bundle-id "com.electron.thought-logger" \
  --username "your-apple-id" \
  --password "app-specific-password" \
  --file thought-logger.zip
```

3. Staple the notarization ticket:
```bash
xcrun stapler staple /path/to/thought-logger.app
```

## Integration with Claude Desktop

Thought Logger provides an MCP server interface for integration with AI assistants.

### Setup

1. Start Thought Logger to activate the MCP server
2. Create/modify Claude Desktop config file:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

3. Add MCP server configuration:
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

4. Restart Claude Desktop
5. Look for the hammer icon in the input area
6. Use the `keylogs` command to query your activity data

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite: `yarn test`
6. Run linting: `yarn lint`
7. Run type checking: `yarn typecheck`
8. Submit a pull request
