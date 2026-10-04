import { describe, expect, it } from "vitest";
import { createMemorySink, createLogger } from "../../../infra/logger/index.js";
import { createContext } from "../../context/builder.js";
import type { MessageContext } from "../../context/types.js";
import type { NormalizedMessageEvent } from "../../../adapters/contract.js";
import { runPipeline } from "../pipeline.js";
import { authMiddleware } from "./auth.js";
import { antiLinkMiddleware } from "./anti-link.js";
import { antiSpamMiddleware } from "./anti-spam.js";
import { antiToxicMiddleware } from "./anti-toxic.js";
import { i18nMiddleware } from "./i18n.js";
import { loggerMiddleware } from "./logger.js";
import { onlyGroupMiddleware } from "./only-group.js";
import { rateLimitMiddleware } from "./rate-limit.js";

function ctxFor(body: string, isGroup = false): MessageContext {
  const event: NormalizedMessageEvent = {
    kind: "message",
    sessionId: "s",
    messageId: "m",
    senderJid: "u@example",
    chatJid: isGroup ? "g@g.us" : "u@example",
    body,
    timestamp: 0,
    isGroup,
  };
  return createContext({ message: event, correlationId: "c", sender: async () => "id" });
}

describe("builtin middlewares", () => {
  it("should stop the chain when permission is below required", async () => {
    let reached = false;
    const ctx = ctxFor("hello");
    await runPipeline([
      authMiddleware({ resolvePermission: () => "guest", required: "admin" }),
      { name: "tail", priority: 90, run: async () => { reached = true; } },
    ], ctx);
    expect(reached).toBe(false);
    expect(ctx.stopped).toBe(true);
  });

  it("should stop the second identical message when anti spam window is tight", async () => {
    const first = ctxFor("spam");
    const second = ctxFor("spam");
    const mw = antiSpamMiddleware({ windowMs: 5000, max: 1, now: () => 1000 });
    let runs = 0;
    const tail = { name: "tail", priority: 90, run: async () => { runs += 1; } };
    await runPipeline([mw, tail], first);
    await runPipeline([mw, tail], second);
    expect(runs).toBe(1);
  });

  it("should stop a message with a non whitelisted link", async () => {
    const ctx = ctxFor("see https://evil.example/x");
    await runPipeline([antiLinkMiddleware({ whitelist: ["good.example"] })], ctx);
    expect(ctx.stopped).toBe(true);
  });

  it("should allow a whitelisted subdomain link", async () => {
    const ctx = ctxFor("see https://docs.good.example/x");
    await runPipeline([antiLinkMiddleware({ whitelist: ["good.example"] })], ctx);
    expect(ctx.stopped).toBe(false);
  });

  it("should stop a message matching a toxic pattern", async () => {
    const ctx = ctxFor("you IDIOT");
    await runPipeline([antiToxicMiddleware({ patterns: ["idiot"] })], ctx);
    expect(ctx.stopped).toBe(true);
  });

  it("should stop a group message when only DM is required via only group guard", async () => {
    const ctx = ctxFor("hi", false);
    await runPipeline([onlyGroupMiddleware()], ctx);
    expect(ctx.stopped).toBe(true);
  });

  it("should store the resolved locale on ctx state", async () => {
    const ctx = ctxFor("hi");
    await runPipeline([i18nMiddleware({ supported: ["id", "en"], fallback: "en" })], ctx);
    expect(ctx.state["locale"]).toBe("en");
  });

  it("should write one log record per message", async () => {
    const sink = createMemorySink();
    const logger = createLogger({ level: "info", format: "json", module: "test", sinks: [sink] });
    const ctx = ctxFor("hi");
    await runPipeline([loggerMiddleware({ logger })], ctx);
    expect(sink.records.length).toBe(1);
  });

  it("should stop the second burst message when the bucket is exhausted", async () => {
    const mw = rateLimitMiddleware({ capacity: 1, refillPerMs: 0.0001, now: () => 0 });
    const first = ctxFor("a");
    const second = ctxFor("b");
    let runs = 0;
    const tail = { name: "tail", priority: 90, run: async () => { runs += 1; } };
    await runPipeline([mw, tail], first);
    await runPipeline([mw, tail], second);
    expect(runs).toBe(1);
  });

  it("should prefer the user locale when both locale providers are wired", async () => {
    const ctx = ctxFor("hi");
    await runPipeline(
      [
        i18nMiddleware({
          supported: ["id", "en"],
          fallback: "en",
          userLocaleOf: () => "id",
          groupLocaleOf: () => "en",
        }),
      ],
      ctx,
    );
    expect(ctx.state["locale"]).toBe("id");
  });

  it("should fall back to the group locale when the user locale is unsupported", async () => {
    const ctx = ctxFor("hi");
    await runPipeline(
      [
        i18nMiddleware({
          supported: ["id", "en"],
          fallback: "en",
          userLocaleOf: () => "fr",
          groupLocaleOf: () => "id",
        }),
      ],
      ctx,
    );
    expect(ctx.state["locale"]).toBe("id");
  });

  it("should invoke the reply hook when only group receives a DM", async () => {
    let replied = false;
    const ctx = ctxFor("hi", false);
    await runPipeline([onlyGroupMiddleware({ reply: async () => { replied = true; } })], ctx);
    expect(replied).toBe(true);
  });

  it("should invoke the reply hook when anti toxic matches", async () => {
    let replied = false;
    const ctx = ctxFor("you IDIOT");
    await runPipeline([antiToxicMiddleware({ patterns: ["idiot"], reply: async () => { replied = true; } })], ctx);
    expect(replied).toBe(true);
  });

  it("should invoke the reply hook when anti link blocks a host", async () => {
    let replied = false;
    const ctx = ctxFor("see https://evil.example/x");
    await runPipeline([antiLinkMiddleware({ whitelist: [], reply: async () => { replied = true; } })], ctx);
    expect(replied).toBe(true);
  });

  it("should invoke the reply hook with retry time when rate limit denies", async () => {
    let retryAfter = -1;
    const ctx = ctxFor("b");
    const mw = rateLimitMiddleware({
      capacity: 1,
      refillPerMs: 0.0001,
      now: () => 0,
      reply: async (_inner: MessageContext, retry: number) => {
        retryAfter = retry;
      },
    });
    await runPipeline([mw], ctxFor("a"));
    await runPipeline([mw], ctx);
    expect(retryAfter).toBeGreaterThan(0);
  });

  it("should invoke the reply hook with a reason when auth denies", async () => {
    let reason = "";
    const ctx = ctxFor("hi");
    await runPipeline(
      [
        authMiddleware({
          resolvePermission: () => "guest",
          required: "admin",
          reply: async (_inner: MessageContext, why: string) => {
            reason = why;
          },
        }),
      ],
      ctx,
    );
    expect(reason).toBe("insufficient permission");
  });
});