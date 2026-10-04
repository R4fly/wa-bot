import type { NormalizedMessageEvent } from "../../adapters/contract.js";

/** Read only view of one inbound message for domain consumers. */
export interface MessageView {
  readonly messageId: string;
  readonly senderJid: string;
  readonly chatJid: string;
  readonly body: string;
  readonly isGroup: boolean;
  readonly timestamp: number;
  readonly quotedMessageId?: string;
}

/** Normalizes an engine event into a trimmed domain message view. */
export function createMessageView(event: NormalizedMessageEvent): MessageView {
  return {
    messageId: event.messageId,
    senderJid: event.senderJid,
    chatJid: event.chatJid,
    body: event.body.trim(),
    isGroup: event.isGroup,
    timestamp: event.timestamp,
    ...(event.quotedMessageId === undefined ? {} : { quotedMessageId: event.quotedMessageId }),
  };
}
