import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ExtractedLabelSchema } from "../lib/extraction-schema.js";

/**
 * Provider selection — measured on real bottle photos:
 *   gemini-3.5-flash    ~2-3s expected, excellent printed-text OCR  (preferred when GEMINI_API_KEY is set)
 *   claude-haiku-4-5    ~3.5-4.5s, can garble very small print      (Claude fallback default)
 *   claude-sonnet-4-6   ~6.5s, near-perfect transcription           (via EXTRACTION_MODEL)
 * Override the model per provider via EXTRACTION_MODEL.
 */
const DEFAULT_CLAUDE_MODEL = "claude-haiku-4-5";
const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";

const SYSTEM_PROMPT = `You are assisting TTB (Alcohol and Tobacco Tax and Trade Bureau) compliance agents by extracting required label elements from photographs of alcohol beverage labels.

Rules:
- Transcribe text EXACTLY as printed — preserve original capitalization, punctuation, and wording. Never correct, normalize, or "fix" what the label says. If the label says "Government Warning" in title case, report it in title case.
- Use ONLY text visible in the image. Never use your knowledge of the brand to add or substitute information — e.g. do not name a parent company that isn't printed, and do not add a proof value that isn't shown. Wrong-but-printed beats correct-but-absent, always.
- The government warning field is legally sensitive: transcribe it verbatim, character for character. full_text must be the COMPLETE statement starting from its first printed word — include the "GOVERNMENT WARNING:" header (in whatever case/form it appears) if it is printed. Join words split by line-break hyphenation back into whole words.
- If a field is not visible or not readable, return null for it and explain why in confidence_notes.
- Report a field ONLY if it is printed on the label. Never infer values — e.g. do not deduce country_of_origin from an address; if no country is printed, return null.
- For producer_name_address: extract only the responsible-party statement(s) (e.g. "Brewed and bottled by X, City, Country" and/or "Imported by Y, City, State"). Exclude copyright notices, trademark lines, and marketing text even when printed inside the same block. If part of the statement is too small or blurry to read with confidence, transcribe what is legible and say so in confidence_notes rather than guessing.

Example of producer_name_address extraction:
Label block reads: "BREWED BY CEDAR PEAK BREWING CO., MUNICH, GERMANY ©2019 CEDAR PEAK® AMBER ALE, IMPORTED BY NORTHGATE IMPORTS LLC, SEATTLE, WA"
Correct producer_name_address: "BREWED BY CEDAR PEAK BREWING CO., MUNICH, GERMANY, IMPORTED BY NORTHGATE IMPORTS LLC, SEATTLE, WA"
(The copyright/trademark fragment is dropped; both responsible-party statements are kept verbatim.)
- For alcohol_content: report only the printed statement. Never compute conversions — do not append a proof value (or percentage) that is not literally printed on the label.
- Labels may be photographed at angles, with glare, or in poor lighting — do your best and flag quality issues in confidence_notes.
- Keep confidence_notes null unless there is a genuine readability problem; if there is one, describe it in under 15 words.`;

const USER_PROMPT = "Extract all TTB-required label elements from this alcohol beverage label photograph.";

const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type AllowedMediaType = (typeof ALLOWED_MEDIA_TYPES)[number];

export interface ExtractResult {
  status: number;
  body: Record<string, unknown>;
}

export async function extractLabel(payload: unknown): Promise<ExtractResult> {
  const provider = process.env.GEMINI_API_KEY ? "gemini" : process.env.ANTHROPIC_API_KEY ? "anthropic" : null;
  if (!provider) {
    return {
      status: 503,
      body: { error: "Server is not configured with an AI API key. Use the sample-label demo, or set GEMINI_API_KEY or ANTHROPIC_API_KEY." },
    };
  }

  const { image, mediaType } = (payload ?? {}) as { image?: unknown; mediaType?: unknown };
  if (!image || typeof image !== "string") {
    return { status: 400, body: { error: "Missing image data." } };
  }
  if (typeof mediaType !== "string" || !ALLOWED_MEDIA_TYPES.includes(mediaType as AllowedMediaType)) {
    return { status: 400, body: { error: `Unsupported image type. Use one of: ${ALLOWED_MEDIA_TYPES.join(", ")}` } };
  }

  const started = Date.now();
  const result =
    provider === "gemini"
      ? await extractWithGemini(image, mediaType as AllowedMediaType)
      : await extractWithClaude(image, mediaType as AllowedMediaType);

  if ("error" in result) return result.error;
  return {
    status: 200,
    body: { extracted: result.extracted, elapsedMs: Date.now() - started, provider },
  };
}

