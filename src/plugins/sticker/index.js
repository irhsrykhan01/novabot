import { createSticker } from "../../media/sticker.js";

export default {
  name: "sticker",

  commands: [
    {
      name: "sticker",
      aliases: ["s"],
      category: "media",
      description: "Membuat sticker dari gambar atau video",

      async execute({
        message,
        socket,
        jid,
        reply
      }) {
        try {
          const sticker = await createSticker(
            message
          );

          await socket.sendMessage(
            jid,
            {
              sticker
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
