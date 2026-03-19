import http from "node:http";
import path from "node:path";
import { URL, fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { crc32 } from "node:zlib";
import fs from "node:fs";

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const HOST = process.env.KIRO_SHIM_HOST || "127.0.0.1";
const PORT = Number(process.env.KIRO_SHIM_PORT || "8765");
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4";
const SHIM_REGION = process.env.KIRO_SHIM_REGION || "us-east-1";
const SHIM_PROFILE_ARN =
  process.env.KIRO_SHIM_PROFILE_ARN ||
  `arn:aws:codewhisperer:${SHIM_REGION}:000000000000:profile/KIROCODEXSHIM`;
const SHIM_PROFILE_NAME = process.env.KIRO_SHIM_PROFILE_NAME || "Codex Shim";
const SHIM_MODEL_ID = process.env.KIRO_SHIM_MODEL_ID || "gpt-5.4";
const SHIM_MODEL_NAME = process.env.KIRO_SHIM_MODEL_NAME || "Codex GPT-5.4";
const DEBUG_DIR = process.env.KIRO_SHIM_DEBUG_DIR || path.join(ROOT_DIR, ".debug");
const RECENT_TURN_LIMIT = 30;

const coverageState = {
  promptCount: 0,
  availableToolCount: 0,
  availableTools: [],
  observedToolCalls: {},
  observedToolResults: {},
  unresolvedToolResults: {},
  mcpCalls: {},
  recentTurns: []
};

const toolUseIndex = new Map();

function log(message, details) {
  const prefix = `[kiro-endpoint-shim ${new Date().toISOString()}]`;
  if (details === undefined) {
    console.log(`${prefix} ${message}`);
    return;
  }

  console.log(`${prefix} ${message}`, details);
}

function ensureDebugDir() {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
}

function writeDebugJson(name, payload) {
  try {
    ensureDebugDir();
    fs.writeFileSync(`${DEBUG_DIR}/${name}.json`, JSON.stringify(payload, null, 2));
  } catch (error) {
    log("failed to write debug json", error instanceof Error ? error.message : String(error));
  }
}

function incrementCounter(container, key) {
  container[key] = (container[key] || 0) + 1;
}

function normalizeToolResultStatus(status) {
  return status === "success" ? "success" : "error";
}

function persistCoverageState() {
  writeDebugJson("coverage-summary", {
    lastUpdatedAt: new Date().toISOString(),
    ...coverageState
  });
}

function recordRecentTurn(entry) {
  coverageState.recentTurns.unshift(entry);
  if (coverageState.recentTurns.length > RECENT_TURN_LIMIT) {
    coverageState.recentTurns.length = RECENT_TURN_LIMIT;
  }
}

function registerAvailableTools(tools) {
  coverageState.availableToolCount = tools.length;
  coverageState.availableTools = tools.map((tool) => tool.name);
}

function registerObservedToolCall(toolCall) {
  const toolName = toolCall.function?.name || "unknown_tool";
  incrementCounter(coverageState.observedToolCalls, toolName);
  if (toolCall.id) {
    toolUseIndex.set(toolCall.id, toolName);
  }
}

function registerObservedToolResults(toolResults) {
  for (const toolResult of toolResults || []) {
    const toolName = toolUseIndex.get(toolResult.toolUseId) || `unresolved:${toolResult.toolUseId || "unknown"}`;
    if (!toolUseIndex.get(toolResult.toolUseId)) {
      incrementCounter(coverageState.unresolvedToolResults, toolName);
    }

    if (!coverageState.observedToolResults[toolName]) {
      coverageState.observedToolResults[toolName] = {
        success: 0,
        error: 0
      };
    }

    const status = normalizeToolResultStatus(toolResult.status);
    coverageState.observedToolResults[toolName][status] += 1;
  }
}

function writeUint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0, 0);
  return buffer;
}

