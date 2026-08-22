const config = {
  env: process.env.NODE_ENV || "development",

  bot: {
    name: process.env.BOT_NAME || "NovaBot",
    number: process.env.BOT_NUMBER || ""
  },

  command: {
    prefix: process.env.BOT_PREFIX || "."
  }
};

export default config;
