# Kiro Shim Test Matrix

## Goal

Track what is already proven, what still needs verification, and what is still risky in the `Kiro -> shim -> Codex -> Kiro tools` chain.

## Confirmed Working

1. Model list override via `codewhisperer.config.endpoints`
2. `fsWrite` file creation
3. `readFile` file readback
4. `executeBash` one-shot command execution
5. `controlBashProcess` short-lived background process start
6. `getProcessOutput` reads background process output
7. `controlBashProcess` stop for a short-lived process
8. `listProcesses`
9. `readMultipleFiles`
10. `grepSearch`
11. Kiro hooks still execute while using the shimmed model

## High Priority Next Tests

1. Specs workflow: `requirements.md / design.md / tasks.md`
Prompt:
```text
请为一个简单的测试功能创建新的 spec，只生成 requirements、design、tasks，不要直接实现。
```
Checks:
- `.kiro/specs/<feature>/` 是否完整创建
- `requirements.md`、`design.md`、`tasks.md` 是否都生成
- 内容是否仍保持 Kiro 原生 spec 风格，而不是退化成普通聊天输出

2. Specs task execution
Action:
- 进入生成出的 `tasks.md`
- 点击 Kiro 的执行入口，让它自动执行一个安全的小任务
Checks:
- 是否真的按 task 执行，不是单纯聊天回答
- `taskStatus` 是否参与
- 执行后状态和文件变更是否回流到 Kiro UI

3. `trustedCommands` auto-approval experience
Prompt:
```text
请直接调用工具执行 `python3 -c "print(123)"`，并返回结果。不要给我命令文本。
```
Checks:
- 是否减少手动批准
- hooks 是否仍然照常运行
- 自动通过和 hook 拦截是否能共存

4. MCP browser / Playwright toolchain
Prompt:
```text
请直接调用浏览器工具打开 https://example.com ，读取页面标题和可见正文摘要。
```
Checks:
- 是否真的走 `mcp_playwright_*`
- 是否能导航、读取可见文本、截图
- 是否保留 Kiro 原生浏览器工具体验

5. `fileSearch`
Prompt:
```text
请直接调用搜索工具在当前工作区查找文件名包含 "docker" 的文件，并返回结果。
```

6. `strReplace`
Prompt:
```text
请在当前工作区创建一个测试文件，然后直接调用编辑工具把其中某个词替换掉，再把最终内容返回给我。
```

## Medium Priority Tests

1. `deleteFile`
Use only disposable test files

2. `fsAppend`
Create a small file, append another line, then read back

3. `listDirectory`
Ask for directory structure without using shell output

4. `readFile` with explanation-sensitive schema
Verify the model supplies required `explanation`

5. Multi-step chain
Create file -> append -> read -> grep -> summarize

6. `webFetch`
Public URL fetch without Playwright

7. `taskStatus`
Observe whether it is used automatically during spec task execution

## High Risk / Still Unknown

1. Long-running background process lifecycle beyond simple start
2. Reusing existing process handles across turns
3. Advanced Kiro-specific interaction components
4. Remote MCP behavior beyond minimal compatibility stubs
5. Complex multi-tool parallel behavior
6. Rich diff/checkpoint flows across several file edits in one turn
7. Full Specs flow with "click task and auto-execute" behavior
8. Browser automation end-to-end stability
9. Approval model interactions when `trustedCommands` and hooks both apply

## Useful Local Checks

```bash
curl -s http://127.0.0.1:8765/health | jq
curl -s http://127.0.0.1:8765/debug/coverage | jq
curl -s http://127.0.0.1:8765/debug/recent-turns | jq
```

## Current Read on Project Status

1. The shim is past PoC and has entered practical testing territory.
2. Core command, search, and file tool routing is working.
3. Background process lifecycle for short-lived processes is working.
4. The next completeness frontier is Specs workflow, approval behavior, and MCP browser tooling.
