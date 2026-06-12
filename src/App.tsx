import { useState } from "react";
import UploadStep from "./components/UploadStep";
import ReviewStep from "./components/ReviewStep";
import ResultsStep from "./components/ResultsStep";
import { prepareImage } from "./lib/image";
import { verify } from "./lib/compare";
import type { ApplicationData, ExtractedLabel, VerificationResult } from "./lib/types";

type Step = "upload" | "review" | "results";

const EMPTY_APPLICATION: ApplicationData = {
  brand_name: "",
  class_type: "",
  alcohol_content: "",
  net_contents: "",
  producer_name_address: "",
  country_of_origin: "",
};

const STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: "Upload Label" },
  { key: "review", label: "Enter Application Data" },
  { key: "results", label: "Verification Results" },
];

export default function App() {
  const [step, setStep] = useState<Step>("upload");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [extracted, setExtracted] = useState<ExtractedLabel | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [application, setApplication] = useState<ApplicationData>(EMPTY_APPLICATION);
  const [result, setResult] = useState<VerificationResult | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const prepared = await prepareImage(file);
      const res = await fetch("/api/extract-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: prepared.base64, mediaType: prepared.mediaType }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Something went wrong reading the label.");
      }
      setImageUrl(prepared.previewUrl);
      setExtracted(data.extracted);
      setElapsedMs(data.elapsedMs ?? null);
      setApplication(EMPTY_APPLICATION);
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function handleVerify() {
    if (!extracted) return;
    setResult(verify(extracted, application));
    setStep("results");
  }

  function handleRestart() {
    setStep("upload");
    setExtracted(null);
    setResult(null);
    setApplication(EMPTY_APPLICATION);
    setImageUrl("");
    setElapsedMs(null);
    setError(null);
  }

  const currentIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="min-h-screen">
      <header className="border-b-4 border-blue-900 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-900">
              U.S. Department of the Treasury · TTB
            </p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Label Verification Assistant</h1>
          </div>
          <div className="hidden text-right text-sm text-gray-400 sm:block">
            <p>Alcohol and Tobacco Tax</p>
            <p>and Trade Bureau</p>
          </div>
        </div>
      </header>

      {/* Step indicator */}
      <nav aria-label="Progress" className="mx-auto max-w-6xl px-6 pt-8">
        <ol className="flex items-center justify-center gap-2 sm:gap-4">
          {STEPS.map((s, i) => (
            <li key={s.key} className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2">
                <span
                  key={i < currentIndex ? "done" : "pending"}
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-base font-bold transition-colors duration-300 ${
                    i < currentIndex
                      ? "animate-pop bg-green-600 text-white"
                      : i === currentIndex
                        ? "bg-blue-700 text-white"
                        : "bg-gray-200 text-gray-500"
                  }`}
                  aria-current={i === currentIndex ? "step" : undefined}
                >
                  {i < currentIndex ? (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={3} aria-label="completed">
                      <path className="animate-check" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={`hidden text-base transition-colors duration-300 sm:inline ${i === currentIndex ? "font-semibold text-gray-900" : "text-gray-500"}`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <span
                  className={`h-px w-8 transition-colors duration-500 sm:w-16 ${i < currentIndex ? "bg-green-600" : "bg-gray-300"}`}
                  aria-hidden
                />
              )}
            </li>
          ))}
        </ol>
      </nav>

      <main className="mx-auto max-w-6xl px-6 py-10">
        {/* key on step remounts the wrapper so the fade-up plays on every transition */}
        <div key={step} className="animate-fade-up">
          {step === "upload" && <UploadStep onFile={handleFile} busy={busy} error={error} />}
          {step === "review" && extracted && (
            <ReviewStep
              imageUrl={imageUrl}
              extracted={extracted}
              application={application}
              onChange={setApplication}
              onVerify={handleVerify}
              onBack={handleRestart}
              elapsedMs={elapsedMs}
            />
          )}
          {step === "results" && result && (
            <ResultsStep result={result} imageUrl={imageUrl} onRestart={handleRestart} onEdit={() => setStep("review")} />
          )}
        </div>
      </main>

      <footer className="mx-auto max-w-6xl px-6 pb-10 text-sm text-gray-400">
        Prototype for assessment purposes — not an official TTB system.
      </footer>
    </div>
  );
}
