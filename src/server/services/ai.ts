import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { ALLERGENS, DIETARY_TAGS, FOOD_TYPES } from "@/lib/venue/schema";
import { getDb } from "../db";
import { ServiceError } from "../http";

/**
 * AI for the menu editor: drafting "What's this?" explanations and reading
 * a photographed (or, with Claude, PDF) menu into sections and items. Every
 * result is a draft the owner reviews and saves; nothing here writes to the
 * venue.
 *
 * Two providers, chosen by environment:
 *  - Groq (GROQ_API_KEY): gpt-oss for text, Qwen for menu photos. Photos
 *    only, up to 3 per import.
 *  - Claude (ANTHROPIC_API_KEY): photos and PDFs.
 * AI_PROVIDER=groq|anthropic picks one when both keys are set.
 */

export type AiProvider = "groq" | "anthropic";

export function aiProvider(): AiProvider | null {
  const forced = process.env.AI_PROVIDER;
  if (forced === "groq" && process.env.GROQ_API_KEY) return "groq";
  if (forced === "anthropic" && process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

export function aiConfigured(): boolean {
  return aiProvider() !== null;
}

/** What the menu import accepts with the active provider. */
export function aiImportLimits(): { maxImages: number; pdf: boolean } {
  return aiProvider() === "groq" ? { maxImages: 3, pdf: false } : { maxImages: 5, pdf: true };
}

/** Per venue per UTC day; an explanation costs 1 unit, each imported page or photo 10. */
export const AI_DAILY_UNITS = 300;

/** Reserves quota up front; refused requests don't run. */
function spendUnits(venueId: string, units: number) {
  const day = new Date().toISOString().slice(0, 10);
  const db = getDb();
  const row = db.prepare("SELECT units FROM ai_usage WHERE venue_id = ? AND day = ?").get(venueId, day) as { units: number } | undefined;
  if ((row?.units ?? 0) + units > AI_DAILY_UNITS) throw new ServiceError(429, "You've reached today's AI limit for this venue. It resets at midnight (UTC).");
  db.prepare("INSERT INTO ai_usage (venue_id, day, units) VALUES (?, ?, ?) ON CONFLICT (venue_id, day) DO UPDATE SET units = units + excluded.units").run(venueId, day, units);
}

export interface MenuFile {
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "application/pdf";
  base64: string;
}

/** One structured request: a system prompt, user text and optional files, answered as JSON matching `schema`. */
interface StructuredRequest<T> {
  system: string;
  text: string;
  files?: MenuFile[];
  schema: z.ZodType<T>;
  schemaName: string;
  /** Reading a menu needs a vision model and more room to answer. */
  kind: "text" | "vision";
}

async function structured<T>(request: StructuredRequest<T>): Promise<T> {
  const provider = aiProvider();
  if (!provider) throw new ServiceError(503, "AI isn't set up on this server");
  return provider === "groq" ? groqStructured(request) : claudeStructured(request);
}

// ─── Claude ──────────────────────────────────────────────────────────────────

const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

let anthropicClient: Anthropic | null = null;
function anthropic(): Anthropic {
  anthropicClient ??= new Anthropic();
  return anthropicClient;
}

type ParseParams = Parameters<Anthropic["beta"]["messages"]["parse"]>[0];

async function claudeStructured<T>({ system, text, files = [], schema, kind }: StructuredRequest<T>): Promise<T> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = files.map((file) =>
    file.mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: file.base64 } }
      : { type: "image", source: { type: "base64", media_type: file.mediaType, data: file.base64 } },
  );
  content.push({ type: "text", text });
  let response;
  try {
    response = await anthropic().beta.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: kind === "vision" ? 32000 : 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages: [{ role: "user", content }],
      output_config: { effort: kind === "vision" ? "medium" : "low", format: betaZodOutputFormat(schema) },
    } as ParseParams);
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) throw new ServiceError(503, "The AI service is busy. Please try again in a minute.");
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("[ai] Claude authentication failed: check ANTHROPIC_API_KEY");
      throw new ServiceError(503, "AI isn't available right now.");
    }
    if (error instanceof Anthropic.BadRequestError) {
      console.error("[ai] Claude bad request", error.message);
      throw new ServiceError(400, "The AI couldn't read that. Try a clearer photo or a smaller file.");
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`[ai] Claude API error ${error.status}`, error.message);
      throw new ServiceError(502, "The AI service didn't respond as expected. Please try again.");
    }
    throw error;
  }
  if (response.stop_reason === "refusal") throw new ServiceError(422, "The AI declined this request. You can still write it yourself.");
  if (response.stop_reason === "max_tokens") throw new ServiceError(422, "That was too much to read in one go. Try fewer pages at a time.");
  if (!response.parsed_output) throw new ServiceError(502, "The AI's answer couldn't be read. Please try again.");
  return response.parsed_output as T;
}

