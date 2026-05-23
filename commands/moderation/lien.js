const fs = require("fs");
const path = require("path");

const {
    PermissionsBitField,
    EmbedBuilder
} = require("discord.js");

const PREFIX = "+";

const dataPath = path.join(__dirname, "../../data/antilink.json");

// =====================================================
// CREATE JSON IF NOT EXISTS
// =====================================================

if (!fs.existsSync(dataPath)) {

    fs.writeFileSync(
        dataPath,
        JSON.stringify({}, null, 4)
    );

}

// =====================================================
// LOAD DATA
// =====================================================

function loadData() {

    return JSON.parse(fs.readFileSync(dataPath));

}

function saveData(data) {

    fs.writeFileSync(
        dataPath,
        JSON.stringify(data, null, 4)
    );

}

// =====================================================
// SCAM DOMAINS
// =====================================================

const scamDomains = [

    "dlscord",
    "d1scord",
    "discord-free",
    "steamnitro",
    "free-nitro",
    "nitro-free",
    "stearncornmunity",
    "disc0rd",
    "grabify",
    "iplogger",
    "bit.ly",
    "tinyurl",
    "rb.gy",
    "cutt.ly"

];

// =====================================================
// LINK REGEX
// =====================================================

const linkRegex =
/(https?:\/\/[^\s]+)|(discord\.gg\/[^\s]+)|(discord\.com\/invite\/[^\s]+)|(www\.[^\s]+)/gi;

// =====================================================
// MODULE EXPORT
// =====================================================

