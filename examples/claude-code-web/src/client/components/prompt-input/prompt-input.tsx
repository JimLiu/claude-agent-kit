import {
  ClipboardEvent,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import { useMentionAndSlash } from "../../hooks/use-mention-slash";
import { useMessageHistory } from "../../hooks/use-message-history";
import {
  replaceRangeWithValue,
  removeRange,
} from "@/lib/mention-utils";
import {
  PermissionMode,
  ClaudeModelOption,
  SelectionInfo,
  ThinkingLevel,
  UsageData,
  UserMessage,
} from "@/types/session";
import { cn } from "@/lib/utils";
import { CommandMenu, CommandRegistry } from "./command-menu";
import {
  MentionFileList,
  FileSuggestion,
} from "./mention-file-list";
import { ModelPicker } from "./model-picker";
import { PromptInputFooter } from "./prompt-input-footer";
import { AttachmentChip } from "../chat/attachment-chip";

export interface AttachedFile {
  file: File;
}

interface CommandRegistryWithActions extends CommandRegistry {
  registerAction: (
    action: { id: string; label: string },
    section: string,
    handler: () => void,
  ) => void;
  executeCommand: (id: string) => void;
}

export interface PromptContext {
  commandRegistry: CommandRegistryWithActions;
  safeFocus: (element: HTMLElement) => void;
  supportsSpeechRecognition: boolean;
}

export interface PromptInputProps {
  messages: UserMessage[];
  permissionMode: PermissionMode;
  onPermissionModeChange: (mode: PermissionMode) => void;
  isBusy: boolean;
  usageData: UsageData;
  thinkingLevel: ThinkingLevel;
  onThinkingLevelChange: (level: ThinkingLevel) => void;
  availableModels?: ClaudeModelOption[];
  currentModel?: string | null;
  selection: SelectionInfo | null;
  onInterrupt: () => void;
  onSubmit: (message: string, attachments: AttachedFile[]) => void | Promise<void>;
  context: PromptContext;
  placeholder?: string;
  onListFiles: (query: string) => Promise<FileSuggestion[]>;
  attachedFiles?: AttachedFile[];
  onRemoveFile: (index: number) => void;
  onAddFiles: (files: FileList) => void;
  includeSelection: boolean;
  onToggleIncludeSelection: () => void;
  onModelSelected: (model: ClaudeModelOption) => void;
}

export interface PromptInputHandle {
  focus: () => void;
  insertAtMention: (mention: string, appendSpace: boolean) => void;
}

const PERMISSION_MODES: PermissionMode[] = [
  "default",
  "acceptEdits",
  "plan",
];

function getSpeechRecognitionConstructor(): (() => any) | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  );
}

const PLACEHOLDER_CANDIDATES = ["Ask Claude..."];
const BUSY_PLACEHOLDER = "Queue another message...";
const MAX_MESSAGE_LENGTH = 50_000;

