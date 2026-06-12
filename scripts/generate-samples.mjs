// Generates sample label PNGs in public/samples/ from inline SVG mockups.
// Run once: node scripts/generate-samples.mjs
import sharp from "sharp";
import { mkdirSync } from "fs";

const WARNING_OK = {
  header: "GOVERNMENT WARNING:",
  body: " (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.",
};

// Title-case header + "can" instead of "may" — two violations to catch
const WARNING_BAD = {
  header: "Government Warning:",
  body: " (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and can cause health problems.",
};

function wrapText(text, maxChars) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > maxChars) {
      lines.push(line.trim());
      line = w;
    } else {
      line += " " + w;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

function warningBlock(x, y, width, warning, headerBold) {
  const full = warning.header + warning.body;
  const lines = wrapText(full, 78);
  const headerLen = warning.header.length;
  let consumed = 0;
  return lines
    .map((line, i) => {
      const ly = y + i * 15;
      let content;
      if (consumed < headerLen) {
        // Header may span into the first line only (it's short)
        const headerPart = line.slice(0, Math.max(0, headerLen - consumed));
        const rest = line.slice(headerPart.length);
        content = `<tspan font-weight="${headerBold ? "bold" : "normal"}">${headerPart}</tspan>${rest}`;
        consumed += line.length + 1;
      } else {
        content = line;
      }
      return `<text x="${x}" y="${ly}" font-family="Helvetica, Arial" font-size="11.5" fill="#1a1a1a">${content}</text>`;
    })
    .join("\n");
}

function bourbonLabel({ warning, headerBold }) {
  return `<svg width="800" height="1000" xmlns="http://www.w3.org/2000/svg">
  <rect width="800" height="1000" fill="#f5efdf"/>
  <rect x="24" y="24" width="752" height="952" fill="none" stroke="#7a5c2e" stroke-width="6"/>
  <rect x="36" y="36" width="728" height="928" fill="none" stroke="#7a5c2e" stroke-width="2"/>
  <text x="400" y="130" text-anchor="middle" font-family="Georgia, serif" font-size="30" fill="#5a431f" letter-spacing="6">EST. 1897</text>
  <text x="400" y="240" text-anchor="middle" font-family="Georgia, serif" font-size="64" font-weight="bold" fill="#3d2c12" letter-spacing="2">OLD TOM</text>
  <text x="400" y="320" text-anchor="middle" font-family="Georgia, serif" font-size="52" font-weight="bold" fill="#3d2c12" letter-spacing="4">DISTILLERY</text>
  <line x1="160" y1="360" x2="640" y2="360" stroke="#7a5c2e" stroke-width="3"/>
  <text x="400" y="430" text-anchor="middle" font-family="Georgia, serif" font-size="34" fill="#5a431f">Kentucky Straight</text>
  <text x="400" y="480" text-anchor="middle" font-family="Georgia, serif" font-size="34" fill="#5a431f">Bourbon Whiskey</text>
  <text x="400" y="580" text-anchor="middle" font-family="Helvetica, Arial" font-size="28" fill="#3d2c12">45% Alc./Vol. (90 Proof)</text>
  <text x="400" y="625" text-anchor="middle" font-family="Helvetica, Arial" font-size="28" fill="#3d2c12">750 mL</text>
  <text x="400" y="720" text-anchor="middle" font-family="Helvetica, Arial" font-size="17" fill="#3d2c12">DISTILLED AND BOTTLED BY</text>
  <text x="400" y="748" text-anchor="middle" font-family="Helvetica, Arial" font-size="17" fill="#3d2c12">OLD TOM DISTILLERY, LOUISVILLE, KY</text>
  <line x1="80" y1="800" x2="720" y2="800" stroke="#7a5c2e" stroke-width="1.5"/>
  ${warningBlock(80, 835, 640, warning, headerBold)}
</svg>`;
}

function wineLabel() {
  const warning = WARNING_OK;
  return `<svg width="800" height="1000" xmlns="http://www.w3.org/2000/svg">
  <rect width="800" height="1000" fill="#fffdf6"/>
  <rect x="30" y="30" width="740" height="940" fill="none" stroke="#6b7d5a" stroke-width="3"/>
  <text x="400" y="150" text-anchor="middle" font-family="Georgia, serif" font-size="26" fill="#6b7d5a" letter-spacing="8">NAPA VALLEY</text>
  <text x="400" y="280" text-anchor="middle" font-family="Georgia, serif" font-size="56" font-weight="bold" fill="#2e3a24">RIVER BEND</text>
  <text x="400" y="350" text-anchor="middle" font-family="Georgia, serif" font-size="44" fill="#2e3a24" letter-spacing="6">VINEYARDS</text>
  <line x1="200" y1="395" x2="600" y2="395" stroke="#6b7d5a" stroke-width="2"/>
  <text x="400" y="470" text-anchor="middle" font-family="Georgia, serif" font-size="40" font-style="italic" fill="#4a5a3a">Chardonnay</text>
  <text x="400" y="530" text-anchor="middle" font-family="Georgia, serif" font-size="30" fill="#4a5a3a">2023</text>
  <text x="400" y="640" text-anchor="middle" font-family="Helvetica, Arial" font-size="24" fill="#2e3a24">13.5% Alc./Vol. · 750 mL</text>
  <text x="400" y="730" text-anchor="middle" font-family="Helvetica, Arial" font-size="16" fill="#2e3a24">PRODUCED AND BOTTLED BY RIVER BEND VINEYARDS</text>
  <text x="400" y="755" text-anchor="middle" font-family="Helvetica, Arial" font-size="16" fill="#2e3a24">NAPA, CALIFORNIA</text>
  <line x1="80" y1="810" x2="720" y2="810" stroke="#6b7d5a" stroke-width="1"/>
  ${warningBlock(80, 845, 640, warning, true)}
</svg>`;
}

mkdirSync("public/samples", { recursive: true });

const jobs = [
  ["public/samples/bourbon-clean.png", bourbonLabel({ warning: WARNING_OK, headerBold: true })],
  ["public/samples/bourbon-warning-violation.png", bourbonLabel({ warning: WARNING_BAD, headerBold: false })],
  ["public/samples/wine-label.png", wineLabel()],
];

for (const [path, svg] of jobs) {
  await sharp(Buffer.from(svg)).png().toFile(path);
  console.log("wrote", path);
}