// ─── Groq (OpenAI-compatible chat completions) ──────────────────────────────

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_TEXT_MODEL = process.env.GROQ_TEXT_MODEL || "openai/gpt-oss-120b";
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b";

/**
 * Groq's strict mode needs every property required and no extra properties
 * on every object; optional values are expressed as nullable types instead.
 */
function strictJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const visit = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(visit);
    if (!node || typeof node !== "object") return node;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === "$schema") continue;
      out[key] = visit(value);
    }
    if (out.type === "object" && out.properties && typeof out.properties === "object") {
      out.required = Object.keys(out.properties as object);
      out.additionalProperties = false;
    }
    return out;
  };
  return visit(z.toJSONSchema(schema)) as Record<string, unknown>;
}

async function groqStructured<T>({ system, text, files = [], schema, schemaName, kind }: StructuredRequest<T>): Promise<T> {
  if (files.some((file) => file.mediaType === "application/pdf")) {
    throw new ServiceError(400, "PDF menus can't be read with the current AI setup. Upload photos or screenshots of the pages instead.");
  }
  const userContent =
    files.length === 0
      ? text
      : [
          { type: "text", text },
          ...files.map((file) => ({ type: "image_url", image_url: { url: `data:${file.mediaType};base64,${file.base64}` } })),
        ];

  let response: Response;
  try {
    response = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: kind === "vision" ? GROQ_VISION_MODEL : GROQ_TEXT_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_schema", json_schema: { name: schemaName, strict: true, schema: strictJsonSchema(schema) } },
        temperature: kind === "vision" ? 0.1 : 0.4,
        max_completion_tokens: 16000,
      }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch (error) {
    console.error("[ai] Groq unreachable", error);
    throw new ServiceError(503, "The AI service didn't answer. Please try again.");
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`[ai] Groq ${response.status}`, detail.slice(0, 500));
    if (response.status === 401 || response.status === 403) throw new ServiceError(503, "AI isn't available right now. Check the Groq API key.");
    if (response.status === 429) throw new ServiceError(503, "The AI service is busy. Please try again in a minute.");
    if (response.status === 413) throw new ServiceError(400, "Those photos are too large. Try fewer or smaller photos.");
    if (response.status === 400) throw new ServiceError(400, "The AI couldn't read that. Try a clearer photo.");
    throw new ServiceError(502, "The AI service didn't respond as expected. Please try again.");
  }

  const data = (await response.json()) as { choices?: { finish_reason?: string; message?: { content?: string | null } }[] };
  const choice = data.choices?.[0];
  if (choice?.finish_reason === "length") throw new ServiceError(422, "That was too much to read in one go. Try fewer photos at a time.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(choice?.message?.content ?? "");
  } catch {
    throw new ServiceError(502, "The AI's answer couldn't be read. Please try again.");
  }
  const result = schema.safeParse(parsed);
  if (!result.success) throw new ServiceError(502, "The AI's answer didn't have the expected shape. Please try again.");
  return result.data;
}

// ─── "What's this dish?" ─────────────────────────────────────────────────────

const explanationsSchema = z.object({
  explanations: z.array(z.object({ itemId: z.string(), explanation: z.string() })),
});

const EXPLAIN_SYSTEM = `You write the "What's this?" notes on a café or restaurant's digital menu. A guest taps the note when they don't recognise a dish name.

Write 2-3 short, warm sentences per dish: what the dish traditionally is, how it tastes, and how it's usually served. Write for a curious guest, not a chef.

Rules that matter, because the venue's guests read these:
- Base each note only on the dish name and the description given. Use hedged wording such as "traditionally" or "usually" for anything the description doesn't state, because this venue's version may differ.
- Never state allergens, ingredients or dietary suitability as fact. Guests rely on staff and the allergen labels for that.
- No prices, no marketing superlatives, no emojis.
- Write in the same language as the menu.
- Reply with JSON only, using each dish's itemId exactly as given.`;

