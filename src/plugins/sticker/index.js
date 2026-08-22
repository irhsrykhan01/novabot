import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { downloadContentFromMessage } from "@whiskeysockets/baileys";

const exec = promisify(exec);

function getMedia(message) {
  const msg = message.message;

  if (msg?.imageMessage) {
    return { message: msg.imageMessage, type: "image" };
  }

  if (msg?.videoMessage) {
    return { message: msg.videoMessage, type: "video" };
  }

  const quoted =
    msg?.extendedTextMessage?.contextInfo?.quotedMessage;

  if (quoted?.imageMessage) {
    return { message: quoted.imageMessage, type: "image" };
  }

  if (quoted?.videoMessage) {
    return { message: quoted.videoMessage, type: "video" };
  }

  return null;
}

async function downloadMedia(media) {
  const stream = await downloadContentFromMessage(
    media.message,
    media.type
  );

  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

async function runFFmpeg(args) {
  return exec("ffmpeg", args, {
    timeout: 30000,
    maxBuffer: 10 * 1024 * 1024
  });
}

async function convertImage(input, output) {
  await runFFmpeg([
    "-y",
    "-i",
    input,
    "-vf",
    "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000",
    "-frames:v",
    "1",
    "-c:v",
    "libwebp",
    "-quality",
    "80",
    output
  ]);
}

async function convertVideo(input, output) {
  await runFFmpeg([
    "-y",
    "-i",
    input,
    "-t",
    "6",
    "-vf",
    "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,fps=15",
    "-c:v",
    "libwebp",
    "-quality",
    "70",
    "-loop",
    "0",
    "-an",
    output
  ]);
}

export async function createSticker(message) {
  const media = getMedia(message);

  if (!media) {
    throw new Error("No image or video found.");
  }

  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), "novabot-sticker-")
  );

  const input = path.join(
    dir,
    media.type === "image" ? "input.jpg" : "input.mp4"
  );

  const output = path.join(
    dir,
    "sticker.webp"
  );

  try {
    const buffer = await downloadMedia(media);

    await fs.writeFile(input, buffer);

    if (media.type === "image") {
      await convertImage(input, output);
    } else {
      await convertVideo(input, output);
    }

    return await fs.readFile(output);
  } finally {
    await fs.rm(dir, {
      recursive: true,
      force: true
    });
  }
}
