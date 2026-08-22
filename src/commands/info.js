import config from "../config/index.js";

export default {
  name: "info",
  category: "system",
  description: "Menampilkan informasi NovaBot.",

  async execute({ reply }) {
    await reply(
      [
        `*${config.bot.name}*`,
        "",
        "Version: 1.0.0",
        `Prefix: ${config.command.prefix}`,
        "Platform: WhatsApp",
        "Runtime: Node.js"
      ].join("\n")
    );
  }
};
