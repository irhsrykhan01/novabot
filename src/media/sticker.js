import {
  downloadContentFromMessage
} from "@whiskeysockets/baileys";

import {
  Sticker
} from "wa-sticker-formatter";

import {
  getStickerSettings
} from "../database/sticker-settings.js";

function getMessageMedia(message) {
  const msg = message?.message;

  if (msg?.imageMessage) {
    return {
      media: msg.imageMessage,
      type: "image"
    };
  }

  if (msg?.videoMessage) {
    return {
      media: msg.videoMessage,
      type: "video"
    };
  }

  const quoted =
    msg
      ?.extendedTextMessage
      ?.contextInfo
      ?.quotedMessage;

  if (quoted?.imageMessage) {
    return {
      media: quoted.imageMessage,
      type: "image"
    };
  }

  if (quoted?.videoMessage) {
    return {
      media: quoted.videoMessage,
      type: "video"
    };
  }

  return null;
}

async function downloadMedia(
  media,
  type
) {
  const stream =
    await downloadContentFromMessage(
      media,
      type
    );

  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

async function formatSticker(
  buffer
) {
  const settings =
    await getStickerSettings();

  const pack =
    String(
      settings?.pack ||
      "NovaBot"
    ).trim();

  const author =
    String(
      settings?.author ||
      "Rashii"
    ).trim();

  const sticker =
    new Sticker(
      buffer,
      {
        pack,
        author,

        id: "com.novabot.sticker",

        categories: [
          "✨"
        ],

        quality: 80
      }
    );

  return sticker.toBuffer();
}

export async function createSticker(
  message
) {
  const media =
    getMessageMedia(message);

  if (!media) {
    throw new Error(
      "Kirim atau reply gambar/video dengan caption .sticker."
    );
  }

  const buffer =
    await downloadMedia(
      media.media,
      media.type
    );

  return formatSticker(
    buffer
  );
}

export async function createStickerFromBuffer(
  buffer,
  extension = "png"
) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError(
      "Sticker input harus berupa Buffer."
    );
  }

  if (buffer.length === 0) {
    throw new Error(
      "Buffer sticker kosong."
    );
  }

  return formatSticker(
    buffer
  );
}

export async function getStickerMetadata() {
  const settings =
    await getStickerSettings();

  return {
    pack:
      String(
        settings?.pack ||
        "NovaBot"
      ),

    author:
      String(
        settings?.author ||
        "Rashii"
      )
  };
}
