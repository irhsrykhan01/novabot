import { createStickerFromBuffer } from "../../media/sticker.js";

const BRAT_API = "https://depay.cloud/api/generator/brat";

async function fetchBratImage(text) {
  const url =
    `${BRAT_API}?text=${encodeURIComponent(text)}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Brat API HTTP ${response.status}`
    );
  }

  const contentType =
    response.headers.get("content-type") || "";

  if (!contentType.includes("image")) {
    const body = await response.text();

    throw new Error(
      `Brat API tidak mengembalikan gambar. ` +
      `Content-Type: ${contentType}. ` +
      `Response: ${body.slice(0, 200)}`
    );
  }

  const arrayBuffer =
    await response.arrayBuffer();

  const buffer =
    Buffer.from(arrayBuffer);

  if (buffer.length === 0) {
    throw new Error(
      "Brat API mengembalikan gambar kosong."
    );
  }

  return buffer;
}

export default {
  name: "brat",

  commands: [
    {
      name: "brat",

      aliases: [
        "br"
      ],

      category: "generator",

      description:
        "Membuat sticker Brat dari teks.",

      usage:
        ".brat <teks>",

      async execute({
        args,
        socket,
        jid,
        reply
      }) {
        const text =
          args
            ?.join(" ")
            .trim() || "";

        if (!text) {
          await reply(
            "Contoh: .brat halo dunia"
          );

          return;
        }

        try {
          const imageBuffer =
            await fetchBratImage(
              text
            );

          /*
           * Gunakan engine sticker NovaBot
           * yang sama dengan .sticker.
           *
           * Jadi hasil Brat otomatis mendapatkan
           * pack + author dari setpack.
           */
          const sticker =
            await createStickerFromBuffer(
              imageBuffer,
              "png"
            );

          await socket.sendMessage(
            jid,
            {
              sticker
            }
          );
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
