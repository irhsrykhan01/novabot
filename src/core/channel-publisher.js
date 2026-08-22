import {
  downloadContentFromMessage,
  getContentType,
  normalizeMessageContent
} from "@whiskeysockets/baileys";

const CHANNEL_SUFFIX = "@newsletter";
const SEND_TIMEOUT_MS = 45_000;

const channelQueues = new Map();

function isChannelJid(jid) {
  return (
    typeof jid === "string" &&
    jid.endsWith(CHANNEL_SUFFIX)
  );
}

function normalizeUserId(jid) {
  if (
    typeof jid !== "string" ||
    !jid
  ) {
    return null;
  }

  return jid;
}

export function getUserId(message) {
  /*
   * Di private chat:
   * remoteJid = user.
   *
   * Di group:
   * participant = user.
   *
   * Di Channel:
   * remoteJid = channel.
   * participant dipakai kalau tersedia.
   */
  const participant =
    normalizeUserId(
      message?.key?.participant
    );

  if (
    participant &&
    !isChannelJid(participant) &&
    !participant.endsWith("@g.us")
  ) {
    return participant;
  }

  const remoteJid =
    normalizeUserId(
      message?.key?.remoteJid
    );

  if (
    remoteJid &&
    !isChannelJid(remoteJid)
  ) {
    return remoteJid;
  }

  return null;
}

function getMessageType(content) {
  if (!content) {
    return null;
  }

  try {
    return getContentType(content);
  } catch {
    return null;
  }
}

function getContextInfo(content) {
  const type =
    getMessageType(content);

  if (!type) {
    return null;
  }

  return (
    content?.[type]?.contextInfo ||
    null
  );
}

function findNewsletterJid(
  content
) {
  if (!content) {
    return null;
  }

  const normalized =
    normalizeMessageContent(
      content
    ) || content;

  const context =
    getContextInfo(
      normalized
    );

  const forwardedJid =
    context
      ?.forwardedNewsletterMessageInfo
      ?.newsletterJid;

  if (
    isChannelJid(
      forwardedJid
    )
  ) {
    return forwardedJid;
  }

  const contextRemoteJid =
    context?.remoteJid;

  if (
    isChannelJid(
      contextRemoteJid
    )
  ) {
    return contextRemoteJid;
  }

  const type =
    getMessageType(
      normalized
    );

  if (!type) {
    return null;
  }

  const nested =
    normalized?.[type]
      ?.contextInfo
      ?.quotedMessage;

  if (nested) {
    return findNewsletterJid(
      nested
    );
  }

  return null;
}

export function findChannelJid(
  message
) {
  const direct =
    message?.key?.remoteJid;

  if (isChannelJid(direct)) {
    return direct;
  }

  const fromMessage =
    findNewsletterJid(
      message?.message
    );

  if (fromMessage) {
    return fromMessage;
  }

  return null;
}

export async function inspectChannel(
  socket,
  channelJid
) {
  if (
    !isChannelJid(
      channelJid
    )
  ) {
    throw new Error(
      "Target bukan WhatsApp Channel."
    );
  }

  if (
    !socket ||
    typeof socket.newsletterMetadata !==
      "function"
  ) {
    throw new Error(
      "Baileys pada versi ini tidak menyediakan newsletterMetadata()."
    );
  }

  const metadata =
    await socket.newsletterMetadata(
      "jid",
      channelJid
    );

  if (!metadata) {
    throw new Error(
      "Metadata Channel tidak dapat diperoleh."
    );
  }

  const role =
    metadata
      ?.viewer_metadata
      ?.role ||
    metadata
      ?.viewerMetadata
      ?.role ||
    metadata?.role ||
    null;

  const name =
    metadata?.name ||
    metadata
      ?.thread_metadata
      ?.name ||
    metadata
      ?.threadMetadata
      ?.name ||
    "WhatsApp Channel";

  return {
    jid: channelJid,
    name,
    role,
    raw: metadata
  };
}

export async function validateChannelAdmin(
  socket,
  channelJid
) {
  const channel =
    await inspectChannel(
      socket,
      channelJid
    );

  if (
    channel.role !== "ADMIN" &&
    channel.role !== "OWNER"
  ) {
    throw new Error(
      [
        "NovaBot tidak memiliki izin posting di Channel ini.",
        `Role bot: ${channel.role || "UNKNOWN"}`
      ].join("\n")
    );
  }

  return channel;
}

export async function getUserChannel(
  storage,
  userId
) {
  if (!userId) {
    return null;
  }

  const user =
    storage.getUser(
      userId
    );

  const channel =
    user?.upchChannel;

  if (
    !channel?.jid ||
    !isChannelJid(
      channel.jid
    )
  ) {
    return null;
  }

  return channel;
}

export async function setUserChannel(
  storage,
  userId,
  channel
) {
  if (!userId) {
    throw new Error(
      "User ID tidak tersedia."
    );
  }

  return storage.setUser(
    userId,
    {
      upchChannel: {
        jid: channel.jid,
        name:
          channel.name ||
          "WhatsApp Channel",
        role:
          channel.role ||
          "ADMIN",
        updatedAt:
          Date.now()
      }
    }
  );
}

function getQuotedMessage(
  message
) {
  const normalized =
    normalizeMessageContent(
      message?.message
    ) ||
    message?.message;

  if (!normalized) {
    return null;
  }

  const type =
    getMessageType(
      normalized
    );

  if (!type) {
    return null;
  }

  const quoted =
    normalized?.[type]
      ?.contextInfo
      ?.quotedMessage;

  return quoted || null;
}

