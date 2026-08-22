import { createSticker } from "../../media/sticker.js";

const stickerCommand = {
  name: "sticker",
  aliases: ["s"],
  category: "media",
  description: "Mengubah gambar atau video menjadi sticker.",

  async execute({ message, reply, socket, jid }) {
    try {
      const sticker = await createSticker(message);

      await socket.sendMessage(jid, {
        sticker
      });
    } catch (error) {
      await reply(
        `Sticker gagal dibuat: ${error.message}`
      );
    }
  }
};

export default {
  name: "sticker",
  commands: [
    stickerCommand
  ]
};
