export default {
  name: "runtime",
  category: "system",
  description: "Menampilkan lama NovaBot berjalan.",

  async execute({ reply }) {
    const seconds = Math.floor(process.uptime());

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor(seconds % 86400 / 3600);
    const minutes = Math.floor(seconds % 3600 / 60);
    const secs = seconds % 60;

    await reply(
      `Runtime: ${days}d ${hours}h ${minutes}m ${secs}s`
    );
  }
};