export function getSourceMessage(
  message
) {
  const quoted =
    getQuotedMessage(
      message
    );

  if (quoted) {
    return quoted;
  }

  /*
   * Mendukung:
   * foto/video/audio/document/sticker
   * dengan caption .upch langsung.
   */
  const normalized =
    normalizeMessageContent(
      message?.message
    ) ||
    message?.message;

  if (!normalized) {
    return null;
  }

  const type =
    getMessageType(
      normalized
    );

  if (
    type === "imageMessage" ||
    type === "videoMessage" ||
    type === "audioMessage" ||
    type === "documentMessage" ||
    type === "stickerMessage"
  ) {
    return normalized;
  }

  return null;
}

async function downloadMediaBuffer(
  media,
  type
) {
  if (!media) {
    throw new Error(
      "Data media tidak tersedia."
    );
  }

  const stream =
    await downloadContentFromMessage(
      media,
      type
    );

  const chunks = [];

  for await (
    const chunk of stream
  ) {
    chunks.push(chunk);
  }

  const buffer =
    Buffer.concat(chunks);

  if (!buffer.length) {
    throw new Error(
      "Media kosong setelah di-download."
    );
  }

  return buffer;
}

function getTextPayload(
  source
) {
  const normalized =
    normalizeMessageContent(
      source
    ) || source;

  if (
    typeof normalized
      ?.conversation ===
    "string"
  ) {
    return {
      text:
        normalized.conversation
    };
  }

  const extendedText =
    normalized
      ?.extendedTextMessage
      ?.text;

  if (
    typeof extendedText ===
    "string"
  ) {
    return {
      text:
        extendedText
    };
  }

  return null;
}

async function buildPayload(
  source
) {
  const normalized =
    normalizeMessageContent(
      source
    ) || source;

  if (!normalized) {
    throw new Error(
      "Pesan sumber tidak valid."
    );
  }

  const textPayload =
    getTextPayload(
      normalized
    );

  if (textPayload) {
    return {
      type: "text",
      content: textPayload
    };
  }

  if (
    normalized.imageMessage
  ) {
    const media =
      normalized.imageMessage;

    const buffer =
      await downloadMediaBuffer(
        media,
        "image"
      );

    return {
      type: "image",
      content: {
        image: buffer,
        mimetype:
          media.mimetype ||
          "image/jpeg",
        ...(media.caption
          ? {
              caption:
                media.caption
            }
          : {})
      }
    };
  }

  if (
    normalized.videoMessage
  ) {
    const media =
      normalized.videoMessage;

    const buffer =
      await downloadMediaBuffer(
        media,
        "video"
      );

    return {
      type: "video",
      content: {
        video: buffer,
        mimetype:
          media.mimetype ||
          "video/mp4",
        ...(media.caption
          ? {
              caption:
                media.caption
            }
          : {}),
        ...(media.gifPlayback
          ? {
              gifPlayback: true
            }
          : {})
      }
    };
  }

  if (
    normalized.audioMessage
  ) {
    const media =
      normalized.audioMessage;

    const buffer =
      await downloadMediaBuffer(
        media,
        "audio"
      );

    return {
      type: "audio",
      content: {
        audio: buffer,
        mimetype:
          media.mimetype ||
          "audio/ogg; codecs=opus",
        ptt:
          Boolean(media.ptt)
      }
    };
  }

  if (
    normalized.documentMessage
  ) {
    const media =
      normalized.documentMessage;

    const buffer =
      await downloadMediaBuffer(
        media,
        "document"
      );

    return {
      type: "document",
      content: {
        document: buffer,
        mimetype:
          media.mimetype ||
          "application/octet-stream",
        fileName:
          media.fileName ||
          "file",
        ...(media.caption
          ? {
              caption:
                media.caption
            }
          : {})
      }
    };
  }

  if (
    normalized.stickerMessage
  ) {
    const media =
      normalized.stickerMessage;

    const buffer =
      await downloadMediaBuffer(
        media,
        "sticker"
      );

    return {
      type: "sticker",
      content: {
        sticker: buffer
      }
    };
  }

  throw new Error(
    "Tipe pesan ini belum didukung oleh .upch."
  );
}

function withTimeout(
  promise,
  timeoutMs
) {
  return Promise.race([
    promise,

    new Promise(
      (_, reject) => {
        const timer =
          setTimeout(() => {
            reject(
              new Error(
                `Pengiriman melebihi batas waktu ${Math.round(
                  timeoutMs / 1000
                )} detik.`
              )
            );
          }, timeoutMs);

        promise.finally(
          () => clearTimeout(timer)
        );
      }
    )
  ]);
}

function enqueueChannelSend(
  channelJid,
  task
) {
  const previous =
    channelQueues.get(
      channelJid
    ) ||
    Promise.resolve();

  const next =
    previous
      .catch(() => {})
      .then(task);

  channelQueues.set(
    channelJid,
    next
  );

  next.finally(() => {
    if (
      channelQueues.get(
        channelJid
      ) === next
    ) {
      channelQueues.delete(
        channelJid
      );
    }
  });

  return next;
}

export async function publishMessage(
  socket,
  channelJid,
  sourceMessage
) {
  if (
    !socket ||
    typeof socket.sendMessage !==
      "function"
  ) {
    throw new Error(
      "WhatsApp socket tidak tersedia."
    );
  }

  if (
    !isChannelJid(
      channelJid
    )
  ) {
    throw new Error(
      "Target Channel tidak valid."
    );
  }

  const payload =
    await buildPayload(
      sourceMessage
    );

  const sent =
    await enqueueChannelSend(
      channelJid,
      () =>
        withTimeout(
          socket
