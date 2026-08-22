import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { exec as execCb } from "node:child_process";
import { promisify } from "node:util";

import {
  downloadContentFromMessage
} from "@whiskeysockets/baileys";

import WebPMux from "node-webpmux";

import {
  getStickerSettings
} from "../database/sticker-settings.js";

const exec = promisify(execCb);

const Image = WebPMux.Image;

const STICKER_ID =
  "com.novabot.sticker";

/*
 * ------------------------------------------------------------
 * MESSAGE MEDIA
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
 * DOWNLOAD MEDIA
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
 * FFMPEG
 * ------------------------------------------------------------
 */

async function runFFmpeg(
  command
) {
  const {
    stdout,
    stderr
  } = await exec(command, {
    timeout: 30000,
    maxBuffer:
      20 * 1024 * 1024
  });

  return {
    stdout,
    stderr
  };
}

/*
 * ------------------------------------------------------------
 * IMAGE → WEBP
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
 * VIDEO → ANIMATED WEBP
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
 * BUILD WHATSAPP STICKER EXIF
 * ------------------------------------------------------------
 */

function buildStickerExif({
  pack,
  author,
  emojis = ["✨"]
}) {
  const metadata = {
    emojis,

    "sticker-pack-id":
      STICKER_ID,

    "sticker-pack-name":
      pack,

    "sticker-pack-publisher":
      author
  };

  const json =
    JSON.stringify(metadata);

  const jsonBuffer =
    Buffer.from(
      json,
      "utf8"
    );

  /*
   * Same EXIF header structure used
   * by wa-sticker-formatter.
   */

  const header =
    Buffer.from([
      0x49,
      0x49,
      0x2a,
      0x00,

      0x08,
      0x00,
      0x00,
      0x00,

      0x01,
      0x00,

      0x41,
      0x57,

      0x07,
      0x00,

      0x00,
      0x00,

      0x00,
      0x00,

      0x16,
      0x00,
      0x00,
      0x00
    ]);

  const exif =
    Buffer.concat([
      header,
      jsonBuffer
    ]);

  /*
   * JSON byte length.
   *
   * IMPORTANT:
   * UTF-8 byte length, not JS string length.
   */

  exif.writeUIntLE(
    jsonBuffer.length,
    14,
    4
  );

  return exif;
}

/*
 * ------------------------------------------------------------
 * ADD METADATA TO WEBP
 * ------------------------------------------------------------
 */

async function addStickerMetadata(
  webpBuffer
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

  const exif =
    buildStickerExif({
      pack,
      author
    });

  if (
    !Image ||
    typeof Image !== "function"
  ) {
    throw new Error(
      "node-webpmux Image API tidak tersedia pada versi yang terpasang."
    );
  }

  const image =
    new Image();

  /*
   * Load valid WebP generated
   * by FFmpeg.
   */

  await image.load(
    webpBuffer
  );

  /*
   * Let node-webpmux handle
   * the EXIF WebP chunk.
   */

  image.exif =
    exif;

  /*
   * null = return Buffer
   * instead of saving to file.
   */

  return await image.save(
    null
  );
}

/*
 * ------------------------------------------------------------
 * BUFFER → STICKER
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

  const outputPath =
    path.join(
      tempDir,
      "sticker.webp"
    );

  try {
    await fs.writeFile(
      inputPath,
      buffer
    );

    await imageToSticker(
      inputPath,
      outputPath
    );

    const webpBuffer =
      await fs.readFile(
        outputPath
      );

    return await addStickerMetadata(
      webpBuffer
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
 * CREATE STICKER
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

  const outputPath =
    path.join(
      tempDir,
      "sticker.webp"
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
        outputPath
      );
    } else {
      await videoToSticker(
        inputPath,
        outputPath
      );
    }

    const webpBuffer =
      await fs.readFile(
        outputPath
      );

    return await addStickerMetadata(
      webpBuffer
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
 * CREATE STICKER FROM BUFFER
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

  return await convertBufferToSticker(
    buffer,
    extension
  );
}

/*
 * ------------------------------------------------------------
 * GET METADATA
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
