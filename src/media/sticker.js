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
    msg?.extendedTextMessage
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

async function runFFmpeg(command) {
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

    return await fs.readFile(
      outputPath
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

    return await fs.readFile(
      outputPath
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

export async function getStickerMetadata() {
  return getStickerSettings();
}
