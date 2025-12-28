# Ollama AI Provider for Stina

Connect [Stina](https://github.com/einord/stina) to your local [Ollama](https://ollama.ai) instance for private, offline AI conversations.

## Features

- **Local AI**: Run AI models entirely on your machine
- **Privacy**: Your conversations never leave your computer
- **Model Selection**: Use any model available in your Ollama installation
- **Streaming**: Real-time streaming responses

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
2. Extract to `~/.stina/extensions/ollama-provider/`
3. Restart Stina

## Configuration

After installation, configure the extension in Stina's settings:

| Setting | Default | Description |
|---------|---------|-------------|
| **Ollama URL** | `http://localhost:11434` | URL to your Ollama server |
| **Default Model** | `llama3.2` | Model to use when none is specified |

## Permissions

This extension requires the following permissions:

- `network:localhost` - Connect to your local Ollama server
- `settings.register` - Store your configuration
- `provider.register` - Register as an AI provider

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Watch mode
pnpm dev

# Type check
pnpm typecheck
```

## License

MIT
