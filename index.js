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
    res.send("Pyxar Bot Online");
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
        GatewayIntentBits.GuildVoiceStates
    ],

    partials: [
        Partials.Channel
    ]
});

// =========================
// IMPORT EVENTS
// =========================
const antiSpam = require("./events/antiSpam");
const onboarding = require("./events/onboarding");
const ticketSystem = require("./events/ticket");
const voiceTemp = require("./events/voiceTemp");
const moderation = require("./events/moderation");

// =========================
// CONFIG STATUS
// =========================
const GUILD_ID = "1505330441274658876";
const TWITCH_URL = "https://www.twitch.tv/teampyxar";

let index = 0;

// =========================
// STATUS SYSTEM
// =========================
async function updateStatus() {

    const guild = client.guilds.cache.get(GUILD_ID);
    const memberCount = guild ? guild.memberCount : 0;

    let status;

    if (index === 0) {

        status = {
            type: ActivityType.Streaming,
            name: "#PXRWIN 💛🤍",
            url: TWITCH_URL
        };

    } else if (index === 1) {

        status = {
            type: ActivityType.Watching,
            name: `Surveille ${memberCount} membres 👀`
        };

    } else {

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
}

// =========================
// READY
// =========================
client.once("ready", async () => {

    console.log(`✅ Logged as ${client.user.tag}`);

    try {

        ticketSystem(client);
        voiceTemp(client);
        antiSpam(client);
        moderation(client);

        // 🔥 BUNKER SYSTEM CHARGÉ AVEC STATE
        bunkerSystem(client, bunkerState);

        console.log("✅ Tous les systèmes chargés.");

        updateStatus();
        setInterval(updateStatus, 30000);

        console.log("🔁 Status rotatif activé.");

    } catch (err) {
        console.log("❌ Erreur chargement systèmes :", err);
    }
});

// =========================
// MEMBER JOIN
// =========================
client.on("guildMemberAdd", async (member) => {
    onboarding(client, member);
});

// =========================
// MESSAGE CREATE (PING ONLY)
// =========================
client.on("messageCreate", async (message) => {

    if (message.author.bot) return;

    if (message.content === "!ping") {

        const ping = Date.now() - message.createdTimestamp;

        return message.reply(`🏓 Pong : ${ping}ms`);
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
