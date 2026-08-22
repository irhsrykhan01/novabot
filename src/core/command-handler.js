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

async function react(socket, key, text) {
  try {
    await socket.sendMessage(key.remoteJid, {
      react: {
        text,
        key
      }
    });
  } catch (error) {
    logger.warn(`Failed to send reaction: ${error.message}`);
  }
}

export async function handleCommand(message, prefix, socket) {
  const text = getText(message);
  const parsed = parseCommand(text, prefix);

  if (!parsed) return false;

  const command = getCommand(parsed.command);

  if (!command) return false;

  const jid = message.key.remoteJid;

  // Mark message as read
  try {
    await socket.readMessages([message.key]);
  } catch (error) {
    logger.warn(`Failed to mark message as read: ${error.message}`);
  }

  // Processing
  await react(socket, message.key, "⏳");

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

    await react(socket, message.key, "✅");
  } catch (error) {
    logger.error(
      `Command "${parsed.command}" failed: ${error.message}`
    );

    await react(socket, message.key, "❌");

    await context.reply(
      "Terjadi kesalahan saat menjalankan command."
    );
  }

  return true;
    }
