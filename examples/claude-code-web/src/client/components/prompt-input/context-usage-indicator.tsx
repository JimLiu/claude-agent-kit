import { useEffect, useRef, useState } from "react";

const CONTAINER_CLASS = "relative";
const USAGE_BUTTON_CLASS =
  "inline-flex items-center gap-1 rounded-sm border-0 bg-transparent px-1 py-[2px] text-[0.85em] text-muted-foreground hover:bg-muted";
const PIE_CLASS = "shrink-0 text-muted-foreground";
const VALUE_CLASS = "tabular-nums";
const POPUP_CLASS =
  "absolute bottom-full right-0 z-[1000] mb-2 min-w-[200px] rounded border border-border bg-background text-left shadow-[0_4px_12px_rgba(0,0,0,0.15)]";
const POPUP_CONTENT_CLASS = "flex flex-col gap-0 p-2";
const REMAINING_TEXT_CLASS =
  "text-[0.9em] text-foreground";
const COMPACT_HINT_CLASS =
  "mt-1 text-[0.85em] text-muted-foreground";

export interface ContextUsageIndicatorProps {
  usedTokens: number;
  contextWindow: number;
  onCompact: () => void;
}

export function ContextUsageIndicator({
  usedTokens,
  contextWindow,
  onCompact,
}: ContextUsageIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (showTooltip && tooltipRef.current) {
      const element = tooltipRef.current;
      const bounds = element.getBoundingClientRect();
      if (bounds.left < 0) {
        element.style.left = "0";
        element.style.right = "auto";
      } else if (bounds.right > window.innerWidth) {
        element.style.left = "auto";
        element.style.right = "0";
      }
    }
  }, [showTooltip]);

  const remainingPercentage =
    contextWindow > 0 ? Math.max(0, 100 - (usedTokens / contextWindow) * 100) : 0;

  const size = 12;
  const radius = size / 2;
  const progressAngle = (remainingPercentage / 100) * 360;
  const radians = ((progressAngle - 90) * Math.PI) / 180;
  const x = radius + radius * Math.cos(radians);
  const y = radius + radius * Math.sin(radians);
  const largeArcFlag = progressAngle > 180 ? 1 : 0;
  const path =
    remainingPercentage === 0
      ? ""
      : `M ${radius} ${radius} L ${radius} 0 A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x} ${y} Z`;

  if (contextWindow === 0 || remainingPercentage >= 50) {
    return null;
  }

  return (
    <div className={CONTAINER_CLASS}>
      <button
        type="button"
        className={USAGE_BUTTON_CLASS}
        onClick={onCompact}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className={PIE_CLASS}
        >
          <circle
            cx={radius}
            cy={radius}
            r={radius}
            fill="currentColor"
            opacity="0.2"
          />
          {remainingPercentage > 0 && (
            <path d={path} fill="currentColor" />
          )}
        </svg>
        <span className={VALUE_CLASS}>
          {Math.round(remainingPercentage)}%
        </span>
      </button>
      {showTooltip && (
        <div className={POPUP_CLASS} ref={tooltipRef}>
          <div className={POPUP_CONTENT_CLASS}>
            <div className={REMAINING_TEXT_CLASS}>
              {Math.round(remainingPercentage)}% of context remaining until
              auto-compact.
            </div>
            <div className={COMPACT_HINT_CLASS}>Click to compact now.</div>
          </div>
        </div>
      )}
    </div>
  );
}
