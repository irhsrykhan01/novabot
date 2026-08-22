import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  downloadContentFromMessage
} from "@whiskeysockets/baileys";

const exec = promisify(execFile);

async function downloadMedia(message) {
  const type = message.imageMessage
    ? "image"
    : message.videoMessage
      ? "video"
      : null;

  if (!type) return null;

  const media = message[`${type}Message`];
  const stream = await downloadContentFromMessage(media, type);

  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

export default {
  name: "sticker",

  commands: [
    {
      name: "sticker",
      aliases: ["s"],
      category: "media",
      description: "Mengubah gambar atau video menjadi sticker.",

      async execute({ message, reply, socket, jid }) {
        const quoted =
          message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        const source =
          message.message?.imageMessage ||
          message.message?.videoMessage ||
          quoted?.imageMessage ||
          quoted?.videoMessage;

        if (!source) {
          return reply(
            "Kirim gambar/video dengan caption .sticker atau reply media dengan .sticker."
          );
        }

        const type = source.imageMessage
          ? "image"
          : "video";

        const fakeMessage = {
          [type === "image" ? "imageMessage" : "videoMessage"]: source
        };

        const input = await downloadMedia(fakeMessage);

        if (!input) {
          return reply("Media tidak bisa diproses.");
        }

        const id = crypto.randomBytes(6).toString("hex");
        const dir = await fs.mkdtemp(
          path.join(os.tmpdir(), "novabot-")
        );

        const inputPath = path.join(dir, `input.${type === "image" ? "jpg" : "mp4"}`);
        const outputPath = path.join(dir, "sticker.webp");

        try {
          await fs.writeFile(inputPath, input);

          await exec("ffmpeg", [
            "-y",
            "-i",
            inputPath,
            "-vf",
            "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=transparent",
            "-c:v",
            "libwebp",
            "-quality",
            "80",
            "-loop",
            "0",
            outputPath
          ]);

          const sticker = await fs.readFile(outputPath);

          await socket.sendMessage(jid, {
            sticker
          });

          await fs.rm(dir, {
            recursive: true,
            force: true
          });
        } catch (error) {
          await fs.rm(dir, {
            recursive: true,
            force: true
          });

          await reply(
            `Sticker gagal dibuat: ${error.message}`
          );
        }
      }
    }
  ]
};
