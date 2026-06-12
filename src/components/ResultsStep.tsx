
import type { MatchStatus, VerificationResult } from "../lib/types";

interface Props {
  result: VerificationResult;
  imageUrl: string;
  onRestart: () => void;
  onEdit: () => void;
}

const STATUS_DISPLAY: Record<MatchStatus, { label: string; classes: string; icon: string }> = {
  match: { label: "Match", classes: "bg-green-100 text-green-800 border-green-300", icon: "✓" },
  close: { label: "Review", classes: "bg-amber-100 text-amber-800 border-amber-300", icon: "≈" },
  mismatch: { label: "Mismatch", classes: "bg-red-100 text-red-800 border-red-300", icon: "✕" },
  missing: { label: "Not on label", classes: "bg-red-100 text-red-800 border-red-300", icon: "?" },
  not_provided: { label: "Not entered", classes: "bg-gray-100 text-gray-500 border-gray-200", icon: "–" },
};

export default function ResultsStep({ result, imageUrl, onRestart, onEdit }: Props) {
  const counted = result.fields.filter((f) => f.status !== "not_provided");
  const issues =
    counted.filter((f) => f.status === "mismatch" || f.status === "missing").length +
    (result.warning.status !== "pass" ? 1 : 0);
  const reviews = counted.filter((f) => f.status === "close").length;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Summary banner */}
      <div
        className={`mb-8 rounded-2xl border-2 p-6 text-center ${
          issues > 0
            ? "border-red-300 bg-red-50"
            : reviews > 0
              ? "border-amber-300 bg-amber-50"
              : "border-green-300 bg-green-50"
        }`}
        role="status"
      >
        <p className="text-3xl font-bold text-gray-900">
          {issues > 0 ? `${issues} issue${issues === 1 ? "" : "s"} found` : reviews > 0 ? "Looks good — minor differences to review" : "All checks passed"}
        </p>
        <p className="mt-2 text-lg text-gray-600">
          {issues > 0
            ? "Review the items marked in red below before approving this application."
            : reviews > 0
              ? "Items marked in yellow matched closely but not exactly — use your judgment."
              : "Every field on the label matches the application, and the Government Warning is compliant."}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div>
          {/* Field comparison table */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-sm uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3">Field</th>
                  <th className="px-5 py-3">On the Label</th>
                  <th className="px-5 py-3">On the Application</th>
                  <th className="px-5 py-3">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-base">
                {result.fields.map((f) => {
                  const d = STATUS_DISPLAY[f.status];
                  return (
                    <tr key={f.field}>
                      <td className="px-5 py-4 font-medium text-gray-700">{f.label}</td>
                      <td className="px-5 py-4 text-gray-900">{f.labelValue || <span className="text-gray-400">—</span>}</td>
                      <td className="px-5 py-4 text-gray-900">{f.applicationValue || <span className="text-gray-400">—</span>}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${d.classes}`}>
                          <span aria-hidden>{d.icon}</span> {d.label}
                        </span>
                        {f.note && <p className="mt-1.5 text-sm text-gray-500">{f.note}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Government warning section */}
          <div
            className={`mt-8 rounded-xl border-2 p-6 ${
              result.warning.status === "pass" ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full text-xl font-bold text-white ${
                  result.warning.status === "pass" ? "bg-green-600" : "bg-red-600"
                }`}
                aria-hidden
              >
                {result.warning.status === "pass" ? "✓" : "✕"}
              </span>
              <h3 className="text-xl font-bold text-gray-900">
                Government Health Warning — {result.warning.status === "pass" ? "Compliant" : result.warning.status === "missing" ? "MISSING" : "NON-COMPLIANT"}
              </h3>
            </div>

            {result.warning.violations.length > 0 && (
              <ul className="mt-4 space-y-2 pl-1">
                {result.warning.violations.map((v, i) => (
                  <li key={i} className="flex gap-2 text-base text-red-900">
                    <span aria-hidden className="mt-0.5 shrink-0">•</span> {v}
                  </li>
                ))}
              </ul>
            )}

            {result.warning.diff && result.warning.diff.some((d) => d.status !== "ok") && (
              <div className="mt-5 rounded-lg bg-white p-4 leading-relaxed">
                <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Wording check — differences highlighted
                </p>
                <p className="text-base">
                  {result.warning.diff.map((d, i) => {
                    if (d.status === "ok") return <span key={i}>{d.word} </span>;
                    if (d.status === "missing")
                      return (
                        <span key={i} className="rounded bg-amber-200 px-1 font-semibold text-amber-900" title="Missing from label">
                          [{d.word}]{" "}
                        </span>
                      );
                    if (d.status === "wrong")
                      return (
                        <span key={i} title={`Should be "${d.expected}"`}>
                          <span className="rounded bg-red-200 px-1 font-semibold text-red-900 line-through">{d.word}</span>
                          <span className="rounded bg-green-100 px-1 font-semibold text-green-900">{d.expected}</span>{" "}
                        </span>
                      );
                    return (
                      <span key={i} className="rounded bg-red-200 px-1 font-semibold text-red-900" title="Not in required text">
                        {d.word}{" "}
                      </span>
                    );
                  })}
                </p>
                <p className="mt-3 text-sm text-gray-400">
                  [bracketed] = required word missing from label · struck through = wrong word on label
                </p>
              </div>
            )}

            {result.warning.status === "pass" && (
              <p className="mt-3 text-base text-green-900">
                Exact statutory wording (27 CFR Part 16), &quot;GOVERNMENT WARNING:&quot; in all caps and bold.
              </p>
            )}
          </div>

          <p className="mt-6 text-base text-gray-500">
            This tool assists with routine matching — the final approval decision always rests with the reviewing agent.
          </p>

          <div className="mt-6 flex items-center gap-4">
            <button
              onClick={onRestart}
              className="rounded-xl bg-blue-700 px-8 py-4 text-xl font-semibold text-white shadow hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300"
            >
              Verify Another Label
            </button>
            <button onClick={onEdit} className="px-4 py-4 text-lg text-gray-500 underline underline-offset-4 hover:text-gray-700">
              Edit application data
            </button>
          </div>
        </div>

        {/* Right: label image for reference */}
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Label</h3>
          <img src={imageUrl} alt="Verified alcohol label" className="w-full rounded-xl border border-gray-200 shadow-sm" />
        </div>
      </div>
    </div>
  );
}
