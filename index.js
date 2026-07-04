require("dotenv").config();
const express = require("express");
const {
    Client,
    GatewayIntentBits,
    Partials,
    ActivityType
} = require("discord.js");

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
        Partials.Channel,
        Partials.Message, // Sécurité pour les anciens messages (utile pour l'anti-spam/logs)
        Partials.GuildMember // Sécurité pour le suivi des membres déconnectés
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
// CONFIG GLOBALS
// =========================
const GUILD_ID = "1501625824028266676";
const TWITCH_URL = "https://www.twitch.tv/teampyxar";
let index = 0;

// =========================
// STATUS SYSTEM
// =========================
async function updateStatus() {
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
                name: "Dev By Luxx"
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

// =========================
// READY EVENT
// =========================
client.once("ready", async () => {
    console.log(`✅ Logged as ${client.user.tag}`);

    try {
        // Initialisation de TOUS tes modules et systèmes
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

        // On attend 2 secondes avant de lancer le premier statut pour laisser le cache se stabiliser
        setTimeout(async () => {
            await updateStatus();
            setInterval(updateStatus, 30000);
        }, 2000);

    } catch (err) {
        console.log("❌ Erreur chargement systèmes :", err);
    }
});

// =========================
// BASIC COMMANDS
// =========================
client.on("messageCreate", async (message) => {
    try {
        if (message.author.bot) return;

        // Commande basique de vérification de présence
        if (message.content === "!ping") {
            const ping = Date.now() - message.createdTimestamp;
            return message.reply(`🏓 Pong : ${ping}ms`);
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
