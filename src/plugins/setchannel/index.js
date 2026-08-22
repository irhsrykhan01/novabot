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
        "Menyimpan WhatsApp Channel tujuan untuk user.",

      async execute({
        message,
        socket,
        jid,
        reply
      }) {
        const userId =
          getUserId(message);

        if (!userId) {
          await reply(
            "User ID tidak dapat ditentukan."
          );

          return;
        }

        /*
         * Cara utama:
         * reply/forward pesan dari Channel
         * lalu jalankan .setchannel.
         *
         * Fallback:
         * jika event memang berasal dari
         * @newsletter, gunakan remoteJid.
         */
        const channelJid =
          findChannelJid(message);

        if (!channelJid) {
          await reply(
            [
              "Channel belum terdeteksi.",
              "",
              "Cara paling aman:",
              "1. Forward pesan dari Channel ke chat ini.",
              "2. Reply pesan tersebut.",
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
              `Channel : ${channel.name}`,
              `JID     : ${channel.jid}`,
              `Role    : ${channel.role}`,
              "",
              "Sekarang kamu bisa reply pesan apa pun lalu gunakan .upch."
            ].join("\n")
          );
        } catch (error) {
          await reply(
            `❌ Gagal mengatur Channel: ${error.message}`
          );

          throw error;
        }
      }
    }
  ]
};
