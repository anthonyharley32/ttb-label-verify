import type {
  ApplicationData,
  ExtractedLabel,
  FieldComparison,
  MatchStatus,
  VerificationResult,
  WarningResult,
  WarningWordDiff,
} from "./types";
import { CANONICAL_WARNING, FIELD_LABELS } from "./constants";

/** Lowercase, trim, collapse whitespace, normalize curly quotes/dashes. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

export function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/** Pull the first percentage-like number out of an ABV string. Handles "45% Alc./Vol. (90 Proof)", "13.5% ABV", "45". */
export function parseAbv(s: string): number | null {
  const match = s.replace(",", ".").match(/(\d+(?:\.\d+)?)\s*%?/);
  return match ? parseFloat(match[1]) : null;
}

/** Parse a volume string to milliliters. Handles mL, cL, L, fl oz. */
export function parseVolumeMl(s: string): number | null {
  const match = s
    .replace(",", ".")
    .match(/(\d+(?:\.\d+)?)\s*(ml|milliliters?|cl|centiliters?|l|liters?|litres?|fl\.?\s*oz\.?|ounces?)/i);
  if (!match) {
    // Bare number — assume mL (the overwhelmingly common case on labels)
    const bare = s.match(/^(\d+(?:\.\d+)?)$/);
    return bare ? parseFloat(bare[1]) : null;
  }
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase().replace(/[.\s]/g, "");
  if (unit.startsWith("ml") || unit.startsWith("millilit")) return value;
  if (unit.startsWith("cl") || unit.startsWith("centilit")) return value * 10;
  if (unit.startsWith("l")) return value * 1000;
  if (unit.startsWith("floz") || unit.startsWith("oz") || unit.startsWith("ounce")) return value * 29.5735;
  return null;
}

const FUZZY_THRESHOLD = 0.85;

function compareText(labelValue: string | null, applicationValue: string): { status: MatchStatus; similarity?: number; note?: string } {
  if (!applicationValue.trim()) return { status: "not_provided" };
  if (!labelValue || !labelValue.trim()) return { status: "missing", note: "Not found on label" };

  const a = normalize(labelValue);
  const b = normalize(applicationValue);
  if (a === b) {
    const note =
      labelValue.trim() !== applicationValue.trim()
        ? "Case/formatting differs but text is identical"
        : undefined;
    return { status: "match", similarity: 1, note };
  }
  const sim = similarity(a, b);
  if (sim >= FUZZY_THRESHOLD) {
    return { status: "close", similarity: sim, note: `${Math.round(sim * 100)}% similar — review minor differences` };
  }
  return { status: "mismatch", similarity: sim };
}

function compareAbv(labelValue: string | null, applicationValue: string): { status: MatchStatus; note?: string } {
  if (!applicationValue.trim()) return { status: "not_provided" };
  if (!labelValue || !labelValue.trim()) return { status: "missing", note: "Not found on label" };
  const labelNum = parseAbv(labelValue);
  const appNum = parseAbv(applicationValue);
  if (labelNum === null || appNum === null) {
    // Fall back to text comparison when we can't parse a number
    return compareText(labelValue, applicationValue);
  }
  if (Math.abs(labelNum - appNum) < 0.001) {
    return { status: "match", note: "Numeric values match" };
  }
  return { status: "mismatch", note: `Label shows ${labelNum}%, application says ${appNum}%` };
}

function compareVolume(labelValue: string | null, applicationValue: string): { status: MatchStatus; note?: string } {
  if (!applicationValue.trim()) return { status: "not_provided" };
  if (!labelValue || !labelValue.trim()) return { status: "missing", note: "Not found on label" };
  const labelMl = parseVolumeMl(labelValue);
  const appMl = parseVolumeMl(applicationValue);
  if (labelMl === null || appMl === null) {
    return compareText(labelValue, applicationValue);
  }
  if (Math.abs(labelMl - appMl) < 0.5) {
    return { status: "match", note: "Volumes are equivalent" };
  }
  return { status: "mismatch", note: `Label shows ${labelMl} mL, application says ${appMl} mL` };
}

