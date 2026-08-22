import { getCommand } from "./command-loader.js";
import { parseCommand } from "./command-parser.js";
import { logger } from "./logger.js";

function getText(message) {
  const msg = message?.message;

  if (!msg) {
    return "";
  }

  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.documentMessage?.caption ||
    ""
  ).trim();
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
    logger.warn(
      `Failed to send reaction "${text}": ${error.message}`
    );
  }
}

async function markAsRead(socket, key) {
  try {
    await socket.readMessages([key]);
  } catch (error) {
    logger.warn(
      `Failed to mark message as read: ${error.message}`
    );
  }
}

export async function handleCommand(message, prefix, socket) {
  const jid = message?.key?.remoteJid;

  if (!jid) {
    return false;
  }

  const text = getText(message);

  logger.debug(
    `Command text: ${JSON.stringify(text)}`
  );

  const parsed = parseCommand(text, prefix);

  if (!parsed) {
    return false;
  }

  logger.debug(
    `Parsed command: ${parsed.command}`
  );

  // Pesan command sudah dikenali.
  await markAsRead(socket, message.key);
  await react(socket, message.key, "⏳");

  const command = getCommand(parsed.command);

  if (!command) {
    logger.debug(
      `Command not found: ${parsed.command}`
    );

    await react(socket, message.key, "❌");

    await socket.sendMessage(jid, {
      text: `Command "${parsed.command}" tidak ditemukan.`
    });

    return false;
  }

  const context = {
    message,
    socket,
    command: parsed.command,
    args: parsed.args,
    raw: parsed.raw,
    jid,

    async reply(text) {
      return socket.sendMessage(jid, {
        text
      });
    }
  };

  try {
    await command.execute(context);

    await react(socket, message.key, "✅");

    return true;
  } catch (error) {
    logger.error(
      `Command "${parsed.command}" failed: ${error.message}`
    );

    await react(socket, message.key, "❌");

    await context.reply(
      `Command "${parsed.command}" gagal: ${error.message}`
    );

    return true;
  }
}
