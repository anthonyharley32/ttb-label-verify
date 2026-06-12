
import type { ApplicationData, ExtractedLabel } from "../lib/types";
import { FIELD_LABELS } from "../lib/constants";

interface Props {
  imageUrl: string;
  extracted: ExtractedLabel;
  application: ApplicationData;
  onChange: (data: ApplicationData) => void;
  onVerify: () => void;
  onBack: () => void;
  elapsedMs: number | null;
}

const FIELD_ORDER: (keyof ApplicationData)[] = [
  "brand_name",
  "class_type",
  "alcohol_content",
  "net_contents",
  "producer_name_address",
  "country_of_origin",
];

const PLACEHOLDERS: Record<keyof ApplicationData, string> = {
  brand_name: "e.g. Old Tom Distillery",
  class_type: "e.g. Premium Malt Lager",
  alcohol_content: "e.g. 5",
  net_contents: "e.g. 12",
  producer_name_address: "e.g. Old Tom Distillery, Louisville, KY",
  country_of_origin: "Leave blank for domestic products",
};

const NET_UNITS = ["fl. oz.", "mL", "L", "cl"] as const;

/** Split a stored net-contents string ("12 fl. oz.", "750 mL") into amount + unit. */
function parseNetParts(value: string): { amount: string; unit: (typeof NET_UNITS)[number] } {
  const m = value.match(/^\s*([\d.]*)\s*(.*)$/);
  const amount = m?.[1] ?? "";
  const unitRaw = (m?.[2] ?? "").trim().toLowerCase().replace(/[.\s]/g, "");
  let unit: (typeof NET_UNITS)[number] = "fl. oz.";
  if (unitRaw.startsWith("ml") || unitRaw.startsWith("millilit")) unit = "mL";
  else if (unitRaw.startsWith("cl") || unitRaw.startsWith("centilit")) unit = "cl";
  else if (unitRaw === "l" || unitRaw.startsWith("lit")) unit = "L";
  return { amount, unit };
}

const inputClasses =
  "w-full rounded-lg border border-gray-300 px-4 py-3 text-lg text-gray-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200";

export default function ReviewStep({ imageUrl, extracted, application, onChange, onVerify, onBack, elapsedMs }: Props) {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left: label image + what the AI read */}
        <div>
          <h2 className="mb-3 text-xl font-semibold text-gray-800">Label Photo</h2>
          <img src={imageUrl} alt="Uploaded alcohol label" className="w-full rounded-xl border border-gray-200 shadow-sm" />
          {elapsedMs !== null && (
            <p className="mt-2 text-sm text-gray-400">Analyzed in {(elapsedMs / 1000).toFixed(1)} seconds</p>
          )}
          {extracted.confidence_notes && (
            <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900" role="note">
              <p className="font-semibold">Image quality note</p>
              <p className="mt-1">{extracted.confidence_notes}</p>
            </div>
          )}
          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-3 font-semibold text-gray-700">What the AI read from the label</h3>
            <dl className="space-y-2 text-base">
              {FIELD_ORDER.map((f) => (
                <div key={f} className="flex gap-2">
                  <dt className="w-44 shrink-0 text-gray-500">{FIELD_LABELS[f]}:</dt>
                  <dd className="font-medium text-gray-900">
                    {extracted[f] || <span className="font-normal text-gray-400">not found</span>}
                  </dd>
                </div>
              ))}
              <div className="flex gap-2">
                <dt className="w-44 shrink-0 text-gray-500">Gov. Warning:</dt>
                <dd className="font-medium text-gray-900">
                  {extracted.government_warning.present ? "Found on label" : <span className="text-red-600">Not found</span>}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Right: application data form */}
        <div>
          <h2 className="mb-3 text-xl font-semibold text-gray-800">Application Data</h2>
          <p className="mb-5 text-gray-500">
            Enter what the applicant claimed on their COLA form. The tool will compare it against the label.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onVerify();
            }}
            className="space-y-5"
          >
            {FIELD_ORDER.map((f) => {
              if (f === "alcohol_content") {
                // Fixed % suffix — agents type just the number, no format guessing
                const shown = application.alcohol_content.replace(/%\s*$/, "");
                return (
                  <div key={f}>
                    <label htmlFor={f} className="mb-1 block text-base font-medium text-gray-700">
                      {FIELD_LABELS[f]}
                    </label>
                    <div className="relative w-44">
                      <input
                        id={f}
                        type="text"
                        inputMode="decimal"
                        value={shown}
                        placeholder={PLACEHOLDERS[f]}
                        onChange={(e) => {
                          const v = e.target.value.replace(/%/g, "").trim();
                          onChange({ ...application, alcohol_content: v ? `${v}%` : "" });
                        }}
                        className={`${inputClasses} pr-10`}
                      />
                      <span aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-lg text-gray-400">
                        %
                      </span>
                    </div>
                  </div>
                );
              }
              if (f === "net_contents") {
                const { amount, unit } = parseNetParts(application.net_contents);
                const update = (nextAmount: string, nextUnit: string) =>
                  onChange({ ...application, net_contents: nextAmount.trim() ? `${nextAmount.trim()} ${nextUnit}` : "" });
                return (
                  <div key={f}>
                    <label htmlFor={f} className="mb-1 block text-base font-medium text-gray-700">
                      {FIELD_LABELS[f]}
                    </label>
                    <div className="flex gap-2">
                      <input
                        id={f}
                        type="text"
                        inputMode="decimal"
                        value={amount}
                        placeholder={PLACEHOLDERS[f]}
                        onChange={(e) => update(e.target.value, unit)}
                        className={`${inputClasses} w-44`}
                      />
                      <select
                        aria-label="Net contents unit"
                        value={unit}
                        onChange={(e) => update(amount, e.target.value)}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-3 text-lg text-gray-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      >
                        {NET_UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              }
              return (
                <div key={f}>
                  <label htmlFor={f} className="mb-1 block text-base font-medium text-gray-700">
                    {FIELD_LABELS[f]}
                    {f === "country_of_origin" && <span className="ml-2 font-normal text-gray-400">(imports only)</span>}
                  </label>
                  <input
                    id={f}
                    type="text"
                    value={application[f]}
                    placeholder={PLACEHOLDERS[f]}
                    onChange={(e) => onChange({ ...application, [f]: e.target.value })}
                    className={inputClasses}
                  />
                </div>
              );
            })}

            <div className="flex items-center gap-4 pt-4">
              <button
                type="submit"
                className="rounded-xl bg-blue-700 px-8 py-4 text-xl font-semibold text-white shadow hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300"
              >
                Verify Label
              </button>
              <button type="button" onClick={onBack} className="px-4 py-4 text-lg text-gray-500 underline underline-offset-4 hover:text-gray-700">
                Start over
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