/** Word-level diff of the extracted warning against the canonical 27 CFR 16 text. Case-insensitive (header case is checked separately). */
function diffWarning(extracted: string): WarningWordDiff[] {
  const canonWords = CANONICAL_WARNING.split(/\s+/);
  const gotWords = extracted.replace(/\s+/g, " ").trim().split(/\s+/);

  const stripPunct = (w: string) => normalize(w).replace(/[^a-z0-9%()]/g, "");

  // LCS-based alignment so a single missing/extra word doesn't cascade
  const n = gotWords.length;
  const m = canonWords.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        stripPunct(gotWords[i]) === stripPunct(canonWords[j])
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const diff: WarningWordDiff[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (stripPunct(gotWords[i]) === stripPunct(canonWords[j])) {
      diff.push({ word: gotWords[i], status: "ok" });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      diff.push({ word: gotWords[i], status: "extra" });
      i++;
    } else {
      diff.push({ word: canonWords[j], status: "missing", expected: canonWords[j] });
      j++;
    }
  }
  while (i < n) diff.push({ word: gotWords[i++], status: "extra" });
  while (j < m) diff.push({ word: canonWords[j++], status: "missing", expected: canonWords[j - 1] });

  // Merge adjacent extra+missing pairs into "wrong" for nicer display
  const merged: WarningWordDiff[] = [];
  for (let k = 0; k < diff.length; k++) {
    const cur = diff[k];
    const next = diff[k + 1];
    if (cur.status === "extra" && next?.status === "missing") {
      merged.push({ word: cur.word, status: "wrong", expected: next.word });
      k++;
    } else if (cur.status === "missing" && next?.status === "extra") {
      merged.push({ word: next.word, status: "wrong", expected: cur.word });
      k++;
    } else {
      merged.push(cur);
    }
  }
  return merged;
}

export function verifyWarning(extracted: ExtractedLabel["government_warning"]): WarningResult {
  if (!extracted.present || !extracted.full_text) {
    return {
      status: "missing",
      violations: ["No Government Warning statement found on the label. Required on all beverages ≥ 0.5% ABV (27 CFR Part 16)."],
      diff: null,
    };
  }

  const violations: string[] = [];
  const text = extracted.full_text.replace(/\s+/g, " ").trim();

  // 1. Header must be ALL CAPS, exactly "GOVERNMENT WARNING:"
  const headerMatch = text.match(/^(government\s+warning:?)/i);
  if (headerMatch) {
    const header = headerMatch[1];
    if (header !== header.toUpperCase()) {
      violations.push(`"${header}" must be in ALL CAPS — found mixed case. This is a common violation and grounds for rejection.`);
    }
    if (!header.replace(/\s+/g, " ").endsWith(":")) {
      violations.push('Missing colon after "GOVERNMENT WARNING".');
    }
  } else {
    violations.push('Statement does not begin with "GOVERNMENT WARNING:".');
  }

  // 2. Header must be bold (AI assessment from the image — approximate)
  if (extracted.header_bold === false) {
    violations.push('"GOVERNMENT WARNING:" does not appear to be in bold type. (Visual assessment — verify against the original label file.)');
  }

  // 3. Wording must match canonical text word-for-word (case-insensitive for the body)
  const wordingMatches = normalize(text) === normalize(CANONICAL_WARNING);
  let diff: WarningWordDiff[] | null = null;
  if (!wordingMatches) {
    diff = diffWarning(text);
    const problems = diff.filter((d) => d.status !== "ok");
    if (problems.length > 0) {
      violations.push(`Wording differs from the required statutory text (${problems.length} difference${problems.length === 1 ? "" : "s"} highlighted below).`);
    }
  } else {
    diff = diffWarning(text); // all-ok diff, used for display
  }

  return {
    status: violations.length === 0 ? "pass" : "fail",
    violations,
    diff,
  };
}

export function verify(extracted: ExtractedLabel, application: ApplicationData): VerificationResult {
  const fields: FieldComparison[] = [
    { field: "brand_name" as const, ...compareText(extracted.brand_name, application.brand_name) },
    { field: "class_type" as const, ...compareText(extracted.class_type, application.class_type) },
    { field: "alcohol_content" as const, ...compareAbv(extracted.alcohol_content, application.alcohol_content) },
    { field: "net_contents" as const, ...compareVolume(extracted.net_contents, application.net_contents) },
    { field: "producer_name_address" as const, ...compareText(extracted.producer_name_address, application.producer_name_address) },
    { field: "country_of_origin" as const, ...compareText(extracted.country_of_origin, application.country_of_origin) },
  ].map((f) => ({
    ...f,
    label: FIELD_LABELS[f.field],
    labelValue: extracted[f.field],
    applicationValue: application[f.field],
  }));

  return { fields, warning: verifyWarning(extracted.government_warning) };
}