module.exports = (client) => {

    console.log("[ANTILINK] Système chargé.");

    // =====================================================
    // MESSAGE CREATE
    // =====================================================

    client.on("messageCreate", async (message) => {

        if (!message.guild) return;

        if (message.author.bot) return;

        // =====================================================
        // LOAD GUILD DATA
        // =====================================================

        const data = loadData();

        if (!data[message.guild.id]) {

            data[message.guild.id] = {

                enabled: false,
                punishment: "delete",
                logs: null,
                whitelistRoles: [],
                whitelistChannels: []

            };

            saveData(data);

        }

        const guildData = data[message.guild.id];

        // =====================================================
        // COMMANDS
        // =====================================================

        if (!message.content.startsWith(PREFIX)) return;

        const args =
            message.content.slice(PREFIX.length).trim().split(/ +/);

        const command = args.shift()?.toLowerCase();

        // =====================================================
        // ANTILINK COMMAND
        // =====================================================

        if (command === "antilink") {

            if (
                !message.member.permissions.has(
                    PermissionsBitField.Flags.Administrator
                )
            ) {

                return message.reply(
                    "❌ Permission refusée."
                );

            }

            const sub = args[0];

            // =====================================================
            // ON
            // =====================================================

            if (sub === "on") {

                guildData.enabled = true;

                saveData(data);

                return message.reply(
                    "✅ Anti-liens activé."
                );

            }

            // =====================================================
            // OFF
            // =====================================================

            if (sub === "off") {

                guildData.enabled = false;

                saveData(data);

                return message.reply(
                    "❌ Anti-liens désactivé."
                );

            }

            // =====================================================
            // PUNISHMENT
            // =====================================================

            if (sub === "punishment") {

                const type = args[1];

                const allowed = [
                    "delete",
                    "warn",
                    "timeout",
                    "kick",
                    "ban"
                ];

                if (!allowed.includes(type)) {

                    return message.reply(
                        "❌ Punishments : delete / warn / timeout / kick / ban"
                    );

                }

                guildData.punishment = type;

                saveData(data);

                return message.reply(
                    `✅ Punition définie sur : ${type}`
                );

            }

            // =====================================================
            // LOGS
            // =====================================================

            if (sub === "logs") {

                const channel =
                    message.mentions.channels.first();

                if (!channel) {

                    return message.reply(
                        "❌ Mentionne un salon."
                    );

                }

                guildData.logs = channel.id;

                saveData(data);

                return message.reply(
                    `✅ Salon logs : ${channel}`
                );

            }

            // =====================================================
            // WHITELIST ROLE
            // =====================================================

            if (sub === "whitelistrole") {

                const role =
                    message.mentions.roles.first();

                if (!role) {

                    return message.reply(
                        "❌ Mentionne un rôle."
                    );

                }

                if (
                    guildData.whitelistRoles.includes(role.id)
                ) {

                    return message.reply(
                        "❌ Déjà whitelist."
                    );

                }

                guildData.whitelistRoles.push(role.id);

                saveData(data);

                return message.reply(
                    `✅ Rôle whitelist : ${role}`
                );

            }

            // =====================================================
            // WHITELIST CHANNEL
            // =====================================================

            if (sub === "whitelistchannel") {

                const channel =
                    message.mentions.channels.first();

                if (!channel) {

                    return message.reply(
                        "❌ Mentionne un salon."
                    );

                }

                if (
                    guildData.whitelistChannels.includes(channel.id)
                ) {

                    return message.reply(
                        "❌ Déjà whitelist."
                    );

                }

                guildData.whitelistChannels.push(channel.id);

                saveData(data);

                return message.reply(
                    `✅ Salon whitelist : ${channel}`
                );

            }

            // =====================================================
            // STATUS
            // =====================================================

            if (sub === "status") {

                const embed = new EmbedBuilder()

                    .setColor("#ffb347")

                    .setTitle("🛡️ Anti-Link Status")

                    .addFields(

                        {
                            name: "Statut",
                            value:
                            guildData.enabled
                                ? "✅ Activé"
                                : "❌ Désactivé"
                        },

                        {
                            name: "Punition",
                            value:
                            guildData.punishment
                        },

                        {
                            name: "Logs",
                            value:
                            guildData.logs
                                ? `<#${guildData.logs}>`
                                : "❌ Aucun"
                        }

                    );

                return message.reply({
                    embeds: [embed]
                });

            }

        }

        // =====================================================
        // CHECK ENABLED
        // =====================================================

        if (!guildData.enabled) return;

        // =====================================================
        // WHITELIST ROLE
        // =====================================================

        const hasWhitelistRole =
            message.member.roles.cache.some(role =>
                guildData.whitelistRoles.includes(role.id)
            );

        if (hasWhitelistRole) return;

        // =====================================================
        // WHITELIST CHANNEL
        // =====================================================

        if (
            guildData.whitelistChannels.includes(
                message.channel.id
            )
        ) return;

        // =====================================================
        // DETECT LINKS
        // =====================================================

        const content =
            message.content.toLowerCase();

        const hasLink =
            linkRegex.test(content);

        const isScam =
            scamDomains.some(domain =>
                content.includes(domain)
            );

        if (!hasLink && !isScam) return;

        // =====================================================
        // DELETE MESSAGE
        // =====================================================

        await message.delete().catch(() => {});

        // =====================================================
        // LOG EMBED
        // =====================================================

        const logEmbed = new EmbedBuilder()

            .setColor("#ff0000")

            .setTitle("🚨 Lien détecté")

            .addFields(

                {
                    name: "Utilisateur",
                    value:
                    `${message.author}`
                },

                {
                    name: "Salon",
                    value:
                    `${message.channel}`
                },

                {
                    name: "Message",
                    value:
                    message.content.slice(0, 1000)
                },

                {
                    name: "Type",
                    value:
                    isScam
                        ? "☣️ Scam / Phishing"
                        : "🔗 Lien"
                },

                {
                    name: "Punition",
                    value:
                    guildData.punishment
                }

            )

            .setTimestamp();

        // =====================================================
        // SEND LOGS
        // =====================================================

        if (guildData.logs) {

            const logsChannel =
                message.guild.channels.cache.get(
                    guildData.logs
                );

            if (logsChannel) {

                logsChannel.send({
                    embeds: [logEmbed]
                }).catch(() => {});

            }

        }

        // =====================================================
        // PUNISHMENTS
        // =====================================================

        switch (guildData.punishment) {

            case "warn":

                message.channel.send({
                    content:
                    `⚠️ ${message.author} les liens sont interdits.`
                });

                break;

            case "timeout":

                await message.member.timeout(
                    10 * 60 * 1000,
                    "Anti-link"
                ).catch(() => {});

                break;

            case "kick":

                await message.member.kick(
                    "Anti-link"
                ).catch(() => {});

                break;

            case "ban":

                await message.member.ban({
                    reason: "Anti-link"
                }).catch(() => {});

                break;

        }

    });

};