function encodeHeaderString(name, value) {
  const nameBytes = Buffer.from(name, "utf8");
  const valueBytes = Buffer.from(value, "utf8");
  const header = Buffer.alloc(1 + nameBytes.length + 1 + 2);

  let offset = 0;
  header.writeUInt8(nameBytes.length, offset);
  offset += 1;
  nameBytes.copy(header, offset);
  offset += nameBytes.length;
  header.writeUInt8(7, offset);
  offset += 1;
  header.writeUInt16BE(valueBytes.length, offset);

  return Buffer.concat([header, valueBytes]);
}

function encodeEventStreamMessage(eventType, payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  const headers = Buffer.concat([
    encodeHeaderString(":message-type", "event"),
    encodeHeaderString(":event-type", eventType),
    encodeHeaderString(":content-type", "application/json")
  ]);

  const totalLength = 16 + headers.length + body.length;
  const prelude = Buffer.alloc(8);
  prelude.writeUInt32BE(totalLength, 0);
  prelude.writeUInt32BE(headers.length, 4);

  const preludeCrc = writeUint32(crc32(prelude));
  const messageWithoutCrc = Buffer.concat([prelude, preludeCrc, headers, body]);
  const messageCrc = writeUint32(crc32(messageWithoutCrc));

  return Buffer.concat([messageWithoutCrc, messageCrc]);
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    "content-type": "application/json",
    ...extraHeaders
  });
  res.end(JSON.stringify(payload));
}

function pathIs(pathname, ...candidates) {
  return candidates.some((candidate) => pathname === candidate);
}

async function readJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const body = Buffer.concat(chunks).toString("utf8").trim();
  if (!body) {
    return {};
  }

  return JSON.parse(body);
}

function modelDescriptor() {
  return {
    description: "Codex bridged through a local Kiro endpoint shim",
    modelId: SHIM_MODEL_ID,
    modelName: SHIM_MODEL_NAME,
    rateMultiplier: 1,
    rateUnit: "REQUEST",
    supportedInputTypes: ["TEXT"],
    tokenLimits: {
      maxInputTokens: 400000
    }
  };
}

function profileDescriptor(overrideArn) {
  return {
    arn: overrideArn || SHIM_PROFILE_ARN,
    profileName: SHIM_PROFILE_NAME
  };
}

function normalizeTextContent(content) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (!item) {
          return "";
        }

        if (typeof item === "string") {
          return item;
        }

        if (typeof item.text === "string") {
          return item.text;
        }

        if (item.type === "text" && typeof item.text === "string") {
          return item.text;
        }

        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  return "";
}

function normalizeToolSchema(schema) {
  if (!schema || typeof schema !== "object") {
    return {
      type: "object",
      properties: {}
    };
  }

  return schema;
}

function extractToolSpecifications(conversationState) {
  const toolEntries =
    conversationState?.currentMessage?.userInputMessage?.userInputMessageContext?.tools || [];

  return toolEntries
    .map((entry) => entry?.toolSpecification || null)
    .filter((entry) => entry && typeof entry.name === "string")
    .map((entry) => ({
      name: entry.name,
      description: typeof entry.description === "string" ? entry.description : "",
      parameters: normalizeToolSchema(entry.inputSchema?.json)
    }));
}

