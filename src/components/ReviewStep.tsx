
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
  alcohol_content: "e.g. 10%",
  net_contents: "e.g. 12 fl. oz.",
  producer_name_address: "e.g. Old Tom Distillery, Louisville, KY",
  country_of_origin: "Leave blank for domestic products",
};

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
            {FIELD_ORDER.map((f) => (
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
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg text-gray-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            ))}

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
