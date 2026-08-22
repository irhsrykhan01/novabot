import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { exec as execCb } from "node:child_process";
import { promisify } from "node:util";

import {
  downloadContentFromMessage
} from "@whiskeysockets/baileys";

import WebP from "node-webpmux";

import {
  getStickerSettings
} from "../database/sticker-settings.js";

const exec = promisify(execCb);

/*
 * ------------------------------------------------------------
 * Message Media
 * ------------------------------------------------------------
 */

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

/*
 * ------------------------------------------------------------
 * Download Media
 * ------------------------------------------------------------
 */

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

/*
 * ------------------------------------------------------------
 * FFmpeg
 * ------------------------------------------------------------
 */

async function runFFmpeg(command) {
  const {
    stdout,
    stderr
  } = await exec(command, {
    timeout: 30000,
    maxBuffer: 20 * 1024 * 1024
  });

  return {
    stdout,
    stderr
  };
}

/*
 * ------------------------------------------------------------
 * Image → WebP
 * ------------------------------------------------------------
 */

async function imageToSticker(
  input,
  output
) {
  await runFFmpeg(
    [
      "ffmpeg",
      "-y",
      "-i",
      `"${input}"`,

      "-vf",
      `"scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000"`,

      "-frames:v",
      "1",

      "-c:v",
      "libwebp",

      "-quality",
      "80",

      `"${output}"`
    ].join(" ")
  );
}

/*
 * ------------------------------------------------------------
 * Video → Animated WebP
 * ------------------------------------------------------------
 */

async function videoToSticker(
  input,
  output
) {
  await runFFmpeg(
    [
      "ffmpeg",
      "-y",
      "-i",
      `"${input}"`,

      "-t",
      "6",

      "-vf",
      `"scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,fps=15"`,

      "-an",

      "-c:v",
      "libwebp",

      "-quality",
      "70",

      "-loop",
      "0",

      `"${output}"`
    ].join(" ")
  );
}

/*
 * ------------------------------------------------------------
 * WebP Metadata
 * ------------------------------------------------------------
 *
 * WhatsApp sticker EXIF menggunakan JSON:
 *
 * {
 *   "sticker-pack-id": "...",
 *   "sticker-pack-name": "...",
 *   "sticker-pack-publisher": "...",
 *   "emojis": ["✨"]
 * }
 *
 * node-webpmux akan menangani struktur EXIF/WebP-nya.
 */

async function addStickerMetadata(
  inputPath,
  outputPath
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

  const exifObject = {
    "sticker-pack-id":
      "com.novabot.sticker",

    "sticker-pack-name":
      pack,

    "sticker-pack-publisher":
      author,

    emojis: [
      "✨"
    ]
  };

  const exifJson =
    JSON.stringify(exifObject);

  /*
   * Format EXIF sticker WhatsApp.
   *
   * 4 byte header:
   *     49 49 2A 00
   *
   * followed by TIFF/EXIF payload.
   *
   * node-webpmux hanya membutuhkan
   * Buffer EXIF untuk chunk WebP.
   */

  const exifPayload =
    Buffer.from(
      exifJson,
      "utf8"
    );

  const exifHeader =
    Buffer.from([
      0x49,
      0x49,
      0x2A,
      0x00,
      0x08,
      0x00,
      0x00,
      0x00,
      0x01,
      0x00
    ]);

  const exif =
    Buffer.concat([
      exifHeader,
      exifPayload
    ]);

  const image =
    new WebP.Image();

  await image.load(
    inputPath
  );

  image.exif =
    exif;

  await image.save(
    outputPath
  );
}

/*
 * ------------------------------------------------------------
 * Buffer → Sticker
 * ------------------------------------------------------------
 */

async function convertBufferToSticker(
  buffer,
  extension = "png"
) {
  const tempDir =
    await fs.mkdtemp(
      path.join(
        os.tmpdir(),
        "novabot-sticker-"
      )
    );

  const inputPath =
    path.join(
      tempDir,
      `input.${extension}`
    );

  const webpPath =
    path.join(
      tempDir,
      "sticker.webp"
    );

  const finalPath =
    path.join(
      tempDir,
      "sticker-final.webp"
    );

  try {
    await fs.writeFile(
      inputPath,
      buffer
    );

    await imageToSticker(
      inputPath,
      webpPath
    );

    await addStickerMetadata(
      webpPath,
      finalPath
    );

    return await fs.readFile(
      finalPath
    );
  } finally {
    await fs.rm(
      tempDir,
      {
        recursive: true,
        force: true
      }
    );
  }
}

/*
 * ------------------------------------------------------------
 * Main Sticker Creator
 * ------------------------------------------------------------
 */

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

  const tempDir =
    await fs.mkdtemp(
      path.join(
        os.tmpdir(),
        "novabot-sticker-"
      )
    );

  const inputPath =
    path.join(
      tempDir,

      media.type === "image"
        ? "input.jpg"
        : "input.mp4"
    );

  const webpPath =
    path.join(
      tempDir,
      "sticker.webp"
    );

  const finalPath =
    path.join(
      tempDir,
      "sticker-final.webp"
    );

  try {
    const buffer =
      await downloadMedia(
        media.media,
        media.type
      );

    await fs.writeFile(
      inputPath,
      buffer
    );

    if (
      media.type === "image"
    ) {
      await imageToSticker(
        inputPath,
        webpPath
      );
    } else {
      await videoToSticker(
        inputPath,
        webpPath
      );
    }

    await addStickerMetadata(
      webpPath,
      finalPath
    );

    return await fs.readFile(
      finalPath
    );
  } finally {
    await fs.rm(
      tempDir,
      {
        recursive: true,
        force: true
      }
    );
  }
}

/*
 * ------------------------------------------------------------
 * Public Buffer API
 * ------------------------------------------------------------
 */

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

  return convertBufferToSticker(
    buffer,
    extension
  );
}

/*
 * ------------------------------------------------------------
 * Metadata API
 * ------------------------------------------------------------
 */

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
