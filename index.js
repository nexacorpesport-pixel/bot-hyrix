require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const {
    Client,
    GatewayIntentBits,
    Partials,
    ActivityType
} = require("discord.js");

// Initialisation Base de données Coaching
const COACHING_DB_PATH = path.join(__dirname, "./data/coaching_database.json");
if (!fs.existsSync(path.dirname(COACHING_DB_PATH))) {
    fs.mkdirSync(path.dirname(COACHING_DB_PATH), { recursive: true });
}
if (!fs.existsSync(COACHING_DB_PATH)) {
    fs.writeFileSync(COACHING_DB_PATH, JSON.stringify({ dashboardMessageId: null, sessions: [] }, null, 4));
}

// =========================
// EXPRESS
// =========================
const app = express();
const PORT = 3000;
app.get("/", (req, res) => { res.send("Aeroz Esports Bot Online & Ready"); });
app.listen(PORT, () => { console.log(`🌐 Web server running on port ${PORT}`); });

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
        Partials.Message,
        Partials.GuildMember
    ]
});

// =========================
// IMPORT SYSTEMS & EVENTS
// =========================
const antiSpam = require("./events/antiSpam");
const ticketSystem = require("./events/ticket");
const voiceTemp = require("./events/voiceTemp");
const moderation = require("./events/moderation");
const logsSystem = require("./events/logs");
const antiNuke = require("./events/antiNuke"); 
const bienvenue = require("./events/bienvenue");
const coaching = require("./events/coaching");
const tournamentSystem = require("./events/tournament");
const statsSystem = require("./events/stats_system"); // À la place de "./events/stats"

const GUILD_ID = "1528107464908603657";
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
            status = { type: ActivityType.Streaming, name: "#ARZWIN", url: TWITCH_URL };
        } else if (index === 1) {
            status = { type: ActivityType.Watching, name: `Surveille ${memberCount} membres` };
        } else {
            status = { type: ActivityType.Watching, name: "Dev By Lyzo" };
        }

        client.user.setPresence({ activities: [status], status: "online" });
        index = (index + 1) % 3;
    } catch (err) {
        console.log("❌ Erreur status :", err);
    }
}

// =========================
// READY EVENT (MODE DIAGNOSTIC)
// =========================
client.once("ready", async () => {
    console.log(`✅ Connecté en tant que ${client.user.tag}`);
    try {
        console.log("⏳ Chargement : Ticket...");
        ticketSystem(client);
        
        console.log("⏳ Chargement : VoiceTemp...");
        voiceTemp(client);
        
        console.log("⏳ Chargement : AntiSpam...");
        antiSpam(client);
        
        console.log("⏳ Chargement : Moderation...");
        moderation(client);
        
        console.log("⏳ Chargement : Logs...");
        logsSystem(client);
        
        console.log("⏳ Chargement : AntiNuke...");
        antiNuke(client); 
        
        console.log("⏳ Chargement : Bienvenue...");
        bienvenue(client);
        
        console.log("⏳ Chargement : Coaching...");
        coaching(client);
        
        console.log("⏳ Chargement : Effectif...");
        effectifSystem(client);

        console.log("⏳ Chargement : Tournament...");
        tournamentSystem(client);

        console.log("⏳ Chargement : Stats...");
        statsSystem(client);

        console.log("✅ TOUS LES SYSTÈMES ONT ÉTÉ CHARGÉS AVEC SUCCÈS !");

        setTimeout(async () => {
            await updateStatus();
            await setInterval(updateStatus, 30000);
        }, 2000);
    } catch (err) {
        console.log("❌ CRASH PENDANT LE CHARGEMENT :", err);
    }
});

// =========================
// COMMANDES ET CONTRÔLE
// =========================
client.on("messageCreate", async (message) => {
    try {
        if (message.author.bot) return;

        if (message.content === "!ping") {
            const ping = Date.now() - message.createdTimestamp;
            return message.reply(`🏓 Pong : ${ping}ms`);
        }

    } catch (err) {
        console.log("❌ Erreur messageCreate :", err);
    }
});

process.on("unhandledRejection", (err) => { console.log("❌ Unhandled Rejection:", err); });
process.on("uncaughtException", (err) => { console.log("❌ Uncaught Exception:", err); });

client.login(process.env.TOKEN);
