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

## Verified Kiro Version

This bridge is currently verified against the following Kiro build:

- Kiro version: `0.11.34`
- VS Code core: `1.107.1`
- Commit: `7b506f30719296ba4f1aebfe383b426ffce0913e`
- Build date: `2026-03-12T22:08:23.020Z`
- Electron: `39.6.0`
- Chromium: `142.0.7444.265`
- Node.js: `22.22.0`
- OS tested: `Darwin arm64 25.2.0`

It may work on nearby Kiro versions, but only the version above has been explicitly validated.

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

If Kiro was just updated and you want to re-apply bridge settings while recording the currently installed Kiro version, run:

```bash
npm run adapt:kiro -- --endpoint http://127.0.0.1:8765 --model gpt-5.4
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

## Docker Deployment

If you prefer to run the bridge in Docker instead of a local Node process:

```bash
cp .env.example .env
docker compose up -d --build
```

Or with npm shortcuts:

```bash
npm run docker:up
```

View logs:

```bash
npm run docker:logs
```

Stop it:

```bash
npm run docker:down
```

Important:

1. Kiro still runs on the host machine
2. The bridge runs inside Docker
3. Kiro should still point to `http://127.0.0.1:8765`
4. You still need to apply Kiro settings on the host using `npm run setup` or manual settings edits

## Update Flow

After cloning from GitHub, you can update with:

```bash
npm run update
```

This will:

1. stop the local bridge if it is running
2. pull the latest code with `git pull --ff-only`
3. restart the bridge if it was already running

If Kiro itself was updated, run `adapt:kiro` after the update and then execute the regression checklist.

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

Kiro adaptation report:

```bash
npm run adapt:kiro -- --endpoint http://127.0.0.1:8765 --model gpt-5.4
```

This writes a local report to:

```bash
.runtime/kiro-adaptation-report.json
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
- Docker runs the bridge service only; it does not containerize the Kiro desktop app itself

## Kiro Update Notes

Treat every Kiro update as a compatibility event.

Recommended update workflow:

1. Back up your working Kiro app and user settings
2. Keep the bridge repo and `.env` unchanged
3. Update Kiro
4. Start the bridge
5. Run a short regression checklist before daily use

Recommended regression checklist:

1. file create + read
2. `pwd`
3. short background process `start -> read -> stop`
4. one MCP browser action
5. one spec generation
6. one `tasks.md` execution

If any of those fail after a Kiro update, assume the internal tool protocol changed and re-verify before continuing normal use.

## Safety Notes

- Do not commit your `.env`
- Do not hardcode API keys into the source
- Re-run your regression checklist after every Kiro update

## Related Files

- [Chinese README](./README.zh-CN.md)
- [Test Matrix](./TEST_MATRIX.md)
