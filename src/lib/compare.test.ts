import { describe, expect, it } from "vitest";
import { normalize, parseAbv, parseVolumeMl, similarity, verify, verifyWarning } from "./compare";
import { CANONICAL_WARNING } from "./constants";
import type { ApplicationData, ExtractedLabel } from "./types";

const baseExtraction: ExtractedLabel = {
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
  producer_name_address: "Old Tom Distillery, Louisville, KY",
  country_of_origin: null,
  confidence_notes: null,
};

const baseApplication: ApplicationData = {
  brand_name: "OLD TOM DISTILLERY",
  class_type: "Kentucky Straight Bourbon Whiskey",
  alcohol_content: "45%",
  net_contents: "750 mL",
  producer_name_address: "Old Tom Distillery, Louisville, KY",
  country_of_origin: "",
};

describe("fuzzy text matching", () => {
  it("treats case-only differences as a match (Dave's STONE'S THROW scenario)", () => {
    const result = verify(
      { ...baseExtraction, brand_name: "STONE'S THROW" },
      { ...baseApplication, brand_name: "Stone's Throw" },
    );
    const brand = result.fields.find((f) => f.field === "brand_name")!;
    expect(brand.status).toBe("match");
    expect(brand.note).toMatch(/case/i);
  });

  it("treats curly vs straight apostrophes as a match", () => {
    expect(normalize("STONE’S THROW")).toBe(normalize("Stone's Throw"));
  });

  it("flags near-matches for review rather than failing them", () => {
    const result = verify(
      { ...baseExtraction, brand_name: "Old Tom Distilery" }, // typo
      baseApplication,
    );
    expect(result.fields.find((f) => f.field === "brand_name")!.status).toBe("close");
  });

  it("matches an importer statement contained in the label's fuller name & address text (Heineken scenario)", () => {
    const result = verify(
      {
        ...baseExtraction,
        producer_name_address:
          "BREWED AND BOTTLED BY HEINEKEN BROUWERIJEN B.V., AMSTERDAM, HOLLAND, IMPORTED BY HEINEKEN USA, WHITE PLAINS, NY",
      },
      { ...baseApplication, producer_name_address: "Heineken USA, White Plains, NY" },
    );
    const producer = result.fields.find((f) => f.field === "producer_name_address")!;
    expect(producer.status).toBe("match");
    expect(producer.note).toMatch(/within the label/i);
  });

  it("does not containment-match short strings on non-producer fields", () => {
    const result = verify(
      { ...baseExtraction, brand_name: "OLD TOM DISTILLERY RESERVE COLLECTION" },
      { ...baseApplication, brand_name: "OLD TOM DISTILLERY" },
    );
    // Brand name uses strict fuzzy matching only — a partial brand is not a clean match
    expect(result.fields.find((f) => f.field === "brand_name")!.status).not.toBe("match");
  });

  it("flags genuinely different values as mismatch", () => {
    const result = verify({ ...baseExtraction, brand_name: "RIVER BEND VINEYARDS" }, baseApplication);
    expect(result.fields.find((f) => f.field === "brand_name")!.status).toBe("mismatch");
  });

  it("similarity is symmetric and bounded", () => {
    expect(similarity("abc", "abc")).toBe(1);
    expect(similarity("abc", "xyz")).toBeLessThan(0.5);
  });
});

describe("ABV comparison", () => {
  it("parses common ABV formats to the same number", () => {
    expect(parseAbv("45% Alc./Vol. (90 Proof)")).toBe(45);
    expect(parseAbv("45% ABV")).toBe(45);
    expect(parseAbv("45")).toBe(45);
    expect(parseAbv("13.5% Alc./Vol.")).toBe(13.5);
  });

  it("matches numerically despite different formatting", () => {
    const result = verify(baseExtraction, { ...baseApplication, alcohol_content: "45% ABV" });
    expect(result.fields.find((f) => f.field === "alcohol_content")!.status).toBe("match");
  });

  it("catches a real ABV mismatch", () => {
    const result = verify(baseExtraction, { ...baseApplication, alcohol_content: "40%" });
    expect(result.fields.find((f) => f.field === "alcohol_content")!.status).toBe("mismatch");
  });
});

