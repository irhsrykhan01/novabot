import { getCommand } from "./command-loader.js";
import { parseCommand } from "./command-parser.js";
import { logger } from "./logger.js";

function getText(message) {
  const msg = message.message;

  return (
    msg?.conversation ||
    msg?.extendedTextMessage?.text ||
    msg?.imageMessage?.caption ||
    msg?.videoMessage?.caption ||
    msg?.documentMessage?.caption ||
    ""
  );
}

export async function handleCommand(message, prefix, socket) {
  const text = getText(message);
  const parsed = parseCommand(text, prefix);

  if (!parsed) return false;

  const command = getCommand(parsed.command);

  if (!command) return false;

  const jid = message.key.remoteJid;

  const context = {
    message,
    socket,
    command: parsed.command,
    args: parsed.args,
    raw: parsed.raw,
    jid,

    async reply(text) {
      return socket.sendMessage(jid, { text });
    }
  };

  try {
    await command.execute(context);
  } catch (error) {
    logger.error(
      `Command "${parsed.command}" failed: ${error.message}`
    );

    await context.reply(
      "Terjadi kesalahan saat menjalankan command."
    );
  }

  return true;
                          }
