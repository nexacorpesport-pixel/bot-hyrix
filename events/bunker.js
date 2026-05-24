const {
    PermissionsBitField,
    ChannelType,
    EmbedBuilder
} = require("discord.js");

// =========================
// CONFIG
// =========================

const CONFIG = {
    ROLE_BUNKER: "1508091050932043897",
    ROLE_CEO: "1505330692106485781",

    CEO_ALLOWED: [
        "1360656494546387266",
        "1492655850483875901"
    ],

    CATEGORY_BUNKER: "1508090450102456360",
    LOGS: "1508090725672288387",
    STAFF: "1508090668315312350",

    SECRET_KEY: "PX-BUNKER-9fX!2026#ULTRA_SECURE_KEY"
};

// =========================
// STATE
// =========================

let bunkerState = {
    enabled: false,
    pending: null
};

// =========================
// UTILS SAFE
// =========================

async function safeEdit(channel, perms) {
    try {
        await channel.permissionOverwrites.edit(channel.guild.id, perms);
    } catch (e) {}
}

// =========================
// MODULE
// =========================

module.exports = (client) => {

    console.log("[BUNKER] Loaded");

    // =========================
    // ANTI WRITE MESSAGE (LOCK EFFECT)
    // =========================
    client.on("messageCreate", async (message) => {

        if (!message.guild) return;
        if (message.author.bot) return;

        if (!bunkerState.enabled) return;

        const isBunkerChannel = message.channel.parentId === CONFIG.CATEGORY_BUNKER;

        // autorisé dans bunker category
        if (isBunkerChannel) return;

        // autoriser CEO et staff bunker
        if (message.member.roles.cache.has(CONFIG.ROLE_CEO)) return;

        // suppression + warning
        await message.delete().catch(() => {});

        return message.channel.send({
            content: "🚨 Le mode BUNKER est activé. Vous ne pouvez pas écrire ici."
        }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    });

    // =========================
    // COMMANDES
    // =========================
    client.on("messageCreate", async (message) => {

        if (!message.guild || message.author.bot) return;

        const member = message.member;
        if (!member.roles.cache.has(CONFIG.ROLE_CEO)) return;

        const args = message.content.trim().split(" ");

        // =========================
        // ON
        // =========================
        if (args[0] === "+bunker" && args[1] === "on") {

            if (bunkerState.enabled) {
                return message.reply("⚠️ Bunker déjà actif.");
            }

            bunkerState.pending = {
                requester: message.author.id
            };

            return message.reply(
                "🛡️ Activation demandée.\n" +
                "👉 2e CEO doit confirmer :\n" +
                "`+bunker confirm <clé>`"
            );
        }

        // =========================
        // CONFIRM
        // =========================
        if (args[0] === "+bunker" && args[1] === "confirm") {

            if (!bunkerState.pending) {
                return message.reply("❌ Rien en attente.");
            }

            const key = args.slice(2).join(" ");

            if (key !== CONFIG.SECRET_KEY) {
                return message.reply("❌ Clé invalide.");
            }

            if (!CONFIG.CEO_ALLOWED.includes(message.author.id)) {
                return message.reply("❌ Pas autorisé.");
            }

            bunkerState.enabled = true;
            bunkerState.pending = null;

            await activateBunker(client, message.guild);

            return message.reply("🚨 BUNKER ACTIVÉ");
        }

        // =========================
        // OFF
        // =========================
        if (args[0] === "+bunker" && args[1] === "off") {

            const key = args.slice(2).join(" ");

            if (key !== CONFIG.SECRET_KEY) {
                return message.reply("❌ Clé invalide.");
            }

            bunkerState.enabled = false;

            await deactivateBunker(client, message.guild);

            return message.reply("✅ BUNKER DÉSACTIVÉ");
        }
    });
};

// =========================
// ACTIVATE
// =========================

async function activateBunker(client, guild) {

    const logs = guild.channels.cache.get(CONFIG.LOGS);
    const staff = guild.channels.cache.get(CONFIG.STAFF);

    const embed = new EmbedBuilder()
        .setTitle("🚨 BUNKER ACTIVÉ")
        .setColor("Red")
        .setDescription("Serveur sécurisé.");

    if (logs) logs.send({ embeds: [embed] });
    if (staff) staff.send({ embeds: [embed] });

    // LOCK ALL CHANNELS sauf bunker category
    guild.channels.cache.forEach(async (channel) => {

        if (channel.type !== ChannelType.GuildText) return;
        if (channel.parentId === CONFIG.CATEGORY_BUNKER) return;

        await safeEdit(channel, {
            SendMessages: false
        });
    });
}

// =========================
// DEACTIVATE
// =========================

async function deactivateBunker(client, guild) {

    const logs = guild.channels.cache.get(CONFIG.LOGS);

    const embed = new EmbedBuilder()
        .setTitle("✅ BUNKER OFF")
        .setColor("Green");

    if (logs) logs.send({ embeds: [embed] });

    // UNLOCK ALL CHANNELS
    guild.channels.cache.forEach(async (channel) => {

        if (channel.type !== ChannelType.GuildText) return;

        await safeEdit(channel, {
            SendMessages: true
        }).catch(() => {});
    });

    // 🔥 SUPPRESSION DU RÔLE BUNKER AUX MEMBRES
    const role = guild.roles.cache.get(CONFIG.ROLE_BUNKER);

    if (role) {
        guild.members.cache.forEach(member => {
            member.roles.remove(role).catch(() => {});
        });
    }
}
