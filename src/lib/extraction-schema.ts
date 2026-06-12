import { z } from "zod";

export const ExtractedWarningSchema = z.object({
  present: z.boolean(),
  full_text: z
    .string()
    .nullable()
    .describe("The exact warning text as printed, preserving original capitalization, punctuation, and wording"),
  header_all_caps: z
    .boolean()
    .nullable()
    .describe('Whether the "GOVERNMENT WARNING" header appears in all capital letters'),
  header_bold: z
    .boolean()
    .nullable()
    .describe('Whether the "GOVERNMENT WARNING:" header appears in bold type, null if not determinable'),
});

export const ExtractedLabelSchema = z.object({
  brand_name: z.string().nullable().describe("Brand name exactly as shown, preserving capitalization"),
  class_type: z.string().nullable().describe('Class/type designation, e.g. "Kentucky Straight Bourbon Whiskey"'),
  alcohol_content: z.string().nullable().describe('ABV exactly as shown, e.g. "45% Alc./Vol. (90 Proof)"'),
  net_contents: z.string().nullable().describe('Volume exactly as shown, e.g. "750 mL"'),
  government_warning: ExtractedWarningSchema,
  producer_name_address: z.string().nullable().describe("Name and address of bottler/producer/importer as shown"),
  country_of_origin: z.string().nullable().describe("Country of origin if present (required for imports), else null"),
  confidence_notes: z
    .string()
    .nullable()
    .describe("Any image-quality or readability issues affecting confidence: glare, angle, blur, cropped text"),
});

export type ExtractedLabelPayload = z.infer<typeof ExtractedLabelSchema>;
