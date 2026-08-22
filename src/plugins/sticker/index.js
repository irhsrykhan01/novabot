import {
  createSticker,
  getStickerMetadata
} from "../../media/sticker.js";

export default {
  name: "sticker",

  commands: [
    {
      name: "sticker",

      aliases: ["s"],

      category: "media",

      description:
        "Membuat sticker dari gambar atau video",

      async execute({
        message,
        socket,
        jid,
        reply
      }) {
        try {
          const sticker =
            await createSticker(message);

          const metadata =
            await getStickerMetadata();

          await socket.sendMessage(
            jid,
            {
              sticker,
              packname: metadata.pack,
              author: metadata.author
            }
          );
        } catch (error) {
          await reply(
            `Sticker gagal dibuat: ${error.message}`
          );

          throw error;
        }
      }
    }
  ]
};