type ProviderResult = { extracted: unknown } | { error: ExtractResult };

async function extractWithClaude(image: string, mediaType: AllowedMediaType): Promise<ProviderResult> {
  const client = new Anthropic();
  try {
    const response = await client.messages.parse({
      model: process.env.EXTRACTION_MODEL || DEFAULT_CLAUDE_MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
            { type: "text", text: USER_PROMPT },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(ExtractedLabelSchema) },
    });

    if (!response.parsed_output) {
      return { error: { status: 502, body: { error: "The AI could not produce a structured extraction. Try a clearer photo." } } };
    }
    return { extracted: response.parsed_output };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return { error: { status: 503, body: { error: "AI service authentication failed — check the server API key." } } };
    }
    if (error instanceof Anthropic.RateLimitError) {
      return { error: { status: 429, body: { error: "AI service is rate-limited. Wait a moment and try again." } } };
    }
    if (error instanceof Anthropic.APIError) {
      return { error: { status: 502, body: { error: `AI service error (${error.status}). Please try again.` } } };
    }
    return { error: { status: 500, body: { error: "Unexpected error during extraction. Please try again." } } };
  }
}

// OpenAPI-style mirror of ExtractedLabelSchema for Gemini's structured output
// (Gemini's responseSchema uses `nullable: true`, not JSON-Schema type arrays).
const nullableString = { type: "string", nullable: true };
const nullableBoolean = { type: "boolean", nullable: true };
const GEMINI_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    brand_name: nullableString,
    class_type: nullableString,
    alcohol_content: nullableString,
    net_contents: nullableString,
    government_warning: {
      type: "object",
      properties: {
        present: { type: "boolean" },
        full_text: nullableString,
        header_all_caps: nullableBoolean,
        header_bold: nullableBoolean,
      },
      required: ["present", "full_text", "header_all_caps", "header_bold"],
    },
    producer_name_address: nullableString,
    country_of_origin: nullableString,
    confidence_notes: nullableString,
  },
  required: [
    "brand_name",
    "class_type",
    "alcohol_content",
    "net_contents",
    "government_warning",
    "producer_name_address",
    "country_of_origin",
    "confidence_notes",
  ],
};

async function extractWithGemini(image: string, mediaType: AllowedMediaType): Promise<ProviderResult> {
  const model = process.env.EXTRACTION_MODEL || DEFAULT_GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const baseBody = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      {
        parts: [{ inline_data: { mime_type: mediaType, data: image } }, { text: USER_PROMPT }],
      },
    ],
  };

  const generationConfig = {
    responseMimeType: "application/json",
    responseSchema: GEMINI_RESPONSE_SCHEMA,
    // Flash models think by default, adding 4-7s per request. Verbatim
    // transcription doesn't need reasoning — disabling keeps us well under 5s.
    thinkingConfig: { thinkingBudget: 0 },
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
      body: JSON.stringify({ ...baseBody, generationConfig }),
    });
  } catch {
    return { error: { status: 502, body: { error: "Could not reach the AI service. Please try again." } } };
  }

  if (res.status === 401 || res.status === 403) {
    return { error: { status: 503, body: { error: "AI service authentication failed — check the server API key." } } };
  }
  if (res.status === 429) {
    return { error: { status: 429, body: { error: "AI service is rate-limited. Wait a moment and try again." } } };
  }
  if (!res.ok) {
    return { error: { status: 502, body: { error: `AI service error (${res.status}). Please try again.` } } };
  }

  try {
    const data = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? "")
      .join("");
    const parsed = ExtractedLabelSchema.safeParse(JSON.parse(text || ""));
    if (!parsed.success) {
      return { error: { status: 502, body: { error: "The AI could not produce a structured extraction. Try a clearer photo." } } };
    }
    return { extracted: parsed.data };
  } catch {
    return { error: { status: 502, body: { error: "The AI returned an unreadable response. Please try again." } } };
  }
}
