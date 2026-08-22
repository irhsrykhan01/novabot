import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState
} from "@whiskeysockets/baileys";

import qrcode from "qrcode-terminal";

import config from "../config/index.js";
import { logger } from "./logger.js";
import { handleCommand } from "./command-handler.js";

const SESSION_PATH = "./session/baileys";

let socket = null;
let reconnectTimer = null;
let isConnecting = false;

export function getSocket() {
  return socket;
}

export async function connectWhatsApp() {
  if (isConnecting) {
    return socket;
  }

  isConnecting = true;

  try {
    const { state, saveCreds } =
      await useMultiFileAuthState(SESSION_PATH);

    const sock = makeWASocket({
      auth: state,
      markOnlineOnConnect: false
    });

    socket = sock;

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on(
      "connection.update",
      handleConnectionUpdate
    );

    sock.ev.on(
      "messages.upsert",
      handleMessages
    );

    isConnecting = false;

    return sock;
  } catch (error) {
    isConnecting = false;

    logger.error(
      `WhatsApp initialization failed: ${error.message}`
    );

    throw error;
  }
}

async function handleConnectionUpdate(update) {
  const {
    connection,
    lastDisconnect,
    qr
  } = update;

  if (qr) {
    logger.info("QR Code received.");

    console.log("");
    console.log("Scan this QR Code with WhatsApp:");
    console.log("");

    qrcode.generate(qr, {
      small: true
    });

    console.log("");
  }

  if (connection === "connecting") {
    logger.info("Connecting to WhatsApp...");
  }

  if (connection === "open") {
    logger.info("WhatsApp connection opened.");

    try {
      await socket.sendPresenceUpdate("available");

      logger.info("NovaBot presence: online.");
    } catch (error) {
      logger.warn(
        `Failed to set online presence: ${error.message}`
      );
    }

    logger.info("NovaBot is online.");

    return;
  }

  if (connection === "close") {
    socket = null;

    const statusCode =
      lastDisconnect?.error?.output?.statusCode;

    const shouldReconnect =
      statusCode !== DisconnectReason.loggedOut;

    logger.warn(
      `WhatsApp connection closed. Code: ${
        statusCode ?? "unknown"
      }`
    );

    if (!shouldReconnect) {
      logger.error(
        "WhatsApp session was logged out."
      );

      logger.info(
        "Delete the session folder and start again to generate a new QR."
      );

      return;
    }

    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) {
    return;
  }

  logger.info(
    "Reconnecting to WhatsApp in 3 seconds..."
  );

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;

    try {
      await connectWhatsApp();
    } catch (error) {
      logger.error(
        `Reconnect failed: ${error.message}`
      );

      scheduleReconnect();
    }
  }, 3000);
}

async function handleMessages(event) {
  if (event.type !== "notify") {
    return;
  }

  for (const message of event.messages) {
    if (message.key?.fromMe) {
      continue;
    }

    const remoteJid =
      message.key?.remoteJid;

    if (!remoteJid) {
      continue;
    }

    logger.debug(
      `Message received from ${remoteJid}`
    );

    await handleCommand(
      message,
      config.command.prefix,
      socket
    );
  }
}

export function disconnectWhatsApp() {
  if (!socket) {
    return;
  }

  try {
    socket.ws?.close();
  } catch (error) {
    logger.warn(
      `Socket shutdown warning: ${error.message}`
    );
  }

  socket = null;
}
