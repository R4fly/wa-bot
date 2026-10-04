/** Media kinds the library recognizes. */
export type MediaType =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "sticker"
  | "vcard"
  | "location"
  | "contact"
  | "unknown";

/** Metadata of one media attachment. */
export interface MediaMeta {
  readonly mime: string;
  readonly sizeBytes: number;
}

/** Policy for accepting media. Allow list wins over deny list when both set. */
export interface MediaPolicy {
  readonly maxBytes: number;
  readonly allowMime?: readonly string[];
  readonly denyMime?: readonly string[];
}

/** Outcome of a media policy check. */
export interface MediaDecision {
  readonly accepted: boolean;
  readonly reason?: "mime-denied" | "mime-not-allowed" | "size-exceeded";
}

/** Maps a MIME type to a media kind. */
export function detectMediaType(mime: string): MediaType {
  if (mime === "image/webp") {
    return "sticker";
  }
  if (mime.startsWith("image/")) {
    return "image";
  }
  if (mime.startsWith("video/")) {
    return "video";
  }
  if (mime.startsWith("audio/")) {
    return "audio";
  }
  if (mime === "text/vcard" || mime === "text/x-vcard") {
    return "vcard";
  }
  if (mime === "text/directory" || mime === "application/contact+json") {
    return "contact";
  }
  if (mime === "application/vnd.geo+json") {
    return "location";
  }
  if (mime.startsWith("application/")) {
    return "document";
  }
  return "unknown";
}

/** Checks one media meta against a policy. */
export function checkMedia(meta: MediaMeta, policy: MediaPolicy): MediaDecision {
  if (policy.denyMime !== undefined && policy.denyMime.includes(meta.mime)) {
    return { accepted: false, reason: "mime-denied" };
  }
  if (policy.allowMime !== undefined && !policy.allowMime.includes(meta.mime)) {
    return { accepted: false, reason: "mime-not-allowed" };
  }
  if (meta.sizeBytes > policy.maxBytes) {
    return { accepted: false, reason: "size-exceeded" };
  }
  return { accepted: true };
}
