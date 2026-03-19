[English](./README.md) | [简体中文](./README.zh-CN.md)

# Kiro Codex Bridge

Bridge OpenAI/Codex into Kiro through `codewhisperer.config.endpoints` while keeping as much of Kiro's native workflow as possible.

This project translates between:

- Kiro's AWS-style model and tool protocol
- OpenAI-compatible chat/tool APIs
- Kiro-native workflows such as hooks, specs, task execution, file tools, bash tools, and background process tools

## What Works

- Model list override in Kiro
- File create/read flows
- Single command execution
- Short-lived background process start/read/stop
- Process listing
- Multi-file reads
- Workspace search
- Specs generation
- Specs task execution
- Kiro hooks compatibility
- Trusted command flows
- Basic MCP Playwright flows

## How It Works

1. Kiro sends model discovery and chat requests to this local bridge.
2. The bridge exposes a custom model through `/ListAvailableModels`.
3. Tool definitions from Kiro are translated into OpenAI-style tool calls.
4. Tool calls from the model are translated back into Kiro `toolUseEvent`s.
5. Kiro still executes its own tools, hooks, and task workflows locally.

## Quick Start

```bash
git clone <your-fork-or-repo-url>
cd kiro-codex-bridge
cp .env.example .env
```

Set at least:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.4
```

Then patch Kiro settings:

```bash
npm run setup -- --endpoint http://127.0.0.1:8765 --model gpt-5.4
```

Start the bridge:

```bash
npm start
```

Restart Kiro after the bridge is running.

## Run In Background

```bash
npm run start:bg
```

Stop it with:

```bash
npm run stop:bg
```

## Update Flow

After cloning from GitHub, you can update with:

```bash
npm run update
```

This will:

1. stop the local bridge if it is running
2. pull the latest code with `git pull --ff-only`
3. restart the bridge if it was already running

## Kiro Settings

The setup script writes the equivalent of:

```json
{
  "codewhisperer.config.endpoints": [
    {
      "region": "us-east-1",
      "endpoint": "http://127.0.0.1:8765"
    }
  ],
  "kiroAgent.modelSelection": "gpt-5.4"
}
```

## Diagnostics

Health check:

```bash
curl -s http://127.0.0.1:8765/health
```

Coverage summary:

```bash
curl -s http://127.0.0.1:8765/debug/coverage
```

Recent turns:

```bash
curl -s http://127.0.0.1:8765/debug/recent-turns
```

Local environment doctor:

```bash
npm run doctor
```

## Debug Artifacts

The bridge writes debug snapshots into:

```bash
.debug/
```

Important files:

- `coverage-summary.json`
- `last-generateAssistantResponse-request.json`
- `last-tools.json`
- `last-chat-messages.json`
- `last-tool-results.json`
- `last-openai-chat-response.json`

## Implemented Endpoints

- `GET /health`
- `GET /debug/coverage`
- `GET /debug/recent-turns`
- `GET /ListAvailableModels`
- `POST /ListAvailableProfiles`
- `POST /GetProfile`
- `GET|POST /getUsageLimits` and `GetUsageLimits`
- `POST /mcp`
- `POST /generateAssistantResponse`

## Limitations

- Kiro updates may change internal tool schemas or workflow behavior
- Remote MCP support is still minimal compatibility, not a full remote MCP bridge
- This project assumes an OpenAI-compatible backend
- The bridge must be running locally while Kiro is configured to use it

## Safety Notes

- Do not commit your `.env`
- Do not hardcode API keys into the source
- Re-run your regression checklist after every Kiro update

## Related Files

- [Chinese README](./README.zh-CN.md)
- [Test Matrix](./TEST_MATRIX.md)