function flattenToolResultContent(contentBlocks) {
  if (!Array.isArray(contentBlocks)) {
    return "";
  }

  return contentBlocks
    .map((block) => {
      if (!block || typeof block !== "object") {
        return "";
      }

      if (typeof block.text === "string") {
        return block.text;
      }

      if (block.json !== undefined) {
        try {
          return JSON.stringify(block.json);
        } catch {
          return String(block.json);
        }
      }

      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function convertConversationStateToChatMessages(conversationState) {
  const entries = [...(conversationState?.history || [])];
  if (conversationState?.currentMessage) {
    entries.push(conversationState.currentMessage);
  }

  const messages = [];

  for (const entry of entries) {
    if (entry?.userInputMessage) {
      const userMessage = entry.userInputMessage;
      const content = normalizeTextContent(userMessage.content);
      if (content) {
        messages.push({
          role: "user",
          content
        });
      }

      const toolResults = userMessage.userInputMessageContext?.toolResults || [];
      for (const toolResult of toolResults) {
        const toolContent = flattenToolResultContent(toolResult.content);
        messages.push({
          role: "tool",
          tool_call_id: toolResult.toolUseId || randomUUID(),
          content: toolContent || JSON.stringify(toolResult)
        });
      }
    }

    if (entry?.assistantResponseMessage) {
      const assistantMessage = entry.assistantResponseMessage;
      const content = normalizeTextContent(assistantMessage.content);
      const toolCalls = (assistantMessage.toolUses || []).map((toolUse, index) => ({
        id: toolUse.toolUseId || `tool_use_${index + 1}`,
        type: "function",
        function: {
          name: toolUse.name || "unknown_tool",
          arguments: JSON.stringify(toolUse.input || {})
        }
      }));

      if (content || toolCalls.length > 0) {
        messages.push({
          role: "assistant",
          content: content || "",
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {})
        });
      }
    }
  }

  return messages;
}

function normalizeAssistantText(content) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (!item) {
          return "";
        }

        if (typeof item === "string") {
          return item;
        }

        if (item.type === "text" && typeof item.text === "string") {
          return item.text;
        }

        if (typeof item.text === "string") {
          return item.text;
        }

        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  return "";
}

function parseToolArguments(rawArguments) {
  if (rawArguments && typeof rawArguments === "object") {
    return rawArguments;
  }

  if (typeof rawArguments !== "string" || !rawArguments.trim()) {
    return {};
  }

  try {
    return JSON.parse(rawArguments);
  } catch {
    return { __raw: rawArguments };
  }
}

function stringifyToolArguments(rawArguments) {
  if (typeof rawArguments === "string") {
    return rawArguments;
  }

  try {
    return JSON.stringify(rawArguments ?? {});
  } catch {
    return "{}";
  }
}

function normalizeSpecConfigPath(pathValue) {
  if (typeof pathValue !== "string") {
    return pathValue;
  }

  if (pathValue === ".config" || pathValue.endsWith("/.config")) {
    return `${pathValue}.kiro`;
  }

  return pathValue;
}

function normalizeToolCallArguments(toolName, args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return args;
  }

  const next = { ...args };

  if ("path" in next) {
    next.path = normalizeSpecConfigPath(next.path);
  }

  if (Array.isArray(next.paths)) {
    next.paths = next.paths.map((item) => normalizeSpecConfigPath(item));
  }

  if (toolName === "readFile" || toolName === "readMultipleFiles" || toolName === "strReplace" || toolName === "deleteFile" || toolName === "fsWrite" || toolName === "fsAppend") {
    return next;
  }

  return next;
}

function sendEventStream(res, events, requestId = randomUUID()) {
  res.writeHead(200, {
    "content-type": "application/vnd.amazon.eventstream",
    "x-amzn-requestid": requestId,
    "cache-control": "no-store"
  });

  for (const event of events) {
    res.write(encodeEventStreamMessage(event.type, event.payload));
  }

  res.end();
}

function extractConversationMessages(conversationState) {
  const rawMessages = [...(conversationState?.history || [])];
  if (conversationState?.currentMessage) {
    rawMessages.push(conversationState.currentMessage);
  }

  return rawMessages
    .map((entry) => {
      if (entry?.userInputMessage) {
        return {
          role: "user",
          content: String(entry.userInputMessage.content || "").trim()
        };
      }

      if (entry?.assistantResponseMessage) {
        return {
          role: "assistant",
          content: String(entry.assistantResponseMessage.content || "").trim()
        };
      }

      return null;
    })
    .filter((entry) => entry && entry.content);
}

function buildPrompt(conversationState) {
  const messages = extractConversationMessages(conversationState);
  if (messages.length === 0) {
    return JSON.stringify(conversationState || {}, null, 2);
  }

  return messages
    .map((message) => `${message.role.toUpperCase()}:\n${message.content}`)
    .join("\n\n");
}

