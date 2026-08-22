function calculate(expression) {
  if (!/^[0-9+\-*/().%\s]+$/.test(expression)) {
    throw new Error("Invalid expression");
  }

  return Function(`"use strict"; return (${expression})`)();
}

export default {
  name: "calculator",

  commands: [
    {
      name: "calc",
      aliases: ["calculate"],
      category: "utility",
      description: "Menghitung operasi matematika.",

      async execute({ reply, args }) {
        if (!args.length) {
          return reply("Contoh: .calc 25*4");
        }

        try {
          const expression = args.join(" ");
          const result = calculate(expression);

          await reply(`Hasil: ${result}`);
        } catch {
          await reply("Perhitungan tidak valid.");
        }
      }
    }
  ]
};