export interface DishInput {
  id: string;
  name: string;
  description?: string | null;
}

/**
 * Drafts explanations. With `onlyUnfamiliar`, the model skips dishes most
 * guests would already know, so a whole menu can be sent in one call.
 */
export async function explainDishes(venue: { id: string; name: string; venueType?: string | null }, dishes: DishInput[], onlyUnfamiliar: boolean) {
  if (!aiConfigured()) throw new ServiceError(503, "AI isn't set up on this server");
  if (dishes.length === 0) return [];
  spendUnits(venue.id, dishes.length);
  const list = dishes.map((dish) => ({ itemId: dish.id, name: dish.name, description: dish.description || undefined }));
  const task = onlyUnfamiliar
    ? "Return explanations only for the dishes whose names an average guest might not recognise. Skip self-explanatory names such as Flat White, Chocolate Brownie or Cheese Toastie. It's fine to return an empty list."
    : "Return one explanation for each dish below.";
  const result = await structured({
    system: EXPLAIN_SYSTEM,
    text: `Venue: ${venue.name}${venue.venueType ? ` (${venue.venueType})` : ""}\n\n${task}\n\nDishes (JSON):\n${JSON.stringify(list)}`,
    schema: explanationsSchema,
    schemaName: "dish_explanations",
    kind: "text",
  });
  const known = new Set(dishes.map((dish) => dish.id));
  return result.explanations
    .filter((entry) => known.has(entry.itemId) && entry.explanation.trim())
    .map((entry) => ({ itemId: entry.itemId, explainer: entry.explanation.trim().slice(0, 600) }));
}

// ─── Menu import ─────────────────────────────────────────────────────────────

const importedMenuSchema = z.object({
  sections: z.array(
    z.object({
      name: z.string(),
      items: z.array(
        z.object({
          name: z.string(),
          description: z.string().nullable(),
          /** In the menu's currency, e.g. 3.4 for £3.40; null when not printed. */
          price: z.number().nullable(),
          dietaryTags: z.array(z.enum(DIETARY_TAGS)),
          allergens: z.array(z.enum(ALLERGENS)),
          /** The veg / non-veg mark, for Indian menus. */
          foodType: z.enum(FOOD_TYPES).nullable(),
        }),
      ),
    }),
  ),
});
export type ImportedMenu = z.output<typeof importedMenuSchema>;

const IMPORT_SYSTEM = `You transcribe a café or restaurant's printed menu (photos or a PDF) into structured data for its digital menu.

- Keep the menu's own sections, order and wording. Fix obvious OCR-style typos, but don't rewrite or embellish.
- Copy descriptions only when the menu prints one; otherwise use null.
- Prices are numbers in the menu's currency (3.40 → 3.4). When one item lists several prices (sizes), use the first and mention the sizes in the description. Use null when no price is printed.
- dietaryTags: only when the menu marks the item (e.g. "V", "VG", "GF", a leaf icon).
- allergens: only when the menu prints them for that item, or an ingredient in the item's own name or description names one (cheese → milk, prawns → crustaceans, peanut satay → peanuts). Never guess from the kind of dish: coffee, tea, juice or a plain dish has none unless such an ingredient is written. Leave the list empty when in doubt; the owner adds the rest.
- foodType: "veg", "nonveg" or "egg" when the menu shows a veg / non-veg mark (green or red dot), or the dish is plainly one (chicken, mutton, fish, prawns → nonveg; omelette, egg curry → egg; paneer, dal, vegetables, coffee → veg). null when unsure.
- Skip anything that isn't a dish or drink: opening hours, addresses, slogans, Wi-Fi details.
- Reply with JSON only.`;

export async function importMenu(venueId: string, files: MenuFile[]): Promise<ImportedMenu> {
  if (!aiConfigured()) throw new ServiceError(503, "AI isn't set up on this server");
  const limits = aiImportLimits();
  if (files.length > limits.maxImages) throw new ServiceError(400, `Upload up to ${limits.maxImages} photos at a time`);
  spendUnits(venueId, files.length * 10);
  return structured({
    system: IMPORT_SYSTEM,
    text: "Transcribe this menu.",
    files,
    schema: importedMenuSchema,
    schemaName: "menu",
    kind: "vision",
  });
}
