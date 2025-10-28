import type { AttachmentPayload, UserContentBlock } from "../types";

/** MIME types that can be rendered inline within chat transcripts. */
function decodeBase64Text(value: string): string {
  const globalWithAtob = globalThis as typeof globalThis & {
    atob?: (input: string) => string;
  };

  if (typeof globalWithAtob.atob === 'function') {
    return globalWithAtob.atob(value);
  }

  return Buffer.from(value, 'base64').toString('utf-8');
}

const INLINE_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];


/**
 * Construct the content blocks for a user message.
 *
 * Combines the prompt text with any attachments into the order expected by Claude:
 * selection/context blocks first, followed by attachments, then the user's message.
 */
export function buildUserMessageContent(
  prompt: string,
  attachments: AttachmentPayload[] | undefined,
): UserContentBlock[] {
  const blocks: UserContentBlock[] = [];

  // Attach any user-supplied assets (images, documents, etc.).
  if (attachments) {
    for (const attachment of attachments) {
      try {
        const mediaType = attachment.mediaType;
        const base64Data = attachment.data;
        // Inline supported image types.
        if (INLINE_IMAGE_MIME_TYPES.includes(mediaType)) {
          blocks.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Data,
            },
          });
        } else if (mediaType === 'text/plain') {
          // Decode plain text files into inline document blocks.
          const decoded = decodeBase64Text(base64Data);
          blocks.push({
            type: 'document',
            source: {
              type: 'text',
              media_type: 'text/plain',
              data: decoded,
            },
            title: attachment.name,
          });
        } else if (mediaType === 'application/pdf') {
          // Preserve PDF files as base64 documents.
          blocks.push({
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64Data,
            },
            title: attachment.name,
          });
        } else {
          console.error(`Cannot processing file: ${attachment.name}`);
        }
      } catch (error) {
        console.error('Error processing file:', error);
      }
    }
  }

  // Always append the raw prompt text at the end.
  blocks.push({
    type: 'text',
    text: prompt,
  });

  return blocks;
}