export const PromptInput = forwardRef<PromptInputHandle, PromptInputProps>(
  (
    {
      messages,
      permissionMode,
      onPermissionModeChange,
      isBusy,
      usageData,
      thinkingLevel,
      onThinkingLevelChange,
      availableModels,
      currentModel,
      selection,
      onInterrupt,
      onSubmit,
      context,
      placeholder,
      onListFiles,
      attachedFiles = [],
      onRemoveFile,
      onAddFiles,
      includeSelection,
      onToggleIncludeSelection,
      onModelSelected,
    },
    ref,
  ) => {
    const [inputValue, setInputValue] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const [isMicSupported, setIsMicSupported] = useState(false);
    const [isCommandMenuOpen, setCommandMenuOpen] = useState(false);
    const [suppressCommandFilter, setSuppressCommandFilter] = useState(false);
    const [isModelPickerOpen, setModelPickerOpen] = useState(false);

    const editableRef = useRef<HTMLDivElement | null>(null);
    const recognitionRef = useRef<any | null>(null);
    const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number>(0);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const amplitudeHistoryRef = useRef<number[]>([]);
    const audioPopupRef = useRef<HTMLDivElement | null>(null);
    const micButtonRef = useRef<HTMLButtonElement | null>(null);

    const actualPlaceholder = useMemo(() => {
      if (placeholder) {
        return placeholder;
      }
      const index = Math.floor(
        Math.random() * PLACEHOLDER_CANDIDATES.length,
      );
      return PLACEHOLDER_CANDIDATES[index];
    }, [placeholder]);

    const { atMention, slashCommand } = useMentionAndSlash(
      inputValue,
      editableRef.current,
    );

    const historyController = useMessageHistory({
      messages,
      currentInput: inputValue,
      onInputChange: setInputValue,
      editableRef,
    });

    useEffect(() => {
      const ctor = getSpeechRecognitionConstructor();
      setIsMicSupported(
        Boolean(ctor) &&
          typeof navigator !== "undefined" &&
          !!navigator.mediaDevices?.getUserMedia,
      );
    }, []);

    useEffect(() => {
      context.commandRegistry.registerAction(
        {
          id: "model",
          label: "Select model",
        },
        "Settings",
        () => {
          setModelPickerOpen(true);
        },
      );
    }, [context.commandRegistry]);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          if (editableRef.current) {
            context.safeFocus(editableRef.current);
          }
        },
        insertAtMention: (mention, appendSpace) => {
          if (appendSpace) {
            appendMentionAtEnd(mention);
          } else {
            insertMentionAtCursor(`${mention} `);
          }
        },
      }),
      [context],
    );

    useEffect(() => {
      if (editableRef.current && inputValue === "") {
        editableRef.current.textContent = "";
      }
    }, [inputValue]);

    useEffect(() => {
      if (slashCommand && !isCommandMenuOpen) {
        setCommandMenuOpen(true);
        setSuppressCommandFilter(true);
        setModelPickerOpen(false);
      } else if (!slashCommand && suppressCommandFilter) {
        setCommandMenuOpen(false);
        setSuppressCommandFilter(false);
        setModelPickerOpen(false);
      }
    }, [slashCommand, isCommandMenuOpen, suppressCommandFilter]);

    useEffect(() => {
      return () => {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
          recognitionRef.current = null;
        }

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }

        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
      };
    }, []);

    const appendMentionAtEnd = (text: string) => {
      if (!editableRef.current) {
        return;
      }
      const currentText = editableRef.current.textContent ?? "";
      const needsSpace = currentText.endsWith(" ") || currentText.length === 0 ? "" : " ";
      const updatedText = `${currentText}${needsSpace}${text}`;
      editableRef.current.textContent = updatedText;
      setInputValue(updatedText);

      const range = document.createRange();
      const selection = window.getSelection();
      range.selectNodeContents(editableRef.current);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);

      window.setTimeout(reportInputFromDom, 100);
    };

    const insertMentionAtCursor = (text: string) => {
      if (!editableRef.current) {
        return;
      }

      const selection = window.getSelection();
      const range = selection?.getRangeAt(0);
      if (selection && range) {
        const start = range.startOffset;
        const end = range.endOffset;
        const content = editableRef.current.textContent ?? "";
        const before = content.slice(0, start);
        const after = content.slice(end);
        const needsSpace =
          before.endsWith(" ") || before.length === 0 ? "" : " ";
        const updatedText = `${before}${needsSpace}${text}${after}`;
        editableRef.current.textContent = updatedText;
        setInputValue(updatedText);

        const container = editableRef.current.firstChild ?? editableRef.current;
        if (container) {
          const caret = document.createRange();
          const caretPosition =
            start + needsSpace.length + text.length;
          caret.setStart(container, Math.min(caretPosition, updatedText.length));
          caret.collapse(true);
          selection.removeAllRanges();
          selection.addRange(caret);
        }
      } else {
        appendMentionAtEnd(text);
      }

      window.setTimeout(reportInputFromDom, 100);
    };

    const reportInputFromDom = () => {
      const value = editableRef.current?.textContent ?? "";
      setInputValue(value);
    };

    const cyclePermissionMode = () => {
      const index =
        (PERMISSION_MODES.indexOf(permissionMode) + 1) %
        PERMISSION_MODES.length;
      const nextMode = PERMISSION_MODES[index];
      onPermissionModeChange(nextMode);
    };

    const toggleThinking = () => {
      const nextLevel = thinkingLevel === "off" ? "default_on" : "off";
      onThinkingLevelChange(nextLevel);
    };

    const closeOverlays = () => {
      setCommandMenuOpen(false);
      setSuppressCommandFilter(false);
      setModelPickerOpen(false);
    };

    const handleToggleCommandMenu = () => {
      setSuppressCommandFilter(false);
      setCommandMenuOpen((value) => !value);
      setModelPickerOpen(false);
    };

    const handleSubmit = (event?: FormEvent) => {
      event?.preventDefault();
      const text = editableRef.current?.textContent?.trim() ?? "";
      if (!text) {
        return;
      }

      let payload = text;
      if (text.length > MAX_MESSAGE_LENGTH) {
        payload =
          text.slice(0, MAX_MESSAGE_LENGTH) +
          `\n\n[Message truncated - exceeded 50,000 character limit]`;
      }

      setInputValue("");
      if (editableRef.current) {
        editableRef.current.textContent = "";
      }
      historyController.resetHistory();
      onSubmit(payload, attachedFiles);
    };

    const handleCompact = () => {
      onSubmit("/compact", []);
    };

    const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Tab" && event.shiftKey) {
        event.preventDefault();
        cyclePermissionMode();
        return;
      }

      if (event.key === "Escape") {
        if (atMention || slashCommand || isCommandMenuOpen || isModelPickerOpen) {
          event.preventDefault();
          setCommandMenuOpen(false);
          setSuppressCommandFilter(false);
          setModelPickerOpen(false);
        }
        return;
      }

      const navigatingOverlay =
        ((slashCommand && isCommandMenuOpen) || isModelPickerOpen) &&
        ["ArrowDown", "ArrowUp", "Enter", "Tab"].includes(event.key);

      if (navigatingOverlay || atMention) {
        return;
      }

      if (event.key === "ArrowUp" && !isCommandMenuOpen && !atMention) {
        if (historyController.cycleMessage(-1)) {
          event.preventDefault();
        }
        return;
      }

      if (event.key === "ArrowDown" && !isCommandMenuOpen && !atMention) {
        if (historyController.cycleMessage(1)) {
          event.preventDefault();
        }
        return;
      }

      if (event.key === "Enter" && !event.shiftKey) {
        if ((event.nativeEvent as any).isComposing) {
          return;
        }

        event.preventDefault();
        if (isRecording) {
          toggleSpeechRecognition();
          if (editableRef.current?.textContent?.trim()) {
            handleSubmit();
          }
        } else {
          handleSubmit();
        }
      }
    };

    const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
      const items = event.clipboardData?.items;
      if (!items) {
        return;
      }

      let containsFile = false;
      const files: File[] = [];
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            files.push(file);
            containsFile = true;
          }
        }
      }

      if (containsFile && files.length > 0) {
        event.preventDefault();
        const transfer = new DataTransfer();
        files.forEach((file) => transfer.items.add(file));
        onAddFiles(transfer.files);
      }
    };

    const handleMentionFileSelect = (file: FileSuggestion, triggeredByTab: boolean) => {
      if (!editableRef.current || !atMention) {
        return;
      }
      const isFile = !(triggeredByTab && file.type === "directory");
      const valueToInsert = isFile ? `${file.path} ` : file.path;
      const updatedText = replaceRangeWithValue(
        inputValue,
        atMention,
        valueToInsert,
        true,
      );
      editableRef.current.textContent = updatedText;
      setInputValue(updatedText);

      const targetNode =
        editableRef.current.firstChild ?? editableRef.current;
      if (targetNode) {
        const range = document.createRange();
        const offset =
          atMention.start + 1 + file.path.length + (isFile ? 1 : 0);
        range.setStart(targetNode, Math.min(offset, updatedText.length));
        range.collapse(true);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      context.safeFocus(editableRef.current);
    };

    const handleCommandSelect = (
      command: { id: string; label: string },
      triggeredByTab: boolean,
    ) => {
      setCommandMenuOpen(false);
      setSuppressCommandFilter(false);
      setModelPickerOpen(false);

      if (!editableRef.current) {
        return;
      }
      context.safeFocus(editableRef.current);

      const isSlashShortcut = command.label.startsWith("/");
      if (!slashCommand) {
        context.commandRegistry.executeCommand(command.id);
        return;
      }

      if (triggeredByTab && isSlashShortcut) {
        const updatedText = replaceRangeWithValue(
          inputValue,
          slashCommand,
          `${command.label} `,
          false,
        );
        editableRef.current.textContent = updatedText;
        setInputValue(updatedText);

        const node =
          editableRef.current.firstChild ?? editableRef.current;
        if (node) {
          const range = document.createRange();
          range.setStart(
            node,
            Math.min(
              slashCommand.start + command.label.length + 1,
              updatedText.length,
            ),
          );
          range.collapse(true);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      } else {
        const updatedText = removeRange(inputValue, slashCommand);
        editableRef.current.textContent = updatedText;
        setInputValue(updatedText);
        const node =
          editableRef.current.firstChild ?? editableRef.current;
        if (node && updatedText.length > 0) {
          const range = document.createRange();
          range.setStart(node, slashCommand.start);
          range.collapse(true);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
        context.commandRegistry.executeCommand(command.id);
      }
    };

    const startAudioVisualization = () => {
      if (!waveformCanvasRef.current || !analyserRef.current) {
        return;
      }

      const canvas = waveformCanvasRef.current;
      const context2d = canvas.getContext("2d");
      if (!context2d) {
        return;
      }

      const analyser = analyserRef.current;
      const binCount = analyser.frequencyBinCount;
      const buffer = new Uint8Array(binCount);
      const maxSamples = 200;
      const historyLimit = 500;

      const sampleAmplitude = () => {
        if (!analyserRef.current) {
          return 0;
        }
        analyserRef.current.getByteFrequencyData(buffer);
        let sum = 0;
        const sampleLength = Math.min(binCount / 4, 32);
        for (let index = 0; index < sampleLength; index += 1) {
          sum += buffer[index];
        }
        return sum / sampleLength / 255;
      };

      const render = () => {
        if (!context2d || !analyserRef.current) {
          return;
        }
        animationFrameRef.current = requestAnimationFrame(render);
        const amplitude = sampleAmplitude();
        amplitudeHistoryRef.current.push(amplitude);
        if (amplitudeHistoryRef.current.length > historyLimit) {
          amplitudeHistoryRef.current.shift();
        }

        const computedStyle = getComputedStyle(document.documentElement);
        context2d.fillStyle = computedStyle.getPropertyValue(
          "--primary",
        );
        context2d.fillRect(0, 0, canvas.width, canvas.height);

        context2d.strokeStyle = "rgba(220, 38, 38, 0.2)";
        context2d.lineWidth = 1;
        context2d.strokeRect(0, 0, canvas.width, canvas.height);

        const barWidth = 1;
        const gap = 0.5;
        const step = barWidth + gap;
        const maxHeight = canvas.height * 0.8;
        context2d.fillStyle = "#dc2626";
        const count = Math.min(maxSamples, amplitudeHistoryRef.current.length);
        for (let index = 0; index < count; index += 1) {
          const value =
            amplitudeHistoryRef.current[
              amplitudeHistoryRef.current.length - count + index
            ];
          const barHeight = Math.max(2, value * maxHeight);
          const x =
            canvas.width - (count - index) * step + gap;
          const y = (canvas.height - barHeight) / 2;
          context2d.fillRect(x, y, barWidth, barHeight);
        }
      };

      render();
    };

    const stopAudioVisualization = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = 0;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (waveformCanvasRef.current) {
        const context2d = waveformCanvasRef.current.getContext("2d");
        context2d?.clearRect(
          0,
          0,
          waveformCanvasRef.current.width,
          waveformCanvasRef.current.height,
        );
      }
      amplitudeHistoryRef.current = [];
    };

    const startMicrophone = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        mediaStreamRef.current = stream;
        audioContextRef.current = new window.AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        analyserRef.current.smoothingTimeConstant = 0.8;
        audioContextRef.current
          .createMediaStreamSource(stream)
          .connect(analyserRef.current);
        amplitudeHistoryRef.current = [];
        startAudioVisualization();
        if (editableRef.current) {
          context.safeFocus(editableRef.current);
        }
      } catch (error) {
        console.error("Error accessing microphone:", error);
        if (editableRef.current) {
          context.safeFocus(editableRef.current);
        }
      }
    };

    const toggleSpeechRecognition = async () => {
      const ctor = getSpeechRecognitionConstructor();
      if (!ctor) {
        return;
      }

      if (!recognitionRef.current) {
        recognitionRef.current = new (ctor as any)();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = "en-US";
        recognitionRef.current.onresult = (event: any) => {
          let finalText = "";
          let interimText = "";
          const baseText =
            editableRef.current?.getAttribute("data-base-text") ?? "";

          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const transcript = event.results[index][0].transcript;
            if (event.results[index].isFinal) {
              finalText += transcript;
            } else {
              interimText += transcript;
            }
          }

          const combined = baseText + finalText + interimText;
          if (editableRef.current) {
            editableRef.current.textContent = combined;
            setInputValue(combined);
            if (finalText) {
              editableRef.current.setAttribute(
                "data-base-text",
                baseText + finalText,
              );
            }
            const range = document.createRange();
            const selection = window.getSelection();
            range.selectNodeContents(editableRef.current);
            range.collapse(false);
            selection?.removeAllRanges();
            selection?.addRange(range);
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setIsRecording(false);
          if (event.error === "not-allowed") {
            alert(
              "Microphone access was denied. Please allow microphone access and try again.",
            );
          }
        };

        recognitionRef.current.onend = () => {
          if (isRecording) {
            recognitionRef.current.start();
          } else {
            stopAudioVisualization();
          }
        };
      }

      if (isRecording) {
        recognitionRef.current.stop();
        setIsRecording(false);
        stopAudioVisualization();
      } else {
        if (editableRef.current) {
          editableRef.current.setAttribute(
            "data-base-text",
            editableRef.current.textContent ?? "",
          );
        }
        recognitionRef.current.start();
        setIsRecording(true);
        await startMicrophone();
      }
    };

    useEffect(() => {
      if (isRecording && audioPopupRef.current && micButtonRef.current) {
        const popup = audioPopupRef.current;
        const buttonRect = micButtonRef.current.getBoundingClientRect();
        const popupRect = popup.getBoundingClientRect();
        const top = buttonRect.top;
        const popupHeight = popupRect.height + 8;
        if (top < popupHeight) {
          popup.style.bottom = "auto";
          popup.style.top = "50%";
          if (window.innerWidth - buttonRect.right >= popupRect.width + 8) {
            popup.style.left = "100%";
            popup.style.right = "auto";
            popup.style.marginLeft = "8px";
            popup.style.marginRight = "0";
          } else {
            popup.style.left = "auto";
            popup.style.right = "100%";
            popup.style.marginRight = "8px";
            popup.style.marginLeft = "0";
          }
          popup.style.transform = "translateY(-50%)";
          popup.style.marginBottom = "0";
        } else {
          popup.style.bottom = "100%";
          popup.style.top = "auto";
          popup.style.left = "50%";
          popup.style.transform = "translateX(-50%)";
          popup.style.marginLeft = "0";
          popup.style.marginBottom = "8px";
        }

        const bounds = popup.getBoundingClientRect();
        if (bounds.right > window.innerWidth) {
          const overflow = bounds.right - window.innerWidth;
          popup.style.transform = `translateX(calc(-50% - ${overflow + 8}px))`;
        } else if (bounds.left < 0) {
          const overflow = Math.abs(bounds.left);
          popup.style.transform = `translateX(calc(-50% + ${overflow + 8}px))`;
        }
      }
    }, [isRecording]);

    const handleScrimClick = () => {
      setCommandMenuOpen(false);
      setSuppressCommandFilter(false);
      setModelPickerOpen(false);
    };

    const showScrim =
      isCommandMenuOpen || !!atMention || !!slashCommand || isModelPickerOpen;

    const micAvailable = isMicSupported && context.supportsSpeechRecognition;

    return (
      <>
        {showScrim && (
          <div
            className="fixed inset-0 z-0"
            onClick={handleScrimClick}
          />
        )}
        <form
          onSubmit={handleSubmit}
          className={cn(
            "relative mx-auto flex flex-col rounded border border-border bg-card text-foreground",
            "focus-within:border-primary",
            "data-[permission-mode=acceptEdits]:focus-within:border-foreground",
            "data-[permission-mode=plan]:focus-within:border-ring",
          )}
          data-permission-mode={permissionMode}
        >
          <div className="pointer-events-none absolute inset-0 rounded bg-background" />
          <CommandMenu
            isOpen={isCommandMenuOpen}
            onClose={handleScrimClick}
            onCommandSelect={handleCommandSelect}
            commandRegistry={context.commandRegistry}
            filterText={slashCommand?.query ?? ""}
            suppressFilter={suppressCommandFilter}
          />
          {onListFiles && atMention && (
            <MentionFileList
              searchQuery={atMention.query}
              onClose={() => {}}
              onFileSelect={handleMentionFileSelect}
              onListFiles={onListFiles}
            />
          )}
          <ModelPicker
            isOpen={isModelPickerOpen}
            onClose={handleScrimClick}
            availableModels={availableModels}
            currentModel={currentModel}
            onModelSelected={onModelSelected}
          />
          <div className="relative flex items-end gap-2">
            <div
              ref={editableRef}
              contentEditable="plaintext-only"
              onInput={reportInputFromDom}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onClick={() => {
                if (isCommandMenuOpen) {
                  setCommandMenuOpen(false);
                }
              }}
              className={cn(
                "relative flex-1 self-stretch overflow-y-auto px-[14px] py-[10px] leading-[1.5] select-text outline-none focus:outline-none min-h-[1.5em] max-h-[200px] bg-transparent",
                "text-foreground",
                "[&:empty]:before:absolute",
                "[&:empty]:before:content-[attr(data-placeholder)]",
                "[&:empty]:before:pointer-events-none",
                "[&:empty]:before:text-muted-foreground",
              )}
              role="textbox"
              aria-label="Message input"
              aria-multiline="true"
              data-placeholder={
                isBusy ? BUSY_PLACEHOLDER : actualPlaceholder
              }
            />
            {micAvailable && (
              <div className="relative self-center">
                <button
                  ref={micButtonRef}
                  type="button"
                  onClick={toggleSpeechRecognition}
                  className={cn(
                    "cursor-pointer border-0 bg-transparent p-1.5 text-foreground",
                    "rounded-[3px] transition-colors hover:bg-muted",
                    isRecording &&
                      "bg-[#dc2626] text-white animate-[po_1.5s_ease-in-out_infinite]",
                  )}
                  title={isRecording ? "Stop recording" : "Start voice input"}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                    data-slot="icon"
                    className={cn(
                      "h-5 w-5",
                      isRecording
                        ? "text-white"
                        : "text-foreground",
                    )}
                  >
                    <path d="M7 4a3 3 0 0 1 6 0v6a3 3 0 1 1-6 0V4Z" />
                    <path d="M5.5 9.643a.75.75 0 0 0-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-1.5v-1.546A6.001 6.001 0 0 0 16 10v-.357a.75.75 0 0 0-1.5 0V10a4.5 4.5 0 0 1-9 0v-.357Z" />
                  </svg>
                </button>
                {isRecording && (
                  <div
                    ref={audioPopupRef}
                    className="absolute left-1/2 bottom-full z-[1000] mb-2 -translate-x-1/2 transform whitespace-nowrap rounded-lg border border-primary bg-background px-2 py-2 text-foreground shadow-[0_4px_6px_rgba(0,0,0,0.1),0_2px_4px_rgba(0,0,0,0.06)] animate-[mo_0.2s_ease-out] after:absolute after:left-1/2 after:top-full after:-translate-x-1/2 after:h-0 after:w-0 after:border-l-[8px] after:border-r-[8px] after:border-t-[8px] after:border-l-transparent after:border-r-transparent after:border-t-primary after:content-[''] before:absolute before:left-1/2 before:top-full before:-translate-x-1/2 before:-translate-y-[1px] before:h-0 before:w-0 before:border-l-[7px] before:border-r-[7px] before:border-t-[7px] before:border-l-transparent before:border-r-transparent before:border-t-background before:content-['']"
                  >
                    <canvas
                      ref={waveformCanvasRef}
                      className="block rounded border border-[rgba(220,38,38,0.2)] bg-background"
                      width={300}
                      height={60}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          {attachedFiles.length > 0 && (
            <div className="z-[1] flex gap-1 overflow-x-auto px-1 pb-1 pt-[6px]">
              {attachedFiles.map((attachment, index) => (
                <AttachmentChip
                  key={`${attachment.file.name}-${index}`}
                  label={attachment.file.name}
                  type={
                    attachment.file.type?.startsWith("image/")
                      ? "image"
                      : "document"
                  }
                  onRemove={() => onRemoveFile(index)}
                />
              ))}
            </div>
          )}
          <PromptInputFooter
            mode={permissionMode}
            onCycleMode={cyclePermissionMode}
            currentSelection={selection}
            canSendMessage={inputValue.trim().length > 0}
            toggleCommandMenu={handleToggleCommandMenu}
            includeSelection={includeSelection}
            onToggleIncludeSelection={onToggleIncludeSelection}
            onCompact={handleCompact}
            isBusy={isBusy}
            usageData={usageData}
            thinkingLevel={thinkingLevel}
            onToggleThinking={toggleThinking}
            onInterrupt={onInterrupt}
          />
        </form>
      </>
    );
  },
);

PromptInput.displayName = "PromptInput";
