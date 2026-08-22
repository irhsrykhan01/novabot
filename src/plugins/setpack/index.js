import {
  setStickerSettings,
  getStickerSettings
} from "../../database/sticker-settings.js";

export default {
  name: "setpack",

  commands: [
    {
      name: "setpack",

      aliases: [],

      category: "generator",

      description:
        "Mengubah nama pack dan author sticker NovaBot.",

      async execute({
        args,
        reply
      }) {
        const input =
          args.join(" ").trim();

        // Jika tidak ada argumen,
        // tampilkan setting yang sedang digunakan.
        if (!input) {
          const current =
            await getStickerSettings();

          await reply(
            [
              "Pengaturan sticker saat ini:",
              "",
              `Pack   : ${current.pack}`,
              `Author : ${current.author}`,
              "",
              "Cara mengubah:",
              ".setpack Nama Pack | Nama Author",
              "",
              "Contoh:",
              ".setpack NovaBot | Rashii"
            ].join("\n")
          );

          return;
        }

        const parts =
          input.split("|");

        if (parts.length !== 2) {
          await reply(
            [
              "Format salah.",
              "",
              "Gunakan:",
              ".setpack Nama Pack | Nama Author",
              "",
              "Contoh:",
              ".setpack NovaBot | Rashii"
            ].join("\n")
          );

          return;
        }

        const pack =
          parts[0].trim();

        const author =
          parts[1].trim();

        if (!pack || !author) {
          await reply(
            "Nama pack dan author tidak boleh kosong."
          );

          return;
        }

        if (
          pack.length > 100 ||
          author.length > 100
        ) {
          await reply(
            "Nama pack dan author maksimal 100 karakter."
          );

          return;
        }

        await setStickerSettings(
          pack,
          author
        );

        await reply(
          [
            "Sticker setting berhasil diubah!",
            "",
            `Pack   : ${pack}`,
            `Author : ${author}`,
            "",
            "Setting ini akan digunakan untuk sticker berikutnya."
          ].join("\n")
        );
      }
    }
  ]
};
