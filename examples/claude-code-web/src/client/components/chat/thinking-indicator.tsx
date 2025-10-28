import React, { useEffect, useRef, useState } from "react";
import type { PermissionMode } from "@anthropic-ai/claude-agent-sdk";

const SPINNER_BASE_FRAMES = ["·", "✢", "*", "✶", "✻", "✽"] as const;
const SPINNER_FRAMES = [
  ...SPINNER_BASE_FRAMES,
  ...[...SPINNER_BASE_FRAMES].reverse(),
] as const;

const STATUS_WORDS = [
  "Accomplishing",
  "Actioning",
  "Actualizing",
  "Baking",
  "Booping",
  "Brewing",
  "Calculating",
  "Cerebrating",
  "Channelling",
  "Churning",
  "Clauding",
  "Coalescing",
  "Cogitating",
  "Computing",
  "Combobulating",
  "Concocting",
  "Considering",
  "Contemplating",
  "Cooking",
  "Crafting",
  "Creating",
  "Crunching",
  "Deciphering",
  "Deliberating",
  "Determining",
  "Discombobulating",
  "Doing",
  "Effecting",
  "Elucidating",
  "Enchanting",
  "Envisioning",
  "Finagling",
  "Flibbertigibbeting",
  "Forging",
  "Forming",
  "Frolicking",
  "Generating",
  "Germinating",
  "Hatching",
  "Herding",
  "Honking",
  "Ideating",
  "Imagining",
  "Incubating",
  "Inferring",
  "Manifesting",
  "Marinating",
  "Meandering",
  "Moseying",
  "Mulling",
  "Mustering",
  "Musing",
  "Noodling",
  "Percolating",
  "Perusing",
  "Philosophising",
  "Pontificating",
  "Pondering",
  "Processing",
  "Puttering",
  "Puzzling",
  "Reticulating",
  "Ruminating",
  "Scheming",
  "Schlepping",
  "Shimmying",
  "Simmering",
  "Smooshing",
  "Spelunking",
  "Spinning",
  "Stewing",
  "Sussing",
  "Synthesizing",
  "Thinking",
  "Tinkering",
  "Transmuting",
  "Unfurling",
  "Unravelling",
  "Vibing",
  "Wandering",
  "Whirring",
  "Wibbling",
  "Working",
  "Wrangling",
] as const;

const MAX_STATUS_WORD_LENGTH = Math.max(
  ...STATUS_WORDS.map((word) => word.length),
);

const REVEAL_WINDOW = 3;
const FRAME_INTERVAL_MS = 120;

export interface ThinkingIndicatorProps {
  size?: number;
  permissionMode?: PermissionMode | string;
}

export function ThinkingIndicator({
  size = 16,
  permissionMode,
}: ThinkingIndicatorProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [statusWord, setStatusWord] = useState(pickRandom(STATUS_WORDS));

  useEffect(() => {
    const interval = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % SPINNER_FRAMES.length);
    }, FRAME_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useDynamicTimeoutLoop(
    () => {
      setStatusWord(pickRandom(STATUS_WORDS));
    },
    (iteration) => {
      const delays = [2000, 3000, 5000];
      return iteration < delays.length ? delays[iteration] : 5000;
    },
  );

  const animatedStatus = useAnimatedTickerText(
    `${statusWord}...`,
    MAX_STATUS_WORD_LENGTH + 3,
  );

  const iconColorClass =
    permissionMode === "acceptEdits"
      ? "text-slate-100"
      : permissionMode === "plan"
        ? "text-indigo-300"
        : "text-indigo-400";

  return (
    <div
      className="inline-flex items-center gap-1"
      data-permission-mode={permissionMode}
    >
      <span
        className={`inline-block w-6 shrink-0 text-center font-mono text-lg ${iconColorClass}`}
        style={{ fontSize: `${size}px` }}
        data-permission-mode={permissionMode}
      >
        {SPINNER_FRAMES[frameIndex]}
      </span>
      <span className="font-medium tracking-tight">
        {animatedStatus}
      </span>
    </div>
  );
}

function useDynamicTimeoutLoop(
  callback: () => void,
  getDelay: (iteration: number) => number | null,
) {
  const callbackRef = useRef(callback);
  const delayRef = useRef(getDelay);
  const iterationRef = useRef(0);
  const timerRef = useRef(0);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    delayRef.current = getDelay;
  }, [getDelay]);

  useEffect(() => {
    iterationRef.current = 0;

    function tick() {
      callbackRef.current();
      const delay = delayRef.current(iterationRef.current);
      iterationRef.current += 1;
      if (delay !== null) {
        timerRef.current = window.setTimeout(tick, delay);
      }
    }

    const initialDelay = delayRef.current(0);
    iterationRef.current = 1;
    if (initialDelay !== null) {
      timerRef.current = window.setTimeout(tick, initialDelay);
    }

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);
}

function useAnimatedTickerText(target: string, minLength: number) {
  const [displayText, setDisplayText] = useState(() =>
    " ".repeat(Math.max(minLength, target.length)),
  );
  const animationState = useRef({
    index: 0,
    targetText: padToLength(target, minLength),
  });

  useEffect(() => {
    animationState.current.index = 0;
    animationState.current.targetText = padToLength(target, minLength);

    let animationFrame: number | null = null;
    let lastTimestamp = 0;

    const step = (timestamp: number) => {
      if (timestamp - lastTimestamp < 40) {
        animationFrame = window.requestAnimationFrame(step);
        return;
      }

      lastTimestamp = timestamp;
      const currentIndex = animationState.current.index;

      if (currentIndex - REVEAL_WINDOW >= animationState.current.targetText.length) {
        animationFrame = null;
        return;
      }

      animationState.current.index += 1;

      setDisplayText((previous) => {
        let next = previous;
        for (let phase = 0; phase <= REVEAL_WINDOW; phase += 1) {
          const charIndex = currentIndex - phase;
          if (
            charIndex >= 0 &&
            charIndex < animationState.current.targetText.length
          ) {
            const previousChar = previous[charIndex] ?? " ";
            const targetChar = animationState.current.targetText[charIndex];
            next = replaceCharacter(
              next,
              charIndex,
              animateCharacter(previousChar, targetChar, phase),
            );
          }
        }
        return next;
      });

      animationFrame = window.requestAnimationFrame(step);
    };

    animationFrame = window.requestAnimationFrame(step);

    return () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [target, minLength]);

  return displayText;
}

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function padToLength(value: string, minLength: number) {
  return value.length >= minLength
    ? value
    : `${value}${" ".repeat(minLength - value.length)}`;
}

function replaceCharacter(source: string, index: number, value: string) {
  if (index < 0 || index >= source.length) {
    return source;
  }
  return `${source.slice(0, index)}${value}${source.slice(index + 1)}`;
}

function animateCharacter(
  previousChar: string,
  targetChar: string,
  phase: number,
) {
  if (targetChar === " ") {
    return " ";
  }

  switch (phase) {
    case 3:
      return targetChar;
    case 2:
    case 1:
      return pickRandom([".", "_", targetChar]);
    default:
      return "▌";
  }
}
