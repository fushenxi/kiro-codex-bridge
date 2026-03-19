# Kiro Codex Bridge

OpenAI/Codex bridge for Kiro using `codewhisperer.config.endpoints`.

It sits between Kiro and an OpenAI-compatible API, translates Kiro's AWS-style chat/tool protocol, and lets Kiro continue using its own:

1. hooks
2. specs
3. task execution
4. tool UIs
5. MCP toolchain

## What It Does

1. Overrides Kiro's model list with a local bridge model
2. Forwards normal chat turns to an OpenAI-compatible backend
3. Converts OpenAI tool calls back into Kiro `toolUseEvent`s
4. Preserves Kiro-native workflows like file tools, bash tools, background process tools, specs, and task execution

## Quick Start

1. Clone this repo
2. Copy `.env.example` to `.env` or export the env vars in your shell
3. Apply the Kiro settings patch
4. Start the bridge
5. Restart Kiro

```bash
cd kiro-endpoint-shim
npm run setup -- --endpoint http://127.0.0.1:8765 --model gpt-5.4
OPENAI_API_KEY=your_key_here OPENAI_MODEL=gpt-5.4 npm start
```

## Run In Background

```bash
cd kiro-endpoint-shim
OPENAI_API_KEY=your_key_here OPENAI_MODEL=gpt-5.4 npm run start:bg
```

Stop it with:

```bash
npm run stop:bg
```

## Update Flow

Once the repo is a git checkout:

```bash
npm run update
```

That will:

1. stop the local bridge if it is running
2. `git pull --ff-only`
3. restart the bridge if it was already running

## Kiro Settings

You can patch Kiro automatically with:

```bash
npm run setup -- --endpoint http://127.0.0.1:8765 --model gpt-5.4
```

Or set it manually:

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

## Verify

```bash
curl -s http://127.0.0.1:8765/health
curl -s http://127.0.0.1:8765/debug/coverage
curl -s http://127.0.0.1:8765/debug/recent-turns
```

You can also run:

```bash
npm run doctor
```

## Implemented Endpoints

1. `GET /health`
2. `GET /debug/coverage`
3. `GET /debug/recent-turns`
4. `GET /ListAvailableModels`
5. `POST /ListAvailableProfiles`
6. `POST /GetProfile`
7. `GET|POST /getUsageLimits` / `GetUsageLimits`
8. `POST /mcp`
9. `POST /generateAssistantResponse`

## Debug Artifacts

The shim writes the latest request/response snapshots under:

```bash
.debug/
```

Important files:

1. `coverage-summary.json`
2. `last-generateAssistantResponse-request.json`
3. `last-tools.json`
4. `last-chat-messages.json`
5. `last-tool-results.json`
6. `last-openai-chat-response.json`

## Tested Capabilities

1. File create/read
2. Single command execution
3. Background process start/read/stop
4. `listProcesses`
5. `readMultipleFiles`
6. `grepSearch`
7. Specs generation
8. Specs task execution
9. Kiro hooks compatibility
10. Kiro trusted command flows
11. MCP Playwright basics

## Known Limits

1. Kiro updates can change internal tool schemas, so keep a regression checklist
2. Remote MCP support is still minimal compatibility, not a full remote MCP bridge
3. This project assumes an OpenAI-compatible backend