describe("net contents comparison", () => {
  it("parses units to milliliters", () => {
    expect(parseVolumeMl("750 mL")).toBe(750);
    expect(parseVolumeMl("750ml")).toBe(750);
    expect(parseVolumeMl("75 cl")).toBe(750);
    expect(parseVolumeMl("1 L")).toBe(1000);
    expect(parseVolumeMl("1 Liter")).toBe(1000);
  });

  it("matches equivalent volumes in different units", () => {
    const result = verify({ ...baseExtraction, net_contents: "75 cl" }, baseApplication);
    expect(result.fields.find((f) => f.field === "net_contents")!.status).toBe("match");
  });
});

describe("government warning verification (27 CFR Part 16)", () => {
  it("passes the exact canonical text with correct formatting", () => {
    const result = verifyWarning(baseExtraction.government_warning);
    expect(result.status).toBe("pass");
    expect(result.violations).toHaveLength(0);
  });

  it("fails a missing warning", () => {
    const result = verifyWarning({ present: false, full_text: null, header_all_caps: null, header_bold: null });
    expect(result.status).toBe("missing");
  });

  it("fails title-case 'Government Warning:' (Jenny's scenario)", () => {
    const result = verifyWarning({
      present: true,
      full_text: CANONICAL_WARNING.replace("GOVERNMENT WARNING:", "Government Warning:"),
      header_all_caps: false,
      header_bold: true,
    });
    expect(result.status).toBe("fail");
    expect(result.violations.some((v) => v.includes("ALL CAPS"))).toBe(true);
  });

  it("fails a non-bold header", () => {
    const result = verifyWarning({
      present: true,
      full_text: CANONICAL_WARNING,
      header_all_caps: true,
      header_bold: false,
    });
    expect(result.status).toBe("fail");
    expect(result.violations.some((v) => v.includes("bold"))).toBe(true);
  });

  it("catches modified wording and pinpoints the changed word", () => {
    const tampered = CANONICAL_WARNING.replace("may cause health problems", "can cause health problems");
    const result = verifyWarning({ present: true, full_text: tampered, header_all_caps: true, header_bold: true });
    expect(result.status).toBe("fail");
    const wrong = result.diff!.find((d) => d.status === "wrong");
    expect(wrong?.word).toBe("can");
    expect(wrong?.expected).toBe("may");
  });

  it("catches omitted words", () => {
    const tampered = CANONICAL_WARNING.replace(" because of the risk of birth defects", "");
    const result = verifyWarning({ present: true, full_text: tampered, header_all_caps: true, header_bold: true });
    expect(result.status).toBe("fail");
    expect(result.diff!.some((d) => d.status === "missing")).toBe(true);
  });

  it("does not penalize whitespace differences", () => {
    const spaced = CANONICAL_WARNING.replace(/ /g, "  ");
    const result = verifyWarning({ present: true, full_text: spaced, header_all_caps: true, header_bold: true });
    expect(result.status).toBe("pass");
  });
});

describe("end-to-end verification", () => {
  it("clean label + matching application = all green", () => {
    const result = verify(baseExtraction, baseApplication);
    const counted = result.fields.filter((f) => f.status !== "not_provided");
    expect(counted.every((f) => f.status === "match")).toBe(true);
    expect(result.warning.status).toBe("pass");
  });

  it("blank application fields are reported as not_provided, not as failures", () => {
    const result = verify(baseExtraction, { ...baseApplication, country_of_origin: "" });
    expect(result.fields.find((f) => f.field === "country_of_origin")!.status).toBe("not_provided");
  });

  it("field on application but unreadable on label = missing", () => {
    const result = verify({ ...baseExtraction, net_contents: null }, baseApplication);
    expect(result.fields.find((f) => f.field === "net_contents")!.status).toBe("missing");
  });
});
