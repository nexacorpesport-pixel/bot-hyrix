const {
    PermissionsBitField,
    ChannelType
} = require("discord.js");

// =========================
// CONFIG
// =========================
const ROLE_BUNKER = "1508091050932043897";
const ROLE_CEO = "1505330692106485781"; // CEO principal
const CEO_LIST = [
    "1360656494546387266",
    "1492655850483875901"
];

const BUNKER_CATEGORY = "1508090450102456360";
const LOGS_CHANNEL = "1508090725672288387";

// Clé ultra sécurisée (change si tu veux)
const BUNKER_KEY = "PX-BUNKER-9fX!2026#ULTRA_SECURE_KEY";

// =========================
// STATE GLOBAL
// =========================
let bunkerActive = false;
let pendingConfirm = new Map(); // double CEO confirmation

// =========================
// MAIN MODULE
// =========================
module.exports = (client) => {

    // =========================
    // COMMANDS
    // =========================
    client.on("messageCreate", async (message) => {

        if (message.author.bot) return;
        if (!message.guild) return;

        const args = message.content.split(" ");
        const cmd = args[0];

        // =========================
        // +bunker on
        // =========================
        if (cmd === "+bunker" && args[1] === "on") {

            const key = args.slice(2).join(" ");

            if (key !== BUNKER_KEY) {
                return message.reply("❌ Clé bunker invalide.");
            }

            if (!isCEO(message.member)) {
                return message.reply("❌ Tu n'es pas CEO.");
            }

            const userId = message.author.id;

            if (!pendingConfirm.has("on")) {
                pendingConfirm.set("on", new Set());
            }

            const set = pendingConfirm.get("on");
            set.add(userId);

            // attente 2 CEOs
            if (set.size < 2) {
                return message.reply("⏳ En attente du 2ème CEO pour activer le bunker.");
            }

            pendingConfirm.delete("on");

            await activateBunker(client, message.guild);

            return message.channel.send("🚨 MODE BUNKER ACTIVÉ !");
        }

        // =========================
        // +bunker off
        // =========================
        if (cmd === "+bunker" && args[1] === "off") {

            const key = args.slice(2).join(" ");

            if (key !== BUNKER_KEY) {
                return message.reply("❌ Clé bunker invalide.");
            }

            if (!isCEO(message.member)) {
                return message.reply("❌ Tu n'es pas CEO.");
            }

            const userId = message.author.id;

            if (!pendingConfirm.has("off")) {
                pendingConfirm.set("off", new Set());
            }

            const set = pendingConfirm.get("off");
            set.add(userId);

            if (set.size < 2) {
                return message.reply("⏳ En attente du 2ème CEO pour désactiver le bunker.");
            }

            pendingConfirm.delete("off");

            await deactivateBunker(client, message.guild);

            return message.channel.send("🟢 MODE BUNKER DÉSACTIVÉ !");
        }
    });

    // =========================
    // ANTI-BYPASS MESSAGE LOCK
    // =========================
    client.on("messageCreate", async (message) => {

        if (!bunkerActive) return;
        if (!message.guild) return;
        if (message.author.bot) return;

        const member = message.member;

        // autorisé bunker category
        if (message.channel.parentId === BUNKER_CATEGORY) return;

        if (!member.roles.cache.has(ROLE_BUNKER)) {
            await message.delete().catch(() => {});

            return message.channel.send({
                content: "🚨 Mode bunker actif : écriture bloquée.",
                ephemeral: true
            }).catch(() => {});
        }
    });

    // =========================
    // FUNCTIONS
    // =========================

    async function activateBunker(client, guild) {

        bunkerActive = true;

        const members = await guild.members.fetch();

        // 1. Give bunker role
        members.forEach(m => {
            if (!m.user.bot) {
                m.roles.add(ROLE_BUNKER).catch(() => {});
            }
        });

        // 2. Lock all channels
        guild.channels.cache.forEach(channel => {

            if (channel.type === ChannelType.GuildText) {

                if (channel.parentId === BUNKER_CATEGORY) return;

                channel.permissionOverwrites.edit(guild.roles.everyone, {
                    SendMessages: false,
                    ViewChannel: false
                }).catch(() => {});
            }
        });

        // 3. Log
        sendLog(client, guild, "🚨 BUNKER ACTIVÉ");
    }

    async function deactivateBunker(client, guild) {

        bunkerActive = false;

        const members = await guild.members.fetch();

        // 1. Remove bunker role
        members.forEach(m => {
            m.roles.remove(ROLE_BUNKER).catch(() => {});
        });

        // 2. Unlock channels
        guild.channels.cache.forEach(channel => {

            if (channel.type === ChannelType.GuildText) {

                channel.permissionOverwrites.edit(guild.roles.everyone, {
                    SendMessages: true,
                    ViewChannel: true
                }).catch(() => {});
            }
        });

        sendLog(client, guild, "🟢 BUNKER DÉSACTIVÉ");
    }

    function isCEO(member) {
        return member.roles.cache.has(ROLE_CEO) || CEO_LIST.includes(member.id);
    }

    function sendLog(client, guild, text) {

        const logChannel = guild.channels.cache.get(LOGS_CHANNEL);
        if (!logChannel) return;

        logChannel.send({
            content: `📌 ${text} | ${new Date().toLocaleString()}`
        }).catch(() => {});
    }
};
