const express = require("express");
const {
    Client,
    GatewayIntentBits,
    Partials,
    ActivityType,
    EmbedBuilder
} = require("discord.js");
require("dotenv").config();
const crypto = require("crypto");

// =========================
// EXPRESS
// =========================
const app = express();
const PORT = 3000;

app.get("/", (req, res) => {
    res.send("HoveX Bot Online");
});

app.listen(PORT, () => {
    console.log(`🌐 Web server running on port ${PORT}`);
});

// =========================
// DISCORD CLIENT
// =========================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildPresences
    ],
    partials: [
        Partials.Channel
    ]
});

// =========================
// IMPORT SYSTEMS & EVENTS
// =========================
const antiSpam = require("./events/antiSpam");
const onboarding = require("./events/onboarding");
const ticketSystem = require("./events/ticket");
const voiceTemp = require("./events/voiceTemp");
const moderation = require("./events/moderation");
const logsSystem = require("./events/logs");
const antiNuke = require("./events/antiNuke"); 
const bienvenue = require("./events/bienvenue");
const coaching = require("./events/coaching");

// =========================
// CONFIG STATUS & MAINTENANCE GLOBALS
// =========================
const GUILD_ID = "1501625824028266676";
const LOGS_CHANNEL = "1522690421027766553"; // Ton salon de logs privé
const INFO_CHANNEL_ID = "1522687549192273990"; // ID du salon 🚧┃infos-maintenance
const TWITCH_URL = "https://www.twitch.tv/teampyxar";
let index = 0;

// Variables Système de Maintenance
global.maintenanceMode = false;
let maintenanceKey = "";
let maintenanceMessageId = null;
let maintenanceEndTimestamp = null;

// Ordre précis de tes modules (Tous en rouge par défaut)
let maintenanceStats = {
    progress: "0%",
    botDb: "🔴 En attente",
    roles: "🔴 En attente",
    channels: "🔴 En attente",
    categories: "🔴 En attente",
    permissions: "🔴 En attente",
    tickets: "🔴 En attente",
    coaching: "🔴 En attente",
    security: "🔴 En attente",
    verification: "🔴 En attente"
};

// =========================
// STATUS SYSTEM
// =========================
async function updateStatus() {
    if (global.maintenanceMode) return;

    try {
        let guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
        
        const memberCount = guild ? guild.memberCount : 0;
        let status;

        if (index === 0) {
            status = {
                type: ActivityType.Streaming,
                name: "#HvXWIN 🩷🤍",
                url: TWITCH_URL
            };
        }
        else if (index === 1) {
            status = {
                type: ActivityType.Watching,
                name: `Surveille ${memberCount} membres`
            };
        }
        else {
            status = {
                type: ActivityType.Watching,
                name: "Dev By Zeynor"
            };
        }

        client.user.setPresence({
            activities: [status],
            status: "online"
        });

        index = (index + 1) % 3;
    } catch (err) {
        console.log("❌ Erreur status :", err);
    }
}

// Génération de l'affichage avec ton nouvel ordre de modules
function generateMaintenanceEmbed() {
    const timeString = maintenanceEndTimestamp ? `<t:${maintenanceEndTimestamp}:R> (prévu vers <t:${maintenanceEndTimestamp}:t>)` : "Non spécifiée";
    
    return new EmbedBuilder()
        .setColor("#ff3333")
        .setTitle("🚧 CONFIGURATION & MAINTENANCE GÉNÉRALE 🚧")
        .setDescription(`Le serveur HoveX subit actuellement une refonte complète.\n\n⏱️ **Fin de l'intervention :** ${timeString}\n\n⚠️ *La disparition des salons est normale durant l'opération.*`)
        .addFields(
            { name: "📊 Progression Globale", value: `\`\`\`[ ${maintenanceStats.progress} ]\`\`\`` },
            { name: "🤖 Base de données Bot", value: maintenanceStats.botDb, inline: true },
            { name: "🎭 Configuration Rôles", value: maintenanceStats.roles, inline: true },
            { name: "📁 Restructuration Salons", value: maintenanceStats.channels, inline: true },
            { name: "🗂️ Tri des Catégories", value: maintenanceStats.categories, inline: true },
            { name: "🔒 Permissions Salons", value: maintenanceStats.permissions, inline: true },
            { name: "🎫 Système de Tickets", value: maintenanceStats.tickets, inline: true },
            { name: "🧠 Pôle Coaching", value: maintenanceStats.coaching, inline: true },
            { name: "🛡️ Système Sécurité", value: maintenanceStats.security, inline: true },
            { name: "✅ Vérifications Finales", value: maintenanceStats.verification, inline: true }
        )
        .setFooter({ text: "HoveX Infrastructure" })
        .setTimestamp();
}

// =========================
// READY EVENT
// =========================
client.once("ready", async () => {
    console.log(`✅ Logged as ${client.user.tag}`);

    try {
        ticketSystem(client);
        voiceTemp(client);
        antiSpam(client);
        moderation(client);
        logsSystem(client);
        onboarding(client);
        antiNuke(client); 
        bienvenue(client);
        coaching(client);

        console.log("✅ Tous les systèmes chargés.");

        await updateStatus();
        setInterval(updateStatus, 30000);

    } catch (err) {
        console.log("❌ Erreur chargement systèmes :", err);
    }
});

