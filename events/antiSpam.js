const {
    PermissionsBitField
} = require("discord.js");

const MESSAGE_LIMIT = 5;
const MESSAGE_INTERVAL = 10 * 1000;

const JOIN_LIMIT = 10;
const JOIN_INTERVAL = 15 * 1000;

const userMessages = new Map();
const userWarnings = new Map();
const joinTracker = new Map();

module.exports = (client) => {

    console.log("[ANTISPAM] Système chargé");

    // =========================
    // MESSAGE ANTI-SPAM
    // =========================

    client.on("messageCreate", async (message) => {

        if (!message.guild) return;
        if (message.author.bot) return;

        const userId = message.author.id;
        const now = Date.now();

        // =========================
        // COOLDOWN TRACK
        // =========================

        if (!userMessages.has(userId)) {
            userMessages.set(userId, []);
        }

        const timestamps = userMessages.get(userId);

        // garder messages récents
        const filtered = timestamps.filter(t => now - t < MESSAGE_INTERVAL);

        filtered.push(now);
        userMessages.set(userId, filtered);

        // =========================
        // DETECT SPAM
        // =========================

        if (filtered.length >= MESSAGE_LIMIT) {

            const member = message.member;

            if (!member) return;

            let warns = userWarnings.get(userId) || 0;
            warns++;

            userWarnings.set(userId, warns);

            // =========================
            // 1er spam
            // =========================

            if (warns === 1) {

                await message.channel.bulkDelete(10).catch(() => {});

                return message.channel.send(
                    `⚠️ ${message.author}, arrête de spam. C'est interdit sur ce serveur.`
                ).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
            }

            // =========================
            // 2e spam = timeout
            // =========================

            if (warns >= 2) {

                await message.channel.bulkDelete(10).catch(() => {});

                await member.timeout(10 * 60 * 1000, "Spam messages");

                return message.channel.send(
                    `🔒 ${message.author} a été mute 10 minutes pour spam.`
                );
            }
        }
    });

    // =========================
    // ANTI JOIN RAID
    // =========================

    client.on("guildMemberAdd", async (member) => {

        const guild = member.guild;
        const now = Date.now();

        if (!joinTracker.has(guild.id)) {
            joinTracker.set(guild.id, []);
        }

        const joins = joinTracker.get(guild.id);

        const filtered = joins.filter(t => now - t < JOIN_INTERVAL);

        filtered.push(now);
        joinTracker.set(guild.id, filtered);

        if (filtered.length >= JOIN_LIMIT) {

            console.log("[ANTIRAID] Raid détecté !");

            // mode lock simple (optionnel)
            const channels = guild.channels.cache.filter(c => c.isTextBased());

            channels.forEach(ch => {
                ch.permissionOverwrites.edit(guild.roles.everyone, {
                    SendMessages: false
                }).catch(() => {});
            });

            // notification console
            console.log("[ANTIRAID] Serveur lock temporaire activé");
        }
    });

};
