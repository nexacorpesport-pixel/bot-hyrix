const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require("discord.js");

const CHANNEL_ID = "1487504426376630503";

// 🧠 État des systèmes
const systemStatus = {
  global: "online", // online | maintenance | error
  bot: "online",
  bienvenue: "online"
};

let statusMessage = null;
let startTime = Date.now();

// 🎨 Couleur selon état global
function getColor() {
  if (systemStatus.global === "maintenance") return 0xFFA500; // orange
  if (systemStatus.global === "error") return 0xFF0000; // rouge
  return 0x00FF00; // vert
}

// 🟢🔴🟡
function getEmoji(status) {
  if (status === "maintenance") return "🟡";
  if (status === "error") return "🔴";
  return "🟢";
}

// ⏱️ Uptime format
function formatUptime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${m}m ${s}s`;
}

// 📊 Générer embed
function generateEmbed(client, guild) {
  return new EmbedBuilder()
    .setTitle("📊 Statut du Bot")
    .setColor(getColor())
    .setDescription(
`> ${getEmoji(systemStatus.bot)} **Bot** : ${systemStatus.bot}
> ${getEmoji(systemStatus.bienvenue)} **Bienvenue** : ${systemStatus.bienvenue}

━━━━━━━━━━━━━━

👥 Membres : ${guild.memberCount}
📡 Ping : ${client.ws.ping}ms
⏱️ Uptime : ${formatUptime(Date.now() - startTime)}

━━━━━━━━━━━━━━

🔄 Mise à jour : <t:${Math.floor(Date.now()/1000)}:R>
${getEmoji(systemStatus.global)} **Statut global : ${systemStatus.global.toUpperCase()}**`
    )
    .setFooter({ text: "Ventrix • Monitoring système" });
}

// 🎛️ Menu sélection
function createMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("maintenance_menu")
      .setPlaceholder("⚙️ Gérer la maintenance")
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Bot ON")
          .setValue("bot_online"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Bot Maintenance")
          .setValue("bot_maintenance"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Bot Erreur")
          .setValue("bot_error"),

        new StringSelectMenuOptionBuilder()
          .setLabel("Bienvenue ON")
          .setValue("bienvenue_online"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Bienvenue Maintenance")
          .setValue("bienvenue_maintenance"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Bienvenue Erreur")
          .setValue("bienvenue_error"),

        new StringSelectMenuOptionBuilder()
          .setLabel("Global ON")
          .setValue("global_online"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Global Maintenance")
          .setValue("global_maintenance"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Global Erreur")
          .setValue("global_error")
      )
  );
}

// 🚀 Initialisation
async function initStatus(client) {
  const guild = client.guilds.cache.first();
  if (!guild) return;

  const channel = guild.channels.cache.get(CHANNEL_ID);
  if (!channel) return;

  // 🔍 Cherche ancien message
  const messages = await channel.messages.fetch({ limit: 10 });
  statusMessage = messages.find(m => m.author.id === client.user.id);

  // 🆕 Si pas trouvé → créer
  if (!statusMessage) {
    statusMessage = await channel.send({
      embeds: [generateEmbed(client, guild)],
      components: [createMenu()]
    });
  }

  // 🔄 Update toutes les 5 secondes
  setInterval(async () => {
    try {
      if (!statusMessage) return;

      await statusMessage.edit({
        embeds: [generateEmbed(client, guild)],
        components: [createMenu()]
      });
    } catch (err) {
      console.error("Erreur update statut :", err);
    }
  }, 5000);
}

// 🎮 Interaction menu
async function handleInteraction(interaction) {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== "maintenance_menu") return;

  const value = interaction.values[0];
  const [system, state] = value.split("_");

  systemStatus[system] = state;

  await interaction.reply({
    content: `✅ ${system} → ${state}`,
    ephemeral: true
  });
}

module.exports = {
  initStatus,
  handleInteraction
};
