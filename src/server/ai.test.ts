import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "tapmore-ai-"));
process.env.DATA_DIR = dataDir;

let ai: typeof import("./services/ai");

beforeAll(async () => {
  ai = await import("./services/ai");
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GROQ_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.AI_PROVIDER;
});

afterAll(async () => {
  await (await import("./db")).closeDb();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

/** Captures the request Groq would receive and answers with `content`. */
function mockGroq(content: string, init: { status?: number; finish?: string } = {}) {
  const calls: { url: string; body: Record<string, unknown>; auth: string | null }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(options.body)), auth: new Headers(options.headers).get("authorization") });
      return new Response(JSON.stringify({ choices: [{ finish_reason: init.finish ?? "stop", message: { content } }] }), { status: init.status ?? 200 });
    }),
  );
  return calls;
}

/** Every object in a strict schema must list all its properties as required and forbid extras. */
function assertStrict(node: unknown, where = "schema") {
  if (Array.isArray(node)) return node.forEach((child, i) => assertStrict(child, `${where}[${i}]`));
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  if (obj.type === "object" && obj.properties) {
    expect(obj.additionalProperties, `${where}.additionalProperties`).toBe(false);
    expect([...(obj.required as string[])].sort(), `${where}.required`).toEqual(Object.keys(obj.properties as object).sort());
  }
  for (const [key, value] of Object.entries(obj)) assertStrict(value, `${where}.${key}`);
}

describe("AI provider choice", () => {
  it("prefers Groq when its key is set, and can be forced", async () => {
    expect(ai.aiProvider()).toBeNull();
    process.env.ANTHROPIC_API_KEY = "a";
    expect(ai.aiProvider()).toBe("anthropic");
    process.env.GROQ_API_KEY = "g";
    expect(ai.aiProvider()).toBe("groq");
    process.env.AI_PROVIDER = "anthropic";
    expect(ai.aiProvider()).toBe("anthropic");
    expect(ai.aiImportLimits()).toEqual({ maxImages: 5, pdf: true });
    process.env.AI_PROVIDER = "groq";
    expect(ai.aiImportLimits()).toEqual({ maxImages: 3, pdf: false });
  });
});

describe("Groq", () => {
  it("drafts dish notes with gpt-oss and a strict JSON schema", async () => {
    process.env.GROQ_API_KEY = "gsk_test";
    const calls = mockGroq(JSON.stringify({ explanations: [{ itemId: "itm_1", explanation: "Eggs poached in spiced tomato sauce." }, { itemId: "made_up", explanation: "x" }] }));
    const result = await ai.explainDishes({ id: "ven_ai1", name: "Cafe" }, [{ id: "itm_1", name: "Shakshuka" }], false);
    expect(result).toEqual([{ itemId: "itm_1", explainer: "Eggs poached in spiced tomato sauce." }]);

    const [call] = calls;
    expect(call.url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(call.auth).toBe("Bearer gsk_test");
    expect(call.body.model).toBe("openai/gpt-oss-120b");
    const format = call.body.response_format as { type: string; json_schema: { strict: boolean; schema: unknown } };
    expect(format.type).toBe("json_schema");
    expect(format.json_schema.strict).toBe(true);
    assertStrict(format.json_schema.schema);
  });

  it("reads menu photos with the vision model, as base64 data URLs", async () => {
    process.env.GROQ_API_KEY = "gsk_test";
    const calls = mockGroq(
      JSON.stringify({ sections: [{ name: "Coffee", items: [{ name: "Flat white", description: null, price: 3.4, dietaryTags: [], allergens: ["milk"], foodType: null }] }] }),
    );
    const menu = await ai.importMenu("ven_ai2", [{ mediaType: "image/jpeg", base64: "AAAA" }]);
    expect(menu.sections[0].items[0]).toMatchObject({ name: "Flat white", price: 3.4, allergens: ["milk"] });

    const body = calls[0].body as { model: string; messages: { role: string; content: unknown }[]; response_format: { json_schema: { schema: unknown } } };
    expect(body.model).toBe("qwen/qwen3.8-27b");
    const user = body.messages[1].content as { type: string; image_url?: { url: string } }[];
    expect(user.find((part) => part.type === "image_url")?.image_url?.url).toBe("data:image/jpeg;base64,AAAA");
    assertStrict(body.response_format.json_schema.schema);
  });

  it("refuses PDFs and more than three photos before calling Groq", async () => {
    process.env.GROQ_API_KEY = "gsk_test";
    const calls = mockGroq("{}");
    await expect(ai.importMenu("ven_ai3", [{ mediaType: "application/pdf", base64: "JVBER" }])).rejects.toThrow(/PDF/);
    const photo = { mediaType: "image/jpeg" as const, base64: "AAAA" };
    await expect(ai.importMenu("ven_ai3", [photo, photo, photo, photo])).rejects.toThrow(/up to 3/);
    expect(calls).toHaveLength(0);
  });

  it("turns Groq failures into messages an owner can act on", async () => {
    process.env.GROQ_API_KEY = "gsk_test";
    mockGroq("", { status: 401 });
    await expect(ai.explainDishes({ id: "ven_ai4", name: "Cafe" }, [{ id: "a", name: "Pho" }], false)).rejects.toThrow(/Groq API key/);
    mockGroq("not json");
    await expect(ai.explainDishes({ id: "ven_ai4", name: "Cafe" }, [{ id: "a", name: "Pho" }], false)).rejects.toThrow(/couldn't be read/);
    mockGroq(JSON.stringify({ wrong: true }));
    await expect(ai.explainDishes({ id: "ven_ai4", name: "Cafe" }, [{ id: "a", name: "Pho" }], false)).rejects.toThrow(/expected shape/);
    mockGroq("{", { finish: "length" });
    await expect(ai.importMenu("ven_ai4", [{ mediaType: "image/png", base64: "AAAA" }])).rejects.toThrow(/too much/);
  });
});
