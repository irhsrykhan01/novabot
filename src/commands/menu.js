import { getCommands } from "../core/command-loader.js";

export default {
  name: "menu",
  aliases: ["help"],
  category: "system",
  description: "Menampilkan daftar command.",

  async execute({ reply }) {
    const commands = [...getCommands().values()]
      .filter((cmd, i, arr) => arr.findIndex(x => x.name === cmd.name) === i)
      .sort((a, b) => a.name.localeCompare(b.name));

    const text = [
      `*${process.env.BOT_NAME || "NovaBot"}*`,
      "",
      ...commands.map(cmd => `• .${cmd.name} — ${cmd.description || "-"}`)
    ].join("\n");

    await reply(text);
  }
};
