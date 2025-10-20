"use client";

import { useMemo, useState } from "react";
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview,
  SandpackFileExplorer,
} from "@codesandbox/sandpack-react";
import type { SandpackFiles } from "@codesandbox/sandpack-react";
import {
  Loader2Icon,
  RefreshCcwIcon,
  StopCircleIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type PreviewPanelProps = {
  files: Record<string, string>;
  isLoading: boolean;
  lastPrompt?: string | null;
  onRefresh?: () => void;
  onStop?: () => void;
  disabledRefresh?: boolean;
};

const BASE_SANDBOX_FILES: SandpackFiles = {};

export function PreviewPanel({
  files,
  isLoading,
  lastPrompt,
  onRefresh,
  onStop,
  disabledRefresh,
}: PreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");
  const normalizedFiles = useMemo<SandpackFiles>(() => {
    if (!files) {
      return {};
    }

    return Object.entries(files).reduce<SandpackFiles>(
      (acc, [path, content]) => {
        acc[path.startsWith("/") ? path : `/${path}`] = content;
        return acc;
      },
      {}
    );
  }, [files]);

  const sandpackFiles = useMemo<SandpackFiles>(() => {
    const merged: SandpackFiles = { ...BASE_SANDBOX_FILES };

    Object.entries(normalizedFiles).forEach(([path, content]) => {
      merged[path] = content;
    });

    const hasUserAppJs = Object.prototype.hasOwnProperty.call(
      normalizedFiles,
      "/App.js"
    );

    if (!hasUserAppJs) {
      const fallbackAppPath =
        [
          "/App.jsx",
          "/App.tsx",
          "/App.ts",
          "/src/App.jsx",
          "/src/App.tsx",
          "/src/App.ts",
        ].find((candidate) =>
          Object.prototype.hasOwnProperty.call(merged, candidate)
        ) ?? null;

      if (fallbackAppPath) {
        merged["/App.js"] = {
          code: `export { default } from "${fallbackAppPath.replace(
            /^\//,
            "./"
          )}";`,
          hidden: true,
        };
      } else {
        merged["/App.js"] = {
          code: `export default function App() {
  return null;
}
`,
          hidden: true,
        };
      }
    }

    return merged;
  }, [normalizedFiles]);

  const sandpackKey = useMemo(() => {
    const entries = Object.entries(normalizedFiles);
    if (entries.length === 0) {
      return "empty";
    }

    return entries
      .map(([path, content]) => {
        if (typeof content === "string") {
          return `${path}:${content.length}`;
        }

        if (content && typeof content === "object" && "code" in content) {
          const code = typeof content.code === "string" ? content.code : "";
          return `${path}:${code.length}`;
        }

        return `${path}:0`;
      })
      .sort()
      .join("|");
  }, [normalizedFiles]);

  const refreshDisabled = Boolean(disabledRefresh) || isLoading || !onRefresh;
  const hasStopAction = typeof onStop === "function";
  const stopDisabled = !isLoading || !hasStopAction;
  const workspaceFileCount = useMemo(
    () => Object.keys(normalizedFiles).length,
    [normalizedFiles]
  );
  const previewLabel = lastPrompt
    ? `Last prompt: ${lastPrompt}`
    : workspaceFileCount > 0
      ? `Synced ${workspaceFileCount} workspace file${
          workspaceFileCount === 1 ? "" : "s"
        }`
      : isLoading
        ? "Syncing workspace files"
        : "Workspace sync pending";
  const refreshTooltip = refreshDisabled
    ? isLoading
      ? "Sync in progress"
      : "Workspace sync unavailable"
    : "Sync workspace files";
  const displayLabel =
    previewLabel.length > 96 ? `${previewLabel.slice(0, 93)}...` : previewLabel;

  return (
    <div className="relative flex h-full flex-1 flex-col border-l border-border bg-background/50 text-sm text-muted-foreground">
      <div className="flex items-center gap-3 border-b border-border/70 px-6 py-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-full border border-border/80 text-muted-foreground hover:text-foreground"
              onClick={onRefresh}
              disabled={refreshDisabled}
            >
              <RefreshCcwIcon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent align="start">{refreshTooltip}</TooltipContent>
        </Tooltip>
        {hasStopAction && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 rounded-full border border-border/80 text-muted-foreground hover:text-foreground"
                onClick={onStop}
                disabled={stopDisabled}
              >
                <StopCircleIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent align="start">Stop generation</TooltipContent>
          </Tooltip>
        )}
        {/* Tabs: Preview | Code */}
        <div className="flex items-center gap-1 rounded-full border border-border/70 bg-background/60 p-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 rounded-full px-3 text-xs",
              activeTab === "preview"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setActiveTab("preview")}
          >
            Preview
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 rounded-full px-3 text-xs",
              activeTab === "code"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setActiveTab("code")}
          >
            Code
          </Button>
        </div>
        <div className="relative flex-1">
          <Input
            placeholder="Your Tailwind UI will render here"
            className="w-full rounded-full border border-border/70 bg-background/60 px-5 py-2.5 text-sm text-muted-foreground shadow-inner focus-visible:ring-0"
            value={displayLabel}
            title={previewLabel}
            readOnly
          />
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs text-muted-foreground/70">
            {isLoading ? "Generating" : lastPrompt ? "Updated" : "Idle"}
          </span>
        </div>
      </div>
      <div className="relative flex flex-1 flex-col overflow-hidden px-4 py-4">
        <div className="flex h-full flex-1 overflow-hidden rounded-2xl border border-border/80 bg-background">
          <SandpackProvider
            key={sandpackKey}
            template="react"
            files={sandpackFiles}
            options={{ externalResources: ["https://cdn.tailwindcss.com"] }}
            className="flex-1"
            style={{ flex: 1 }}
          >
            <div className="relative flex h-full w-full">
              <div
                className={cn(
                  "h-full w-full flex-1",
                  activeTab !== "preview" && "hidden"
                )}
              >
                <SandpackPreview style={{ width: "100%", height: "100%" }} />
              </div>
              {activeTab === "code" && (
                <SandpackLayout
                  className="flex-1"
                  style={{ width: "100%", height: "100%" }}
                >
                  <SandpackFileExplorer style={{ minWidth: 180 }} />
                  <SandpackCodeEditor
                    showTabs
                    showLineNumbers
                    wrapContent
                    readOnly
                    style={{ height: "100%" }}
                  />
                </SandpackLayout>
              )}
            </div>
          </SandpackProvider>
        </div>
        {isLoading && (
          <div className="absolute inset-4 flex items-center justify-center rounded-2xl border border-dashed border-border/60 bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <Loader2Icon className="h-4 w-4 animate-spin" />
              Generating preview
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
