
import { useCallback, useRef, useState } from "react";

interface Props {
  onFile: (file: File) => void;
  busy: boolean;
  error: string | null;
}

export default function UploadStep({ onFile, busy, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  return (
    <div className="mx-auto max-w-2xl">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a label photo"
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !busy) inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl px-8 py-20 text-center transition-colors ${
          dragging ? "bg-blue-50" : "bg-white hover:bg-blue-50/50"
        } ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        {/* SVG outline instead of border-dashed so dash length is controllable */}
        <svg aria-hidden className={`pointer-events-none absolute inset-0 h-full w-full transition-colors ${dragging ? "text-blue-600" : "text-gray-300 group-hover:text-blue-400"}`}>
          <rect
            x="1"
            y="1"
            rx="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="16 12"
            style={{ width: "calc(100% - 2px)", height: "calc(100% - 2px)" }}
          />
        </svg>
        {busy ? (
          <>
            <div className="mb-6 h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            <p className="text-2xl font-semibold text-gray-800">Reading the label…</p>
            <p className="mt-2 text-lg text-gray-500">This usually takes a few seconds</p>
          </>
        ) : (
          <>
            <svg className="mb-6 h-16 w-16 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-2xl font-semibold text-gray-800">Upload Label Photo</p>
            <p className="mt-3 text-lg text-gray-500">Click here or drag a photo of the bottle label into this box</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 text-lg text-red-800" role="alert">
          {error}
        </div>
      )}

    </div>
  );
}
