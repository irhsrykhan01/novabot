import {
  findChannelJid,
  validateChannelAdmin,
  setUserChannel,
  getUserId
} from "../../core/channel-publisher.js";

import * as storage from "../../storage/index.js";

export default {
  name: "setchannel",

  commands: [
    {
      name: "setchannel",

      aliases: ["setch"],

      category: "tools",

      description:
        "Menyimpan WhatsApp Channel untuk user.",

      usage:
        ".setchannel",

      async execute({
        message,
        socket,
        reply
      }) {
        const userId = getUserId(message);

        if (!userId) {
          await reply(
            "❌ User tidak dapat dikenali."
          );
          return;
        }

        const channelJid =
          findChannelJid(message);

        if (!channelJid) {
          await reply(
            [
              "❌ Channel tidak terdeteksi.",
              "",
              "Caranya:",
              "1. Forward postingan dari Channel ke chat bot.",
              "2. Reply postingan tersebut.",
              "3. Kirim .setchannel"
            ].join("\n")
          );
          return;
        }

        try {
          const channel =
            await validateChannelAdmin(
              socket,
              channelJid
            );

          await setUserChannel(
            storage,
            userId,
            channel
          );

          await reply(
            [
              "✅ Channel berhasil disimpan!",
              "",
              `Channel: ${channel.name}`,
              `Role: ${channel.role}`,
              "",
              "Sekarang reply pesan apa pun lalu gunakan .upch."
            ].join("\n")
          );
        } catch (error) {
          await reply(
            [
              "❌ Gagal menyimpan Channel.",
              "",
              `Penyebab: ${error.message}`
            ].join("\n")
          );
        }
      }
    }
  ]
};
