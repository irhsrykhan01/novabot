import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { exec as execCb } from "node:child_process";
import { promisify } from "node:util";

import {
  downloadContentFromMessage
} from "@whiskeysockets/baileys";

import {
  getStickerSettings
} from "../database/sticker-settings.js";

const exec = promisify(execCb);

/*
 * ------------------------------------------------------------
 * Sticker EXIF Metadata
 * ------------------------------------------------------------
 *
 * WhatsApp sticker metadata:
 *
 *  - 0x010F = Sticker-Pack-Id
 *  - 0x0110 = Sticker-Pack-Name
 *  - 0x0111 = Sticker-Pack-Publisher
 *
 * Untuk kompatibilitas WhatsApp sticker,
 * metadata juga disimpan sebagai JSON pada EXIF UserComment.
 */

function createStickerExif({
  pack,
  author
}) {
  const metadata = {
    "sticker-pack-id":
      "com.novabot.sticker",

    "sticker-pack-name":
      pack,

    "sticker-pack-publisher":
      author,

    "emojis": [
      "🙂"
    ]
  };

  const json =
    JSON.stringify(metadata);

  const jsonBuffer =
    Buffer.from(json, "utf8");

  /*
   * EXIF APP1 structure
   *
   * FF E1
   * APP1 length
   * Exif\0\0
   * TIFF header
   */

  const exifHeader =
    Buffer.from([
      0x45, 0x78, 0x69, 0x66,
      0x00, 0x00,

      // TIFF header - little endian
      0x49, 0x49,
      0x2A, 0x00,

      // Offset to IFD
      0x08, 0x00,
      0x00, 0x00,

      // Number of IFD entries
      0x01, 0x00,

      // UserComment tag
      0x86, 0x92,

      // Type = UNDEFINED
      0x07, 0x00,

      // Count
      jsonBuffer.length & 0xff,
      (jsonBuffer.length >> 8) & 0xff,
      (jsonBuffer.length >> 16) & 0xff,
      (jsonBuffer.length >> 24) & 0xff,

      // Offset to value
      0x1A, 0x00,
      0x00, 0x00,

      // Next IFD
      0x00, 0x00,
      0x00, 0x00
    ]);

  const exif =
    Buffer.concat([
      exifHeader,
      jsonBuffer
    ]);

  /*
   * JPEG-style APP1 marker.
   *
   * Although the final file is WebP,
   * the EXIF chunk itself follows the EXIF
   * payload format used by WebP EXIF chunks.
   */

  return exif;
}

/*
 * Insert EXIF chunk into WebP.
 */
function insertExifIntoWebP(
  webpBuffer,
  exifBuffer
) {
  if (
    !webpBuffer ||
    webpBuffer.length < 12
  ) {
    throw new Error(
      "File WebP tidak valid."
    );
  }

  const riff =
    webpBuffer.toString(
      "ascii",
      0,
      4
    );

  const webp =
    webpBuffer.toString(
      "ascii",
      8,
      12
    );

  if (
    riff !== "RIFF" ||
    webp !== "WEBP"
  ) {
    throw new Error(
      "Output bukan file WebP yang valid."
    );
  }

  const exifPadding =
    exifBuffer.length % 2
      ? 1
      : 0;

  const exifChunk =
    Buffer.alloc(
      8 +
      exifBuffer.length +
      exifPadding
    );

  exifChunk.write(
    "EXIF",
    0,
    4,
    "ascii"
  );

  exifChunk.writeUInt32LE(
    exifBuffer.length,
    4
  );

  exifBuffer.copy(
    exifChunk,
    8
  );

  /*
   * RIFF file size berada pada byte 4.
   */
  const oldSize =
    webpBuffer.readUInt32LE(4);

  const newSize =
    oldSize +
    exifChunk.length;

  const output =
    Buffer.concat([
      webpBuffer,
      exifChunk
    ]);

  output.writeUInt32LE(
    newSize,
    4
  );

  return output;
}

/*
 * ------------------------------------------------------------
 * Message Media
 * ------------------------------------------------------------
 */

function getMessageMedia(message) {
  const msg =
    message?.message;

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

  for await (
    const chunk of stream
  ) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

/*
 * ------------------------------------------------------------
 * FFmpeg
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
 * Image → WebP Sticker
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
 * Video → Animated WebP Sticker
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
 * Apply Metadata
 * ------------------------------------------------------------
 */

async function applyStickerMetadata(
  stickerBuffer
) {
  const settings =
    await getStickerSettings();

  const pack =
    String(
      settings?.pack ||
      "NovaBot"
    );

  const author =
    String(
      settings?.author ||
      "Rashii"
    );

  const exif =
    createStickerExif({
      pack,
      author
    });

  return insertExifIntoWebP(
    stickerBuffer,
    exif
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

    const stickerBuffer =
      await fs.readFile(
        outputPath
      );

    return applyStickerMetadata(
      stickerBuffer
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

    const stickerBuffer =
      await fs.readFile(
        outputPath
      );

    return applyStickerMetadata(
      stickerBuffer
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
