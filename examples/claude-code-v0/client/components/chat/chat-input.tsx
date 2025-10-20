import {
  PromptInput,
  PromptInputImageButton,
  PromptInputImagePreview,
  PromptInputMicButton,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  createImageAttachment,
  createImageAttachmentFromStored,
  savePromptToStorage,
  loadPromptFromStorage,
  clearPromptFromStorage,
  type ImageAttachment,
} from "@/components/ai-elements/prompt-input";
import {
  useState,
  useCallback,
  useEffect,
  type FormEvent,
  type RefObject,
} from "react";

interface ChatInputProps {
  message: string;
  setMessage: (message: string) => void;
  onSubmit: (
    payload: { text: string; attachments: ImageAttachment[] },
    event: FormEvent<HTMLFormElement>,
  ) => void;
  isLoading: boolean;
  isConnected: boolean;
  attachments?: ImageAttachment[];
  onAttachmentsChange?: (attachments: ImageAttachment[]) => void;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}

export function ChatInput({
  message,
  setMessage,
  onSubmit,
  isLoading,
  isConnected,
  attachments = [],
  onAttachmentsChange,
  textareaRef,
}: ChatInputProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleImageFiles = useCallback(
    async (files: File[]) => {
      if (!onAttachmentsChange) return;

      try {
        const newAttachments = await Promise.all(
          files.map((file) => createImageAttachment(file)),
        );
        onAttachmentsChange([...attachments, ...newAttachments]);
      } catch (error) {
        console.error("Error processing image files:", error);
      }
    },
    [attachments, onAttachmentsChange],
  );

  const handleRemoveAttachment = useCallback(
    (id: string) => {
      if (!onAttachmentsChange) return;
      onAttachmentsChange(attachments.filter((att) => att.id !== id));
    },
    [attachments, onAttachmentsChange],
  );

  const handleDragOver = useCallback(() => {
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(() => {
    setIsDragOver(false);
  }, []);

  useEffect(() => {
    if (message.trim() || attachments.length > 0) {
      savePromptToStorage(message, attachments);
    } else {
      clearPromptFromStorage();
    }
  }, [message, attachments]);

  useEffect(() => {
    if (!message && attachments.length === 0) {
      const storedData = loadPromptFromStorage();
      if (storedData) {
        setMessage(storedData.message);
        if (storedData.attachments.length > 0 && onAttachmentsChange) {
          const restoredAttachments = storedData.attachments.map(
            createImageAttachmentFromStored,
          );
          onAttachmentsChange(restoredAttachments);
        }
      }
    }
  }, [message, attachments, setMessage, onAttachmentsChange]);

  const handleSubmit = useCallback(
    ({ text }: { text?: string }, event: FormEvent<HTMLFormElement>) => {
      if (isLoading || !isConnected) {
        event.preventDefault();
        return;
      }

      const hasMessage = Boolean(text?.trim());
      const hasAttachments = attachments.length > 0;
      if (!hasMessage && !hasAttachments) {
        event.preventDefault();
        return;
      }

      clearPromptFromStorage();
      onSubmit({ text: text ?? "", attachments }, event);
    },
    [onSubmit, attachments, isConnected, isLoading],
  );

  return (
    <div className="px-4 md:pb-4">
      <div className="flex gap-2">
        <PromptInput
          onSubmit={handleSubmit}
          className="w-full max-w-2xl mx-auto relative"
          onImageDrop={handleImageFiles}
          isDragOver={isDragOver}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <PromptInputImagePreview
            attachments={attachments}
            onRemove={handleRemoveAttachment}
          />
          <PromptInputTextarea
            ref={textareaRef}
            onChange={(e) => setMessage(e.target.value)}
            value={message}
            className="min-h-[60px]"
            disabled={isLoading || !isConnected}
            placeholder="Continue the conversation..."
          />
          <PromptInputToolbar>
            <PromptInputTools>
              <PromptInputImageButton onImageSelect={handleImageFiles} />
            </PromptInputTools>
            <PromptInputTools>
              <PromptInputMicButton
                onTranscriptionChange={(transcript) => {
                  setMessage(message + (message ? " " : "") + transcript);
                }}
                onError={(error) => {
                  console.error("Speech recognition error:", error);
                }}
              />
              <PromptInputSubmit
                disabled={
                  isLoading ||
                  !isConnected ||
                  (!message && attachments.length === 0)
                }
                status={isLoading ? "streaming" : "ready"}
              />
            </PromptInputTools>
          </PromptInputToolbar>
        </PromptInput>
      </div>
    </div>
  );
}
