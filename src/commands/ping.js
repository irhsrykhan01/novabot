export default {
  name: "ping",
  aliases: ["p"],
  category: "system",
  description: "Mengecek apakah NovaBot aktif.",

  async execute({ reply }) {
    await reply("Pong!");
  }
};
