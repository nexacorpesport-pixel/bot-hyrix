const express = require("express");

const {
    Client,
    GatewayIntentBits,
    Partials,
    ActivityType
} = require("discord.js");

require("dotenv").config();

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
// IMPORT EVENTS
// =========================
const antiSpam = require("./events/antiSpam");
const onboarding = require("./events/onboarding"); // Ton fichier onboarding.js
const ticketSystem = require("./events/ticket");
const voiceTemp = require("./events/voiceTemp");
const moderation = require("./events/moderation");
const logsSystem = require("./events/logs");

// =========================
// CONFIG STATUS
// =========================
const GUILD_ID = "1505330441274658876";

const TWITCH_URL =
    "https://www.twitch.tv/teampyxar";

let index = 0;

// =========================
// STATUS SYSTEM
// =========================
async function updateStatus() {

    try {

        const guild =
            client.guilds.cache.get(GUILD_ID);

        const memberCount =
            guild ? guild.memberCount : 0;

        let status;

        // =========================
        // STATUS 1
        // =========================
        if (index === 0) {

            status = {

                type: ActivityType.Streaming,

                name: "#HvXWIN 🩷🤍",

                url: TWITCH_URL

            };

        }

        // =========================
        // STATUS 2
        // =========================
        else if (index === 1) {

            status = {

                type: ActivityType.Watching,

                name: `Surveille ${memberCount} membres 👀`

            };

        }

        // =========================
        // STATUS 3
        // =========================
        else {

            status = {

                type: ActivityType.Watching,

                name: "Dev By Vyrn 🧑‍💻"

            };

        }

        client.user.setPresence({

            activities: [status],

            status: "online"

        });

        index = (index + 1) % 3;

    } catch (err) {

        console.log("❌ Erreur status :");
        console.log(err);

    }
}

// =========================
// READY (CORRIGÉ : "ready" au lieu de "clientReady")
// =========================
client.once("ready", async () => {

    console.log(`✅ Logged as ${client.user.tag}`);

    try {

        // =========================
        // LOAD SYSTEMS
        // =========================

        ticketSystem(client);

        voiceTemp(client);

        antiSpam(client);

        moderation(client);

        logsSystem(client);

        onboarding(client); // FIX : On initialise l'onboarding ici au démarrage comme les autres systèmes

        console.log("✅ Tous les systèmes chargés.");

        // =========================
        // START STATUS
        // =========================

        await updateStatus();

        setInterval(updateStatus, 30000);

        console.log("🔁 Status rotatif activé.");

    } catch (err) {

        console.log("❌ Erreur chargement systèmes :");
        console.log(err);

    }
});

// =========================
// MESSAGE CREATE
// =========================
client.on("messageCreate", async (message) => {

    try {

        if (message.author.bot) return;

        // =========================
        // PING
        // =========================
        if (message.content === "!ping") {

            const ping =
                Date.now() - message.createdTimestamp;

            return message.reply(
                `🏓 Pong : ${ping}ms`
            );
        }

    } catch (err) {

        console.log("❌ Erreur messageCreate :");
        console.log(err);

    }
});

// =========================
// ERROR HANDLERS
// =========================
process.on("unhandledRejection", (err) => {

    console.log("❌ Unhandled Rejection:");
    console.log(err);

});

process.on("uncaughtException", (err) => {

    console.log("❌ Uncaught Exception:");
    console.log(err);

});

// =========================
// LOGIN
// =========================
client.login(process.env.TOKEN);
