export default {
  name: "ping",

  aliases: [
    "p"
  ],

  category: "general",

  description: "Check whether NovaBot is online.",

  async execute({ message }) {
    const jid = message.key.remoteJid;

    await globalThis.novaBot.sendMessage(
      jid,
      {
        text: "Pong!"
      }
    );
  }
};