// =========================
// INTERFACE DE MAINTENANCE
// =========================
client.on("messageCreate", async (message) => {
    try {
        if (message.author.bot) return;

        if (message.content === "!ping") {
            const ping = Date.now() - message.createdTimestamp;
            return message.reply(`🏓 Pong : ${ping}ms`);
        }

        if (message.channel.id === LOGS_CHANNEL) {
            const args = message.content.trim().split(/ +/);
            const command = args[0].toLowerCase();

            // 🛠️ !maintenance on
            if (command === "!maintenance" && args[1]?.toLowerCase() === "on") {
                if (global.maintenanceMode) return message.reply("⚠️ La maintenance est déjà active.");

                global.maintenanceMode = true;
                maintenanceKey = `HVX-MAINT-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
                maintenanceEndTimestamp = Math.floor((Date.now() + 6 * 60 * 60 * 1000) / 1000);

                // Statut bulle "Ne pas déranger" avec texte personnalisé
                client.user.setPresence({
                    activities: [{ name: "⚠️ Serveur en Maintenance...", type: ActivityType.Custom }],
                    status: "dnd"
                });

                const infoChannel = await message.guild.channels.fetch(INFO_CHANNEL_ID).catch(() => null);
                if (infoChannel) {
                    const pubMsg = await infoChannel.send({ embeds: [generateMaintenanceEmbed()] });
                    maintenanceMessageId = pubMsg.id;
                }

                return message.reply({
                    content: `🚨 **Maintenance activée !**\n\n🔑 **CLÉ SUPRÊME :** \`${maintenanceKey}\`\n📌 Salon d'affichage : <#${INFO_CHANNEL_ID}>.`
                });
            }

            // 🔓 !maintenance off [Clé]
            if (command === "!maintenance" && args[1]?.toLowerCase() === "off") {
                if (!global.maintenanceMode) return message.reply("⚠️ Maintenance non active.");
                if (args[2] !== maintenanceKey) return message.reply("❌ Clé invalide.");

                global.maintenanceMode = false;
                maintenanceKey = "";
                maintenanceMessageId = null;
                maintenanceEndTimestamp = null;
                
                // Reset complet des variables
                maintenanceStats = { progress: "0%", botDb: "🔴 En attente", roles: "🔴 En attente", channels: "🔴 En attente", categories: "🔴 En attente", permissions: "🔴 En attente", tickets: "🔴 En attente", coaching: "🔴 En attente", security: "🔴 En attente", verification: "🔴 En attente" };

                await updateStatus();
                return message.reply("✅ **Serveur réouvert.** Le bot reprend son rythme normal.");
            }

            // ⚡ +upstat [module] [texte]
            if (command === "+upstat") {
                if (!global.maintenanceMode) return message.reply("⚠️ Active d'abord la maintenance.");

                const moduleTarget = args[1]?.toLowerCase();
                const updatedValue = args.slice(2).join(" ");

                if (!moduleTarget || !updatedValue) {
                    return message.reply("ℹ️ **Utilisation :** `+upstat [progress/botdb/roles/channels/categories/permissions/tickets/coaching/security/verification] [Texte]`");
                }

                if (moduleTarget === "progress") maintenanceStats.progress = updatedValue;
                else if (moduleTarget === "botdb") maintenanceStats.botDb = updatedValue;
                else if (moduleTarget === "roles") maintenanceStats.roles = updatedValue;
                else if (moduleTarget === "channels") maintenanceStats.channels = updatedValue;
                else if (moduleTarget === "categories") maintenanceStats.categories = updatedValue;
                else if (moduleTarget === "permissions") maintenanceStats.permissions = updatedValue;
                else if (moduleTarget === "tickets") maintenanceStats.tickets = updatedValue;
                else if (moduleTarget === "coaching") maintenanceStats.coaching = updatedValue;
                else if (moduleTarget === "security") maintenanceStats.security = updatedValue;
                else if (moduleTarget === "verification") maintenanceStats.verification = updatedValue;
                else return message.reply("❌ Module introuvable.");

                const infoChannel = await message.guild.channels.fetch(INFO_CHANNEL_ID).catch(() => null);
                if (infoChannel && maintenanceMessageId) {
                    const targetMsg = await infoChannel.messages.fetch(maintenanceMessageId).catch(() => null);
                    if (targetMsg) {
                        await targetMsg.edit({ embeds: [generateMaintenanceEmbed()] });
                        return message.reply(`✅ Module \`${moduleTarget}\` mis à jour.`);
                    }
                }
                return message.reply("❌ Impossible d'éditer le panneau public.");
            }
        }
    } catch (err) {
        console.log("❌ Erreur messageCreate :", err);
    }
});

// =========================
// ERROR HANDLERS
// =========================
process.on("unhandledRejection", (err) => { console.log("❌ Unhandled Rejection:", err); });
process.on("uncaughtException", (err) => { console.log("❌ Uncaught Exception:", err); });

// =========================
// LOGIN
// =========================
client.login(process.env.TOKEN);
