import {
  getUserId,
  getSourceMessage,
  getUserChannel,
  publishMessage
} from "../../core/channel-publisher.js";

import * as storage from "../../storage/index.js";

export default {
  name: "upch",

  commands: [
    {
      name: "upch",

      aliases: [
        "uploadch"
      ],

      category: "tools",

      description:
        "Mengirim ulang pesan ke Channel yang sudah disimpan.",

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

        const channel =
          await getUserChannel(
            storage,
            userId
          );

        if (!channel) {
          await reply(
            [
              "❌ Kamu belum mempunyai Channel tujuan.",
              "",
              "Reply atau forward pesan dari Channel yang kamu kelola, lalu gunakan:",
              ".setchannel"
            ].join("\n")
          );

          return;
        }

        const source =
          getSourceMessage(
            message
          );

        if (!source) {
          await reply(
            [
              "❌ Tidak ada pesan yang akan di-upload.",
              "",
              "Reply pesan yang ingin dikirim ke Channel, lalu gunakan:",
              ".upch"
            ].join("\n")
          );

          return;
        }

        try {
          await publishMessage(
            socket,
            channel.jid,
            source
          );

          await reply(
            [
              "✅ Berhasil dikirim ke Channel!",
              "",
              `Channel : ${channel.name}`
            ].join("\n")
          );
        } catch (error) {
          await reply(
            [
              "❌ Gagal mengirim ke Channel.",
              "",
              `Penyebab: ${error.message}`
            ].join("\n")
          );

          throw error;
        }
      }
    }
  ]
};
