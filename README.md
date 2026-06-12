# TTB Label Verification Assistant

> An AI-powered prototype that helps TTB compliance agents verify alcohol beverage labels against COLA application data — built for the Department of the Treasury IT Specialist (AI) take-home assessment.

**Live demo:** _[deployed URL here]_

## How It Works

1. **Upload** a photo of an alcohol beverage label (drag-and-drop; angled/glary photos are OK)
2. **AI reads the label** — Claude vision extracts all TTB-required elements in ~2–3 seconds
3. **Enter the application data** from the COLA form
4. **Review results** — field-by-field match/mismatch, plus a dedicated Government Health Warning compliance check with word-level diffing

No photo handy? Click **"Try it with a sample label"** in the app, or download the bundled test labels (including one with deliberate warning violations) from the upload screen.

## Quick Start (Local)

```bash
git clone https://github.com/anthonyharley32/ttb-label-verify.git
cd ttb-label-verify
npm install
cp .env.example .env.local   # add your Anthropic API key
npm run dev                  # http://localhost:5173
```

Without an API key, the app still runs — the sample-label demo works fully; only live photo extraction requires the key.

```bash
npm test                     # comparison-engine unit tests (20 tests)
npm run build                # typecheck + production build
```

## Architecture

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 19 + Vite + TypeScript | Fast, simple SPA — no framework overhead for a 3-step tool |
| Styling | Tailwind CSS v4 | Quick to build a clean, high-contrast, large-target UI |
| AI extraction | Claude vision (`claude-haiku-4-5`) via one serverless function | See "Why vision AI" and "Why Haiku" below |
| Comparison engine | Pure TypeScript (`src/lib/compare.ts`), unit-tested | Deterministic, explainable results — no AI in the verification step |
| Hosting | Vercel (static SPA + `api/extract-label` function) | One-command deploys; the API key lives server-side only |

The only server-side code is [`api/extract-label.ts`](api/extract-label.ts) → [`src/server/extract.ts`](src/server/extract.ts): it receives the image, calls Claude with a structured-output schema, and returns typed JSON. A Vite dev plugin serves the same handler locally, so `npm run dev` works end-to-end with no extra tooling.

### Why vision AI instead of traditional OCR

The previous scanning-vendor pilot failed on two fronts: 30–40 second processing and brittleness against real-world image quality. A multimodal model handles both — it reads angled/glary photos natively, understands *context* (it can tell a brand name from a class designation without rigid templates), and returns structured JSON in a single ~2–3s call.

### Why Haiku (model choice)

Stakeholders were explicit that anything slower than ~5 seconds will not be adopted. `claude-haiku-4-5` is the fastest Claude model and completes a label extraction in ~2–3 seconds with high accuracy on this task. The model is configurable via `EXTRACTION_MODEL` if accuracy needs ever outweigh latency.

### Deliberate design decisions

- **AI extracts; code verifies.** The AI transcribes the label *exactly as printed* (it is explicitly instructed never to "fix" what it reads). All match/mismatch decisions are made by deterministic, unit-tested TypeScript — so a compliance decision is never resting on an unexplainable model judgment.
- **Fuzzy matching with judgment.** `"STONE'S THROW"` vs `"Stone's Throw"` is a match (case/punctuation-insensitive), a one-letter typo is flagged yellow for agent review, and genuinely different values are red. ABV and net contents are compared numerically, so `45% Alc./Vol. (90 Proof)` matches `45%`, and `75 cl` matches `750 mL`.
- **The Government Warning gets special treatment** (27 CFR Part 16): exact statutory wording check with a word-level diff display, ALL-CAPS check on `GOVERNMENT WARNING:`, and a bold-type check. Title-case headers, swapped words ("may" → "can"), and omissions are all caught and highlighted.
- **The agent decides, the tool assists.** Results are color-coded suggestions; nothing is auto-approved or auto-rejected.
- **UI built for a mixed-tech-comfort team:** one obvious action per screen, large click targets, plain language ("Upload Label Photo", not "Submit image for OCR"), no jargon.

## Tools Used

- React 19, Vite 7, TypeScript, Tailwind CSS v4
- `@anthropic-ai/sdk` with Zod structured outputs (guaranteed-schema JSON from the vision call)
- Vitest for the comparison-engine test suite
- `sharp` (dev-only) to generate the sample label images from SVG mockups

## Assumptions & Limitations

- **Standalone prototype** — application data is entered manually. A production version would pull it directly from COLA instead.
- **Bold detection is approximate.** Whether `GOVERNMENT WARNING:` is bold in a *photograph* is a visual judgment call; the AI assesses it and the UI flags it as such. Digital label artwork files would make this deterministic.
- **One label panel per photo.** Multi-panel/wraparound labels would need multi-image support.
- **No data is stored.** Images are processed in memory and never persisted — nothing sensitive is retained (per IT guidance for the prototype).
- **Batch upload not built** (peak-season importers submit 200–300 at once). The architecture supports it cleanly — the extraction endpoint is stateless, so a batch UI would queue images through it and render a summary table. Scoped out to keep the core flow polished within the time budget.

## Production Considerations

If this moved beyond prototype in Treasury's environment:

- **FedRAMP / Azure:** Treasury is on Azure; the Claude API is available through FedRAMP-authorized cloud endpoints, and the extraction call is isolated behind one function, so swapping providers/endpoints is a one-file change.
- **Network restrictions:** TTB's firewall blocks many outbound domains (this killed features in the last vendor pilot). The single egress point (one AI API host) makes allowlisting simple; an on-premise vision model is a fallback for fully restricted segments.
- **COLA integration:** replace the manual form with a COLA lookup by application ID.
- **Batch processing:** queue + worker for peak-season bulk submissions, with a summary dashboard.
- **Audit trail:** log every verification (inputs, results, agent decision) for compliance records.
- **Retention/PII:** apply federal records schedules before storing any submission data.

## Author

Anthony Harley — anthony.harley32@gmail.com
