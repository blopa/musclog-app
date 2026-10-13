import { useRef, useState } from 'react';

import {
  BODY_TEXT,
  brand,
  BRAND_GREEN,
  BRAND_GREEN_BRIGHT,
  brandBright,
  CARD_BG,
  INPUT_BG,
  INPUT_BORDER,
  MUTED,
} from '@/components/website/websiteColors';

import { ACCENT_RED } from './chartChannels';

// ── Drop zone component ─────────────────────────────────────────────────────

export function DropZone({
  accept,
  icon,
  label,
  hint,
  loadedLabel,
  isLoaded,
  error,
  onFile,
}: {
  accept: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
  loadedLabel: string;
  isLoaded: boolean;
  error?: string;
  onFile: (file: File) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      onFile(file);
    }
  };

  const borderColor = (() => {
    if (error) {
      return ACCENT_RED;
    }

    if (isLoaded) {
      return BRAND_GREEN;
    }

    return dragging ? BRAND_GREEN_BRIGHT : INPUT_BORDER;
  })();

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 transition-colors"
      style={{
        backgroundColor: dragging ? brandBright(0.06) : CARD_BG,
        borderColor,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            onFile(f);
          }
        }}
      />
      <div
        className="flex h-12 w-12 items-center justify-center rounded-xl"
        style={{
          backgroundColor: isLoaded ? brand(0.15) : INPUT_BG,
          border: `1px solid ${isLoaded ? brand(0.4) : INPUT_BORDER}`,
        }}
      >
        {icon}
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold" style={{ color: isLoaded ? BRAND_GREEN : BODY_TEXT }}>
          {isLoaded ? loadedLabel : label}
        </p>
        {!isLoaded ? (
          <p className="mt-1 text-xs" style={{ color: MUTED }}>
            {hint}
          </p>
        ) : null}
        {error ? (
          <p className="mt-1 text-xs" style={{ color: ACCENT_RED }}>
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
