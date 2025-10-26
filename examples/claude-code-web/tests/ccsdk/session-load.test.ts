import path from "node:path";
import { fileURLToPath } from "node:url";
import { strict as assert } from "node:assert";

import { Session } from "../../src/ccsdk/session";
import { ClaudeAgentSDKClient } from "../../src/ccsdk/cas-client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixtureHome = path.resolve(__dirname, "../fixtures", "home");
const sessionId = "test-session";

const previousHome = process.env.HOME;
process.env.HOME = fixtureHome;

try {
  const client = new ClaudeAgentSDKClient();
  const { messages: sdkMessages } = await client.getSession(sessionId);

  assert.equal(sdkMessages.length, 2, "should load two SDK messages");
  assert.equal(sdkMessages[0].type, "user", "first message should retain its type");
  assert.equal(
    (sdkMessages[0] as { session_id?: string }).session_id,
    "fixture-session",
    "session_id should be normalized from sessionId"
  );

  const session = new Session(client);
  await session.loadFromServer(sessionId);

  assert.equal(session.messages.length, 2, "rendered messages should match SDK messages");
  const [userMessage, assistantMessage] = session.messages;

  assert.equal(userMessage.type, "user");
  assert.equal(userMessage.content.length, 1);
  assert.equal(userMessage.content[0].content.type, "text");
  assert.equal(userMessage.content[0].content.text, "Hello from log");

  assert.equal(assistantMessage.type, "assistant");
  assert.equal(assistantMessage.content.length, 1);
  assert.equal(assistantMessage.content[0].content.type, "text");
  assert.equal(assistantMessage.content[0].content.text, "Hi back from fixture");
} finally {
  process.env.HOME = previousHome;
}
