import { createStickerFromBuffer } from "../../media/sticker.js";

const API_URL = "https://depay.cloud/api/generator/brat";

async function generateBrat(text) {
  const url = new URL(API_URL);

  url.searchParams.set("text", text);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Brat API HTTP ${response.status}`
    );
  }

  const contentType =
    response.headers.get("content-type") || "";

  if (!contentType.startsWith("image/")) {
    const body = await response.text();

    throw new Error(
      `Brat API tidak mengembalikan gambar: ${body.slice(0, 200)}`
    );
  }

  return Buffer.from(
    await response.arrayBuffer()
  );
}

export default {
  name: "brat",

  commands: [
    {
      name: "brat",
      aliases: [],
      category: "maker",
      description: "Membuat sticker Brat dari teks.",

      async execute({
        args,
        socket,
        jid,
        reply
      }) {
        const text = args.join(" ").trim();

        if (!text) {
          await reply(
            "Contoh: .brat halo dunia"
          );

          return;
        }

        try {
          const imageBuffer =
            await generateBrat(text);

          const sticker =
            await createStickerFromBuffer(
              imageBuffer
            );

          await socket.sendMessage(jid, {
            sticker
          });
        } catch (error) {
          await reply(
            `Brat gagal dibuat: ${error.message}`
          );

          throw error;
        }
      }
    }
  ]
};