async function callOpenAI(prompt) {
  if (!OPENAI_API_KEY) {
    return [
      "Codex shim is reachable.",
      "OPENAI_API_KEY is not set, so this is a local fallback response.",
      "",
      "Prompt preview:",
      prompt.slice(0, 1000)
    ].join("\n");
  }

  const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: prompt
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }

  const fallback = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string" && content.text.trim()) {
        fallback.push(content.text);
      }
    }
  }

  if (fallback.length > 0) {
    return fallback.join("\n");
  }

  return "Codex shim received an empty response from OpenAI.";
}

async function callOpenAIWithTools(messages, tools) {
  if (!OPENAI_API_KEY) {
    return {
      text: [
        "Codex shim is reachable.",
        "OPENAI_API_KEY is not set, so tool mode is returning a local fallback response."
      ].join("\n"),
      toolCalls: []
    };
  }

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      tools: tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }
      })),
      tool_choice: "auto",
      parallel_tool_calls: true
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI chat completion error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message || {};

  const result = {
    text: normalizeAssistantText(message.content),
    toolCalls: Array.isArray(message.tool_calls) ? message.tool_calls : []
  };

  writeDebugJson("last-openai-chat-response", data);
  return result;
}

async function handleMcpRequest(req, res) {
  const body = await readJsonBody(req);
  incrementCounter(coverageState.mcpCalls, body.method || "unknown");
  persistCoverageState();
  log("mcp", {
    method: body.method,
    name: body.params?.name
  });

  if (body.method === "tools/list") {
    return sendJson(res, 200, {
      jsonrpc: "2.0",
      id: body.id ?? "tools_list",
      result: {
        tools: []
      }
    });
  }

  if (body.method === "tools/call") {
    return sendJson(res, 200, {
      jsonrpc: "2.0",
      id: body.id ?? "tools_call",
      result: {
        content: [
          {
            type: "text",
            text: "Remote MCP is not implemented by this shim yet."
          }
        ],
        isError: true
      }
    });
  }

  return sendJson(res, 200, {
    jsonrpc: "2.0",
    id: body.id ?? randomUUID(),
    error: {
      code: -32601,
      message: `Unsupported MCP method: ${body.method || "unknown"}`
    }
  });
}

async function handleGenerateAssistantResponse(req, res) {
  const body = await readJsonBody(req);
  const prompt = buildPrompt(body.conversationState);
  const tools = extractToolSpecifications(body.conversationState);
  const requestId = randomUUID();
  const chatMessages = tools.length > 0 ? convertConversationStateToChatMessages(body.conversationState) : [];
  const currentToolResults =
    body.conversationState?.currentMessage?.userInputMessage?.userInputMessageContext?.toolResults || [];

  coverageState.promptCount += 1;
  registerAvailableTools(tools);
  registerObservedToolResults(currentToolResults);
  writeDebugJson("last-generateAssistantResponse-request", body);
  writeDebugJson("last-tools", tools);
  writeDebugJson("last-chat-messages", chatMessages);
  writeDebugJson("last-tool-results", currentToolResults);

  log("generateAssistantResponse", {
    model: OPENAI_MODEL,
    promptPreview: prompt.slice(0, 200),
    toolCount: tools.length,
    toolNames: tools.map((tool) => tool.name).slice(0, 20)
  });

  let text = "";
  let toolCalls = [];
  try {
    if (tools.length > 0) {
      const response = await callOpenAIWithTools(chatMessages, tools);
      text = response.text;
      toolCalls = response.toolCalls;
      toolCalls.forEach(registerObservedToolCall);
      log("openai toolCalls", toolCalls.map((toolCall) => ({
        id: toolCall.id,
        name: toolCall.function?.name,
        arguments: toolCall.function?.arguments
      })));
    } else {
      text = await callOpenAI(prompt);
    }
  } catch (error) {
    text = `Codex shim error: ${error instanceof Error ? error.message : String(error)}`;
  }

  const events = [];

  if (text) {
    events.push({
      type: "assistantResponseEvent",
      payload: {
        content: text,
        modelId: SHIM_MODEL_ID
      }
    });
  }

  for (const toolCall of toolCalls) {
    const toolName = toolCall.function?.name || "unknown_tool";
    const normalizedArguments = normalizeToolCallArguments(
      toolName,
      parseToolArguments(toolCall.function?.arguments)
    );

    if (JSON.stringify(normalizedArguments) !== JSON.stringify(parseToolArguments(toolCall.function?.arguments))) {
      log("normalized tool arguments", {
        name: toolName,
        before: toolCall.function?.arguments,
        after: normalizedArguments
      });
    }

    events.push({
      type: "toolUseEvent",
      payload: {
        toolUseId: toolCall.id || randomUUID(),
        name: toolName,
        input: stringifyToolArguments(normalizedArguments),
        stop: true
      }
    });
  }

  if (events.length === 0) {
    events.push({
      type: "assistantResponseEvent",
      payload: {
        content: "Codex shim received no text or tool calls from the model.",
        modelId: SHIM_MODEL_ID
      }
    });
  }

  recordRecentTurn({
    requestId,
    timestamp: new Date().toISOString(),
    promptPreview: prompt.slice(0, 200),
    toolCount: tools.length,
    returnedToolCalls: toolCalls.map((toolCall) => ({
      id: toolCall.id,
      name: toolCall.function?.name
    })),
    currentToolResults
  });
  persistCoverageState();
  sendEventStream(res, events, requestId);
}

