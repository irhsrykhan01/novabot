function timestamp() {
  return new Date().toISOString();
}

function write(level, message) {
  console.log(`[${timestamp()}] [${level}] ${message}`);
}

export const logger = {
  info(message) {
    write("INFO", message);
  },

  warn(message) {
    write("WARN", message);
  },

  error(message) {
    write("ERROR", message);
  },

  debug(message) {
    if (process.env.NODE_ENV === "development") {
      write("DEBUG", message);
    }
  }
};
