import type { ApplicationData, ExtractedLabel } from "./types";
import { CANONICAL_WARNING } from "./constants";

/**
 * Demo mode: a canned extraction matching the bundled sample label image,
 * so reviewers can walk the full flow even without an AI API key configured.
 */
export const DEMO_IMAGE_URL = "/samples/bourbon-clean.png";

export const DEMO_EXTRACTION: ExtractedLabel = {
  brand_name: "OLD TOM DISTILLERY",
  class_type: "Kentucky Straight Bourbon Whiskey",
  alcohol_content: "45% Alc./Vol. (90 Proof)",
  net_contents: "750 mL",
  government_warning: {
    present: true,
    full_text: CANONICAL_WARNING,
    header_all_caps: true,
    header_bold: true,
  },
  producer_name_address: "Distilled and Bottled by Old Tom Distillery, Louisville, KY",
  country_of_origin: null,
  confidence_notes: null,
};

/** Pre-filled "COLA application" data. Brand name is deliberately a different
 *  case than the label to demonstrate the fuzzy-matching behavior. */
export const DEMO_APPLICATION: ApplicationData = {
  brand_name: "Old Tom Distillery",
  class_type: "Kentucky Straight Bourbon Whiskey",
  alcohol_content: "45%",
  net_contents: "750 mL",
  producer_name_address: "Distilled and Bottled by Old Tom Distillery, Louisville, KY",
  country_of_origin: "",
};
