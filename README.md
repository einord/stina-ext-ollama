# Ollama AI Provider for Stina

Connect [Stina](https://github.com/einord/stina) to your local [Ollama](https://ollama.ai) instance for private, offline AI conversations.

## Features

- **Local AI**: Run AI models entirely on your machine
- **Privacy**: Your conversations never leave your computer
- **Model Selection**: Use any model available in your Ollama installation

## Requirements

- [Ollama](https://ollama.ai) installed and running
- At least one model pulled (e.g., `ollama pull llama3.2`)

## Installation

### From Stina Extension Browser

1. Open Stina
2. Go to Extensions
3. Search for "Ollama"
4. Click Install

### Manual Installation

1. Download the latest release from [Releases](https://github.com/einord/stina-ext-ollama/releases)
2. Install the extension in Stina
3. Restart Stina if needed

## Configuration

After installation, configure the extension in Stina's settings:

| Setting | Default | Description |
|---------|---------|-------------|
| **Ollama URL** | `http://localhost:11434` | URL to your Ollama server |
| **Default Model** | `llama3.2:8b` | Model to use when none is specified |

## Permissions

This extension requires the following permissions:

- `network:*` - Connect to your Ollama server
- `provider.register` - Register as an AI provider

## Development

### Prerequisites

- Node.js 20+
- pnpm

### Setup

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Watch mode (rebuild on changes)
pnpm dev

# Type check
pnpm typecheck

# Create release package (local testing)
pnpm pack-extension
```

### Project Structure

```
src/
├── index.ts      # Extension entry point and activation
├── provider.ts   # Ollama AI provider implementation
├── types.ts      # Ollama API type definitions
└── constants.ts  # Configuration constants
```

### Creating a Release

Releases are created automatically when changes to `manifest.json` are pushed to the `main` branch. To create a new release:

1. Update the version in `manifest.json`
2. Update `CHANGELOG.md` with release notes
3. Create a PR to `main`
4. Once merged, GitHub Actions will automatically create the release

### Manual Release (for testing)

```bash
pnpm build
pnpm pack-extension
# Output: releases/ollama-provider-x.x.x.zip
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT
