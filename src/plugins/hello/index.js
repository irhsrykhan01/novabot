const hello = {
  name: "hello",

  category: "plugin",

  description: "Test plugin NovaBot.",

  async execute({ reply, args }) {
    const name = args.join(" ").trim();

    await reply(
      name
        ? `Halo, ${name}!`
        : "Halo dari plugin NovaBot!"
    );
  }
};

export default {
  name: "hello",

  commands: [
    {
      ...hello,
      name: "hello",
      aliases: ["hi"]
    }
  ],

  async init() {}
};
