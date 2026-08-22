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
      description: "Membuat gambar Brat dari teks.",

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
          const image = await generateBrat(text);

          await socket.sendMessage(jid, {
            image,
            caption: `Brat: ${text}`
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