const server = http.createServer(async (req, res) => {
  const method = req.method || "GET";
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || `${HOST}:${PORT}`}`);

  try {
    if (method === "GET" && requestUrl.pathname === "/health") {
      return sendJson(res, 200, {
        ok: true,
        region: SHIM_REGION,
        modelId: SHIM_MODEL_ID,
        openaiConfigured: Boolean(OPENAI_API_KEY)
      });
    }

    if (method === "GET" && pathIs(requestUrl.pathname, "/debug/coverage")) {
      return sendJson(res, 200, {
        lastUpdatedAt: new Date().toISOString(),
        ...coverageState
      });
    }

    if (method === "GET" && pathIs(requestUrl.pathname, "/debug/recent-turns")) {
      return sendJson(res, 200, {
        recentTurns: coverageState.recentTurns
      });
    }

    if (method === "GET" && pathIs(requestUrl.pathname, "/ListAvailableModels", "/listAvailableModels")) {
      return sendJson(res, 200, {
        defaultModel: modelDescriptor(),
        models: [modelDescriptor()]
      });
    }

    if ((method === "GET" || method === "POST") && pathIs(requestUrl.pathname, "/ListAvailableProfiles", "/listAvailableProfiles")) {
      return sendJson(res, 200, {
        profiles: [profileDescriptor()]
      });
    }

    if ((method === "GET" || method === "POST") && pathIs(requestUrl.pathname, "/GetProfile", "/getProfile")) {
      const body = await readJsonBody(req);
      return sendJson(res, 200, profileDescriptor(body.profileArn));
    }

    if ((method === "GET" || method === "POST") && pathIs(requestUrl.pathname, "/GetUsageLimits", "/getUsageLimits")) {
      return sendJson(res, 200, {
        daysUntilReset: 30,
        subscriptionInfo: {
          subscriptionTitle: "Codex Shim"
        },
        userInfo: {
          userId: "kiro-endpoint-shim"
        },
        usageBreakdownList: []
      });
    }

    if (method === "POST" && pathIs(requestUrl.pathname, "/mcp")) {
      return await handleMcpRequest(req, res);
    }

    if (method === "POST" && pathIs(requestUrl.pathname, "/generateAssistantResponse")) {
      return await handleGenerateAssistantResponse(req, res);
    }

    log("unhandled request", { method, path: requestUrl.pathname });
    return sendJson(res, 404, {
      message: `Unhandled route: ${method} ${requestUrl.pathname}`
    });
  } catch (error) {
    log("request failed", error instanceof Error ? error.stack || error.message : String(error));
    return sendJson(res, 500, {
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

server.listen(PORT, HOST, () => {
  log(`listening on http://${HOST}:${PORT}`);
  log("configure Kiro with codewhisperer.config.endpoints", [
    {
      region: SHIM_REGION,
      endpoint: `http://${HOST}:${PORT}`
    }
  ]);
});
