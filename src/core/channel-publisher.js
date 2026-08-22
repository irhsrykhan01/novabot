import {
  downloadContentFromMessage,
  getContentType,
  normalizeMessageContent
} from "@whiskeysockets/baileys";

const CHANNEL_SUFFIX = "@newsletter";
const SEND_TIMEOUT_MS = 45000;

const channelQueues = new Map();

function isChannelJid(jid) {
  return (
    typeof jid === "string" &&
    jid.endsWith(CHANNEL_SUFFIX)
  );
}

function getMessageType(content) {
  if (!content) return null;

  try {
    return getContentType(content);
  } catch {
    return null;
  }
}

function normalizeContent(content) {
  return (
    normalizeMessageContent(content) ||
    content ||
    null
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

function getContextInfo(content) {
  const normalized =
    normalizeContent(content);

  const type =
    getMessageType(normalized);

  if (!type) return null;

  return (
    normalized?.[type]?.contextInfo ||
    null
  );
}

function findNewsletterJid(content) {
  if (!content) return null;

  const normalized =
    normalizeContent(content);

  const context =
    getContextInfo(normalized);

  const forwardedJid =
    context
      ?.forwardedNewsletterMessageInfo
      ?.newsletterJid;

  if (
    isChannelJid(forwardedJid)
  ) {
    return forwardedJid;
  }

  const remoteJid =
    context?.remoteJid;

  if (isChannelJid(remoteJid)) {
    return remoteJid;
  }

  const type =
    getMessageType(normalized);

  if (!type) return null;

  const quoted =
    normalized?.[type]
      ?.contextInfo
      ?.quotedMessage;

  if (quoted) {
    return findNewsletterJid(
      quoted
    );
  }

  return null;
}

export function findChannelJid(message) {
  const direct =
    message?.key?.remoteJid;

  if (isChannelJid(direct)) {
    return direct;
  }

  return findNewsletterJid(
    message?.message
  );
}

export async function inspectChannel(
  socket,
  channelJid
) {
  if (
    !isChannelJid(channelJid)
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
      "Baileys tidak menyediakan newsletterMetadata()."
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

  const name =
    metadata?.name ||
    metadata?.thread_metadata?.name ||
    metadata?.threadMetadata?.name ||
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

  const role =
    String(
      channel.role || ""
    ).toUpperCase();

  if (
    role !== "ADMIN" &&
    role !== "OWNER"
  ) {
    throw new Error(
      [
        "NovaBot bukan admin Channel ini.",
        `Role bot: ${channel.role || "UNKNOWN"}`,
        "",
        "Jadikan nomor bot sebagai admin Channel terlebih dahulu."
      ].join("\n")
    );
  }

  return channel;
}

export function getUserChannel(
  storage,
  userId
) {
  if (!storage || !userId) {
    return null;
  }

  const user =
    storage.getUser(userId);

  const channel =
    user?.upchChannel;

  if (
    !channel ||
    !channel.jid ||
    !isChannelJid(channel.jid)
  ) {
    return null;
  }

  return channel;
}

export function setUserChannel(
  storage,
  userId,
  channel
) {
  if (!storage) {
    throw new Error(
      "Storage tidak tersedia."
    );
  }

  if (!userId) {
    throw new Error(
      "User ID tidak tersedia."
    );
  }

  if (
    !channel ||
    !isChannelJid(channel.jid)
  ) {
    throw new Error(
      "JID Channel tidak valid."
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

function getQuotedMessage(message) {
  const normalized =
    normalizeContent(
      message?.message
    );

  if (!normalized) {
    return null;
  }

  const type =
    getMessageType(normalized);

  if (!type) {
    return null;
  }

  return (
    normalized?.[type]
      ?.contextInfo
      ?.quotedMessage ||
    null
  );
}

export function getSourceMessage(message) {
  const quoted =
    getQuotedMessage(message);

  if (quoted) {
    return quoted;
  }

  const normalized =
    normalizeContent(
      message?.message
    );

  if (!normalized) {
    return null;
  }

  const type =
    getMessageType(normalized);

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

  for await (const chunk of stream) {
    chunks.push(
      Buffer.from(chunk)
    );
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

function getTextPayload(source) {
  const normalized =
    normalizeContent(source);

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

  const text =
    normalized
      ?.extendedTextMessage
      ?.text;

  if (
    typeof text === "string"
  ) {
    return {
      text
    };
  }

  return null;
}

async function buildPayload(source) {
  const normalized =
    normalizeContent(source);

  if (!normalized) {
    throw new Error(
      "Pesan sumber tidak valid."
    );
  }

  const text =
    getTextPayload(normalized);

  if (text) {
    return {
      type: "text",
      content: text
    };
  }

  if (normalized.imageMessage) {
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

  if (normalized.videoMessage) {
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

  if (normalized.audioMessage) {
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
        ptt: Boolean(media.ptt)
      }
    };
  }

  if (normalized.documentMessage) {
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

  if (normalized.stickerMessage) {
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
  let timer;

  const timeout =
    new Promise(
      (_, reject) => {
        timer = setTimeout(
          () => {
            reject(
              new Error(
                `Pengiriman timeout setelah ${Math.round(
                  timeoutMs / 1000
                )} detik.`
              )
            );
          },
          timeoutMs
        );
      }
    );

  return Promise.race([
    promise,
    timeout
  ]).finally(() => {
    clearTimeout(timer);
  });
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
    !isChannelJid(channelJid)
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
          socket.sendMessage(
            channelJid,
            payload.content
          ),
          SEND_TIMEOUT_MS
        )
    );

  if (
    !sent ||
    !sent.key ||
    !sent.key.id
  ) {
    throw new Error(
      "WhatsApp tidak mengembalikan message ID."
    );
  }

  return {
    messageId:
      sent.key.id,

    type:
      payload.type,

    channelJid
  };
      }
