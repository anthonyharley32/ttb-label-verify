import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ExtractedLabelSchema } from "../lib/extraction-schema.js";

// Measured on real bottle photos: claude-haiku-4-5 extracts in ~3.5-4.5s but can
// garble very small print; claude-sonnet-4-6 is ~6.5s with near-perfect
// transcription. Compliance work favors fidelity — wrong text is worse than a
// slightly longer wait — so Sonnet is the default. Override via EXTRACTION_MODEL.
const DEFAULT_MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are assisting TTB (Alcohol and Tobacco Tax and Trade Bureau) compliance agents by extracting required label elements from photographs of alcohol beverage labels.

Rules:
- Transcribe text EXACTLY as printed — preserve original capitalization, punctuation, and wording. Never correct, normalize, or "fix" what the label says. If the label says "Government Warning" in title case, report it in title case.
- Use ONLY text visible in the image. Never use your knowledge of the brand to add or substitute information — e.g. do not name a parent company that isn't printed, and do not add a proof value that isn't shown. Wrong-but-printed beats correct-but-absent, always.
- The government warning field is legally sensitive: transcribe it verbatim, character for character. full_text must be the COMPLETE statement starting from its first printed word — include the "GOVERNMENT WARNING:" header (in whatever case/form it appears) if it is printed. Join words split by line-break hyphenation back into whole words.
- If a field is not visible or not readable, return null for it and explain why in confidence_notes.
- Report a field ONLY if it is printed on the label. Never infer values — e.g. do not deduce country_of_origin from an address; if no country is printed, return null.
- For producer_name_address: extract only the responsible-party statement(s) (e.g. "Brewed and bottled by X, City, Country" and/or "Imported by Y, City, State"). Exclude copyright notices, trademarks, and marketing text. If part of the statement is too small or blurry to read with confidence, transcribe what is legible and say so in confidence_notes rather than guessing.
- For alcohol_content: report only the printed statement. Never compute conversions — do not append a proof value (or percentage) that is not literally printed on the label.
- Labels may be photographed at angles, with glare, or in poor lighting — do your best and flag quality issues in confidence_notes.
- Keep confidence_notes null unless there is a genuine readability problem; if there is one, describe it in under 15 words.`;

const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type AllowedMediaType = (typeof ALLOWED_MEDIA_TYPES)[number];

export interface ExtractResult {
  status: number;
  body: Record<string, unknown>;
}

export async function extractLabel(payload: unknown): Promise<ExtractResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      status: 503,
      body: { error: "Server is not configured with an AI API key. Use the sample-label demo, or set ANTHROPIC_API_KEY." },
    };
  }

  const { image, mediaType } = (payload ?? {}) as { image?: unknown; mediaType?: unknown };
  if (!image || typeof image !== "string") {
    return { status: 400, body: { error: "Missing image data." } };
  }
  if (typeof mediaType !== "string" || !ALLOWED_MEDIA_TYPES.includes(mediaType as AllowedMediaType)) {
    return { status: 400, body: { error: `Unsupported image type. Use one of: ${ALLOWED_MEDIA_TYPES.join(", ")}` } };
  }

  const client = new Anthropic();
  const started = Date.now();

  try {
    const response = await client.messages.parse({
      model: process.env.EXTRACTION_MODEL || DEFAULT_MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType as AllowedMediaType, data: image },
            },
            {
              type: "text",
              text: "Extract all TTB-required label elements from this alcohol beverage label photograph.",
            },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(ExtractedLabelSchema) },
    });

    if (!response.parsed_output) {
      return { status: 502, body: { error: "The AI could not produce a structured extraction. Try a clearer photo." } };
    }

    return {
      status: 200,
      body: { extracted: response.parsed_output, elapsedMs: Date.now() - started },
    };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return { status: 503, body: { error: "AI service authentication failed — check the server API key." } };
    }
    if (error instanceof Anthropic.RateLimitError) {
      return { status: 429, body: { error: "AI service is rate-limited. Wait a moment and try again." } };
    }
    if (error instanceof Anthropic.APIError) {
      return { status: 502, body: { error: `AI service error (${error.status}). Please try again.` } };
    }
    return { status: 500, body: { error: "Unexpected error during extraction. Please try again." } };
  }
}
