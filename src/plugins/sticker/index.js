import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { downloadContentFromMessage } from "@whiskeysockets/baileys";

const exec = promisify(execFile);

function getSource(message) {
  const msg = message.message;

  if (msg?.imageMessage) {
    return { data: msg.imageMessage, type: "image" };
  }

  if (msg?.videoMessage) {
    return { data: msg.videoMessage, type: "video" };
  }

  const quoted = msg?.extendedTextMessage?.contextInfo?.quotedMessage;

  if (quoted?.imageMessage) {
    return { data: quoted.imageMessage, type: "image" };
  }

  if (quoted?.videoMessage) {
    return { data: quoted.videoMessage, type: "video" };
  }

  return null;
}

async function downloadMedia(source) {
  const stream = await downloadContentFromMessage(
    source.data,
    source.type
  );

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
        const source = getSource(message);

        if (!source) {
          return reply(
            "Kirim atau reply gambar/video dengan .sticker"
          );
        }

        let input;

        try {
          input = await downloadMedia(source);
        } catch (error) {
          return reply(`Media gagal diunduh: ${error.message}`);
        }

        const dir = await fs.mkdtemp(
          path.join(os.tmpdir(), "novabot-")
        );

        const inputPath = path.join(
          dir,
          source.type === "image" ? "input.jpg" : "input.mp4"
        );

        const outputPath = path.join(dir, "sticker.webp");

        try {
          await fs.writeFile(inputPath, input);

          const filter =
            "scale=512:512:force_original_aspect_ratio=decrease," +
            "pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000";

          await exec("ffmpeg", [
            "-y",
            "-i",
            inputPath,
            "-vf",
            filter,
            "-c:v",
            "libwebp",
            "-quality",
            "80",
            "-loop",
            "0",
            "-an",
            outputPath
          ]);

          const sticker = await fs.readFile(outputPath);

          await socket.sendMessage(jid, {
            sticker
          });
        } catch (error) {
          await reply(`Sticker gagal dibuat: ${error.message}`);
        } finally {
          await fs.rm(dir, {
            recursive: true,
            force: true
          });
        }
      }
    }
  ]
};
