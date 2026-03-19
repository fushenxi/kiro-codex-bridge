[English](./README.md) | [简体中文](./README.zh-CN.md)

# Kiro Codex Bridge

通过 `codewhisperer.config.endpoints` 把 OpenAI/Codex 接入 Kiro，同时尽量保留 Kiro 原生的工作流能力。

这个项目主要负责在三层之间做协议转换：

- Kiro 的 AWS 风格模型与工具协议
- OpenAI 兼容的聊天与工具调用接口
- Kiro 原生的 Hooks、Specs、任务执行、文件工具、命令工具和后台进程工具

## 当前已验证能力

- Kiro 模型列表替换
- 文件创建与读取
- 单次命令执行
- 短期后台进程启动、读取输出、停止
- 后台进程列表
- 多文件读取
- 工作区搜索
- Specs 生成
- Specs 任务执行
- Kiro Hooks 兼容
- `trustedCommands` 场景
- 基础 MCP Playwright 场景

## 工作原理

1. Kiro 把模型发现和聊天请求发给本地 bridge。
2. bridge 通过 `/ListAvailableModels` 暴露一个自定义模型。
3. Kiro 传来的工具定义会被转换成 OpenAI 风格的 tools。
4. 模型返回的 tool calls 会再被转换回 Kiro 的 `toolUseEvent`。
5. 真正的工具执行、Hooks、Tasks、Specs 仍由 Kiro 自己在本地完成。

## 快速开始

```bash
git clone <你的仓库地址>
cd kiro-codex-bridge
cp .env.example .env
```

至少要配置：

```bash
OPENAI_API_KEY=你的密钥
OPENAI_MODEL=gpt-5.4
```

然后写入 Kiro 配置：

```bash
npm run setup -- --endpoint http://127.0.0.1:8765 --model gpt-5.4
```

启动 bridge：

```bash
npm start
```

bridge 启动后，重启 Kiro。

## 后台运行

```bash
npm run start:bg
```

停止：

```bash
npm run stop:bg
```

## 更新方式

从 GitHub 拉取后，可以直接执行：

```bash
npm run update
```

它会自动：

1. 停掉当前本地 bridge
2. 执行 `git pull --ff-only`
3. 如果之前在运行，则自动重新启动

## Kiro 配置效果

`setup` 脚本会向 Kiro 写入等价配置：

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

## 诊断方式

健康检查：

```bash
curl -s http://127.0.0.1:8765/health
```

覆盖统计：

```bash
curl -s http://127.0.0.1:8765/debug/coverage
```

最近回合：

```bash
curl -s http://127.0.0.1:8765/debug/recent-turns
```

本地环境自检：

```bash
npm run doctor
```

## 调试文件

bridge 会把调试快照写到：

```bash
.debug/
```

重点文件：

- `coverage-summary.json`
- `last-generateAssistantResponse-request.json`
- `last-tools.json`
- `last-chat-messages.json`
- `last-tool-results.json`
- `last-openai-chat-response.json`

## 已实现接口

- `GET /health`
- `GET /debug/coverage`
- `GET /debug/recent-turns`
- `GET /ListAvailableModels`
- `POST /ListAvailableProfiles`
- `POST /GetProfile`
- `GET|POST /getUsageLimits` 和 `GetUsageLimits`
- `POST /mcp`
- `POST /generateAssistantResponse`

## 当前限制

- Kiro 更新后，内部工具 schema 或工作流行为可能变化
- 远程 MCP 目前还是最小兼容层，不是完整 remote MCP bridge
- 当前默认假设后端是 OpenAI 兼容接口
- 只要 Kiro 还指向这个 bridge，本地 `server.mjs` 就必须保持运行

## 安全提醒

- 不要提交 `.env`
- 不要把 API key 硬编码进源码
- 每次 Kiro 更新后都建议重新跑一遍回归测试

## 相关文件

- [English README](./README.md)
- [测试矩阵](./TEST_MATRIX.md)

