import { useCallback, useEffect, useRef, useState } from 'react';

import { CARD_BG, CARD_BORDER, MUTED } from '@/components/website/websiteColors';
import type { ChannelKey, ChartData, RepMarker } from '@/utils/repMarkerData';

import { CHART_COLORS, CHART_LABELS } from './chartChannels';
import { drawChart, PADDING } from './drawChart';

// ── Chart panel (one canvas; shares video cursor + markers with siblings) ─────

export function ChartPanel({
  title,
  subtitle,
  seekHint,
  chartData,
  channelKeys,
  defaultVisible,
  markers,
  pendingStartMs,
  videoRef,
}: {
  title: string;
  subtitle: string;
  seekHint: string;
  chartData: ChartData;
  channelKeys: ChannelKey[];
  defaultVisible: ChannelKey[];
  markers: RepMarker[];
  pendingStartMs: number | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const [visible, setVisible] = useState<Record<ChannelKey, boolean>>(() => {
    const initial = {} as Record<ChannelKey, boolean>;
    for (const key of channelKeys) {
      initial[key] = defaultVisible.includes(key);
    }
    return initial;
  });

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    const cursorMs = (videoRef.current?.currentTime ?? 0) * 1000;
    drawChart(
      ctx,
      canvas.width / window.devicePixelRatio,
      canvas.height / window.devicePixelRatio,
      chartData,
      channelKeys,
      markers,
      pendingStartMs,
      cursorMs,
      visible
    );
  }, [chartData, channelKeys, markers, pendingStartMs, visible, videoRef]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // rAF loop drives the cursor during playback.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const startLoop = () => {
      const loop = () => {
        redraw();
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    };
    const stopLoop = () => {
      cancelAnimationFrame(rafRef.current);
      redraw();
    };
    video.addEventListener('play', startLoop);
    video.addEventListener('pause', stopLoop);
    video.addEventListener('ended', stopLoop);
    video.addEventListener('seeked', redraw);
    return () => {
      video.removeEventListener('play', startLoop);
      video.removeEventListener('pause', stopLoop);
      video.removeEventListener('ended', stopLoop);
      video.removeEventListener('seeked', redraw);
      cancelAnimationFrame(rafRef.current);
    };
  }, [redraw, videoRef]);

  // Keep canvas backing store sized to its CSS box.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const observer = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      redraw();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [redraw]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const fraction =
      (e.clientX - rect.left - PADDING.left) / (rect.width - PADDING.left - PADDING.right);
    const span = chartData.domainMaxMs - chartData.domainMinMs;
    const relMs = chartData.domainMinMs + Math.max(0, Math.min(1, fraction)) * span;
    video.currentTime = Math.max(0, relMs / 1000);
  };

  return (
    <div
      className="flex flex-col rounded-2xl border p-3"
      style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}
    >
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-sm font-bold text-text-primary">{title}</span>
        <span className="truncate text-xs" style={{ color: MUTED }}>
          {subtitle}
        </span>
      </div>
      {/* Channel legend */}
      <div className="mb-2 flex flex-wrap items-center gap-3">
        {channelKeys.map((ch) => (
          <button
            key={ch}
            type="button"
            onClick={() => setVisible((prev) => ({ ...prev, [ch]: !prev[ch] }))}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold transition-opacity"
            style={{
              color: visible[ch] ? CHART_COLORS[ch] : MUTED,
              opacity: visible[ch] ? 1 : 0.4,
            }}
          >
            <span
              className="inline-block h-2 w-4 rounded-full"
              style={{ backgroundColor: CHART_COLORS[ch] }}
            />
            {CHART_LABELS[ch]}
          </button>
        ))}
        <span className="ml-auto text-xs" style={{ color: MUTED }}>
          {seekHint}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="w-full cursor-crosshair rounded-xl"
        style={{ height: 220 }}
      />
    </div>
  );
}
