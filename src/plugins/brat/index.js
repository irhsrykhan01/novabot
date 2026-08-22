import { createStickerFromBuffer } from "../media/sticker.js";

const BRAT_API =
  "https://api.depay.id/brat";

function getText(context) {
  return (
    context?.args?.join(" ").trim() ||
    ""
  );
}

async function fetchBratImage(text) {
  const url =
    `${BRAT_API}?text=${encodeURIComponent(text)}`;

  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Brat API HTTP ${response.status}`
    );
  }

  const contentType =
    response.headers.get(
      "content-type"
    ) || "";

  if (
    !contentType.includes("image")
  ) {
    const body =
      await response.text();

    throw new Error(
      `Brat API tidak mengembalikan gambar. Content-Type: ${contentType}. Response: ${body.slice(0, 200)}`
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

  aliases: [],

  category: "generator",

  description:
    "Membuat sticker Brat dari teks.",

  usage:
    ".brat <teks>",

  async execute(context) {
    const text =
      getText(context);

    if (!text) {
      return context.reply(
        "Contoh: .brat halo dunia"
      );
    }

    try {
      const imageBuffer =
        await fetchBratImage(text);

      const sticker =
        await createStickerFromBuffer(
          imageBuffer,
          "png"
        );

      await context.socket.sendMessage(
        context.jid,
        {
          sticker
        }
      );
    } catch (error) {
      throw new Error(
        `Brat gagal: ${error.message}`
      );
    }
  }
};
