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
        "Mengirim pesan ke Channel yang tersimpan.",

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
            "❌ User tidak dapat dikenali."
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
              "❌ Belum ada Channel tujuan.",
              "",
              "Reply postingan dari Channel lalu gunakan:",
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
              "Reply pesan yang mau dikirim lalu:",
              ".upch"
            ].join("\n")
          );

          return;
        }

        try {
          const result =
            await publishMessage(
              socket,
              channel.jid,
              source
            );

          await reply(
            [
              "✅ Pesan diterima WhatsApp untuk dikirim ke Channel.",
              "",
              `Channel : ${channel.name}`,
              `Tipe    : ${result.type}`,
              `ID      : ${result.messageId}`,
              "",
              "Catatan: ID ini berarti server WhatsApp menerima permintaan pengiriman; tampilan akhir di Channel tetap bergantung pada server/newsletter."
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
        }
      }
    }
  ]
};
