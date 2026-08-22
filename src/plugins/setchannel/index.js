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

      aliases: [
        "setch"
      ],

      category: "tools",

      description:
        "Menyimpan Channel WhatsApp untuk user.",

      async execute({
        message,
        socket,
        reply
      }) {
        const userId =
          getUserId(
            message
          );

        if (!userId) {
          await reply(
            [
              "❌ User tidak dapat dikenali.",
              "",
              "Atur Channel dari chat pribadi dengan bot atau reply pesan Channel yang diteruskan ke chat pribadi."
            ].join("\n")
          );

          return;
        }

        const channelJid =
          findChannelJid(
            message
          );

        if (!channelJid) {
          await reply(
            [
              "❌ Channel tidak terdeteksi.",
              "",
              "Cara yang direkomendasikan:",
              "1. Forward sebuah postingan dari Channel ke chat pribadi dengan bot.",
              "2. Reply postingan tersebut.",
              "3. Kirim .setchannel",
              "",
              "Bot akan mendeteksi JID @newsletter secara otomatis."
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
              `Channel : ${channel.name}`,
              `Role    : ${channel.role}`,
              "",
              "Target ini tersimpan khusus untuk akun kamu.",
              "",
              "Sekarang reply pesan apa pun lalu gunakan .upch."
            ].join("\n")
          );
        } catch (error) {
          await reply(
            [
              "❌ Channel tidak dapat disimpan.",
              "",
              error.message
            ].join("\n")
          );
        }
      }
    }
  ]
};
