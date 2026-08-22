export default {
  name: "ping",

  aliases: [
    "p"
  ],

  category: "general",

  description: "Check whether NovaBot is online.",

  async execute({ reply }) {
    await reply("Pong!");
  }
};
