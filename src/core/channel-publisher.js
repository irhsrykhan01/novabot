import {
  downloadContentFromMessage,
  getContentType,
  normalizeMessageContent
} from "@whiskeysockets/baileys";

const CHANNEL_SUFFIX = "@newsletter";

const channelQueues = new Map();

function isNewsletterJid(jid) {
  return (
    typeof jid === "string" &&
    jid.endsWith(CHANNEL_SUFFIX)
  );
}

function getUserId(message) {
  return (
    message?.key?.participant ||
    message?.key?.remoteJid ||
    null
  );
}

function getContextInfo(messageContent) {
  if (!messageContent) {
    return null;
  }

  const type =
    getContentType(messageContent);

  if (!type) {
    return null;
  }

  const content =
    messageContent[type];

  return content?.contextInfo || null;
}

function findNewsletterJidInContent(
  content
) {
  if (!content) {
    return null;
  }

  const normalized =
    normalizeMessageContent(content) ||
    content;

  const context =
    getContextInfo(normalized);

  const forwarded =
    context
      ?.forwardedNewsletterMessageInfo
      ?.newsletterJid;

  if (isNewsletterJid(forwarded)) {
    return forwarded;
  }

  const contextRemoteJid =
    context?.remoteJid;

  if (
    isNewsletterJid(
      contextRemoteJid
    )
  ) {
    return contextRemoteJid;
  }

  const type =
    getContentType(normalized);

  if (!type) {
    return null;
  }

  const inner =
    normalized[type];

  const nestedQuoted =
    inner?.contextInfo
      ?.quotedMessage;

  if (nestedQuoted) {
    const nestedResult =
      findNewsletterJidInContent(
        nestedQuoted
      );

    if (nestedResult) {
      return nestedResult;
    }
  }

  return null;
}

export function findChannelJid(
  message
) {
  const directJid =
    message?.key?.remoteJid;

  if (isNewsletterJid(directJid)) {
    return directJid;
  }

  const current =
    findNewsletterJidInContent(
      message?.message
    );

  if (current) {
    return current;
  }

  const type =
    getContentType(
      message?.message
    );

  const currentContent =
    type
      ? message?.message?.[type]
      : null;

  const quoted =
    currentContent
      ?.contextInfo
      ?.quotedMessage;

  if (quoted) {
    const quotedJid =
      findNewsletterJidInContent(
        quoted
      );

    if (quotedJid) {
      return quotedJid;
    }
  }

  return null;
}

export async function inspectChannel(
  socket,
  channelJid
) {
  if (
    !isNewsletterJid(
      channelJid
    )
  ) {
    throw new Error(
      "Target bukan WhatsApp Channel."
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
    metadata?.viewer_metadata?.role ||
    metadata?.viewerMetadata?.role ||
    metadata?.role ||
    null;

  return {
    jid: channelJid,
    name:
      metadata?.name ||
      metadata?.thread_metadata?.name ||
      "WhatsApp Channel",
    role
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
      `NovaBot belum menjadi admin Channel ini. Role saat ini: ${
        channel.role || "UNKNOWN"
      }`
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
    storage.getUser(userId);

  const channel =
    user?.upchChannel;

  if (
    !channel?.jid ||
    !isNewsletterJid(
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

function getSourceMessage(
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
    getContentType(normalized);

  if (!type) {
    return null;
  }

  const content =
    normalized[type];

  const context =
    content?.contextInfo;

  if (
    context?.quotedMessage
  ) {
    return context.quotedMessage;
  }

  /*
   * Jika command .upch dikirim langsung
   * pada media dengan caption .upch,
   * gunakan media tersebut.
   */
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

function getTextContent(
  source
) {
  const normalized =
    normalizeMessageContent(
      source
    ) || source;

  if (!normalized) {
    return null;
  }

  if (
    typeof normalized.conversation ===
    "string"
  ) {
    return {
      text: normalized.conversation
    };
  }

  if (
    typeof normalized
      .extendedTextMessage
      ?.text ===
    "string"
  ) {
    return {
      text:
        normalized
          .extendedTextMessage
          .text
    };
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

async function buildPayload(
  source
) {
  const normalized =
    normalizeMessageContent(
      source
    ) || source;

  const text =
    getTextContent(
      normalized
    );

  if (text) {
    return {
      type: "text",
      content: {
        text: text.text
      }
    };
  }

  if (
    normalized?.imageMessage
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
          media.mimetype,
        caption:
          media.caption ||
          undefined
      }
    };
  }

  if (
    normalized?.videoMessage
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
          media.mimetype,
        caption:
          media.caption ||
          undefined,
        gifPlayback:
          Boolean(
            media.gifPlayback
          )
      }
    };
  }

  if (
    normalized?.audioMessage
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
    normalized?.documentMessage
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
        caption:
          media.caption ||
          undefined
      }
    };
  }

  if (
    normalized?.stickerMessage
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

async function sendQueued(
  channelJid,
  task
) {
  const previous =
    channelQueues.get(
      channelJid
    ) || Promise.resolve();

  const next =
    previous
      .catch(() => {})
      .then(task);

  channelQueues.set(
    channelJid,
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
    })
  );

  return next;
}

export async function publishMessage(
  socket,
  channelJid,
  sourceMessage
) {
  const payload =
    await buildPayload(
      sourceMessage
    );

  return sendQueued(
    channelJid,
    async () => {
      return socket.sendMessage(
        channelJid,
        payload.content
      );
    }
  );
}

export {
  getUserId,
  getSourceMessage
};
