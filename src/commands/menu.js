import { getCommands } from "../core/command-loader.js";

const CATEGORY_CONFIG = {
  general: {
    title: "General Menu",
    icon: "✨"
  },

  generator: {
    title: "Generator Menu",
    icon: "🎨"
  },

  utility: {
    title: "Utility Menu",
    icon: "🛠️"
  },

  media: {
    title: "Media Menu",
    icon: "🖼️"
  },

  downloader: {
    title: "Downloader Menu",
    icon: "📥"
  },

  tools: {
    title: "Tools Menu",
    icon: "🔧"
  },

  owner: {
    title: "Owner Menu",
    icon: "👑"
  },

  system: {
    title: "System Menu",
    icon: "⚙️"
  }
};

function formatCategory(
  category,
  commands
) {
  const config =
    CATEGORY_CONFIG[category] || {
      title:
        `${capitalize(category)} Menu`,
      icon: "📂"
    };

  const lines = [
    `│ ${config.icon}┊ ${config.title}`,
    "│╭──────────────────╯"
  ];

  for (const command of commands) {
    lines.push(
      `││• ${command.name}`
    );
  }

  lines.push(
    "│╰────────────────── · · ✦",
    ""
  );

  return lines;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() +
    text.slice(1);
}

function getUniqueCommands() {
  const commands = [
    ...getCommands().values()
  ];

  return commands
    .filter(
      (command, index, array) =>
        array.findIndex(
          item =>
            item.name === command.name
        ) === index
    )
    .sort(
      (a, b) =>
        a.name.localeCompare(
          b.name
        )
    );
}

function groupCommands(commands) {
  const groups = new Map();

  for (const command of commands) {
    const category =
      typeof command.category === "string" &&
      command.category.trim()
        ? command.category
            .trim()
            .toLowerCase()
        : "general";

    if (!groups.has(category)) {
      groups.set(
        category,
        []
      );
    }

    groups
      .get(category)
      .push(command);
  }

  return groups;
}

function buildMenu(
  commands,
  selectedCategory = null
) {
  const groups =
    groupCommands(commands);

  const output = [
    `*${process.env.BOT_NAME || "NovaBot"}*`,
    ""
  ];

  const orderedCategories = [
    "general",
    "generator",
    "utility",
    "media",
    "downloader",
    "tools",
    "owner",
    "system"
  ];

  const categories = [
    ...orderedCategories,
    ...[...groups.keys()].filter(
      category =>
        !orderedCategories.includes(
          category
        )
    )
  ];

  for (const category of categories) {
    if (
      selectedCategory &&
      category !== selectedCategory
    ) {
      continue;
    }

    const categoryCommands =
      groups.get(category);

    if (!categoryCommands?.length) {
      continue;
    }

    output.push(
      ...formatCategory(
        category,
        categoryCommands
      )
    );
  }

  return output.join("\n").trim();
}

export default {
  name: "menu",

  aliases: ["help"],

  category: "general",

  description:
    "Menampilkan daftar command.",

  async execute({
    args,
    reply
  }) {
    const commands =
      getUniqueCommands();

    const requestedCategory =
      args
        ?.join(" ")
        .trim()
        .toLowerCase() || null;

    if (
      requestedCategory &&
      requestedCategory === "allmenu"
    ) {
      await reply(
        buildMenu(commands)
      );

      return;
    }

    if (
      requestedCategory &&
      !commands.some(
        command =>
          command.category ===
          requestedCategory
      )
    ) {
      await reply(
        [
          `Kategori "${requestedCategory}" tidak ditemukan.`,
          "",
          "Gunakan .menu untuk melihat semua kategori."
        ].join("\n")
      );

      return;
    }

    await reply(
      buildMenu(
        commands,
        requestedCategory
      )
    );
  }
};
