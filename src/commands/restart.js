import config from "../config/index.js";

export default {
  name: "restart",
  category: "system",
  description: "Restart NovaBot.",

  async execute({ reply, jid }) {
    const botNumber = config.bot.number.replace(/\D/g, "");
    const sender = jid.split(":")[0].replace(/\D/g, "");

    if (!botNumber || sender !== botNumber) {
      return;
    }

    await reply("Restarting NovaBot...");

    setTimeout(() => {
      process.exit(0);
    }, 500);
  }
};
