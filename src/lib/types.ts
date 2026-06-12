export interface ExtractedWarning {
  present: boolean;
  full_text: string | null;
  header_all_caps: boolean | null;
  header_bold: boolean | null;
}

export interface ExtractedLabel {
  brand_name: string | null;
  class_type: string | null;
  alcohol_content: string | null;
  net_contents: string | null;
  government_warning: ExtractedWarning;
  producer_name_address: string | null;
  country_of_origin: string | null;
  confidence_notes: string | null;
}

export interface ApplicationData {
  brand_name: string;
  class_type: string;
  alcohol_content: string;
  net_contents: string;
  producer_name_address: string;
  country_of_origin: string;
}

export type MatchStatus =
  | "match" // exact or case/format-only difference
  | "close" // fuzzy match above threshold — agent should review
  | "mismatch" // values disagree
  | "missing" // field not readable on the label
  | "not_provided"; // application field left blank

export interface FieldComparison {
  field: keyof ApplicationData;
  label: string;
  labelValue: string | null;
  applicationValue: string;
  status: MatchStatus;
  similarity?: number;
  note?: string;
}

export interface WarningWordDiff {
  word: string;
  status: "ok" | "wrong" | "missing" | "extra";
  expected?: string;
}

export interface WarningResult {
  status: "pass" | "fail" | "missing";
  violations: string[];
  diff: WarningWordDiff[] | null;
}

export interface VerificationResult {
  fields: FieldComparison[];
  warning: WarningResult;
}
