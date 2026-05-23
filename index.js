const express = require("express");

const {
    Client,
    GatewayIntentBits,
    Partials
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
// EVENTS IMPORT
// =========================

const onboarding = require("./events/onboarding");
const ticketSystem = require("./events/ticket");
const voiceTemp = require("./events/voiceTemp");

// =========================
// LOAD SYSTEMS
// =========================

// ⚠️ IMPORTANT
// ON CHARGE LES EVENTS AVANT LE READY

ticketSystem(client);
voiceTemp(client);

// =========================
// READY
// =========================

client.once("ready", async () => {

    console.log(`✅ Logged as ${client.user.tag}`);

});

// =========================
// MEMBER JOIN
// =========================

client.on("guildMemberAdd", async (member) => {

    onboarding(client, member);

});

// =========================
// MESSAGE CREATE
// =========================

client.on("messageCreate", async (message) => {

    if (message.author.bot) return;

    // =========================
    // PING
    // =========================

    if (message.content === "!ping") {

        const ping = Date.now() - message.createdTimestamp;

        message.reply(`🏓 Pong : ${ping}ms`);

    }

});

// =========================
// ERROR HANDLER
// =========================

process.on("unhandledRejection", (err) => {
    console.log("❌ Unhandled Rejection:", err);
});

process.on("uncaughtException", (err) => {
    console.log("❌ Uncaught Exception:", err);
});

// =========================
// LOGIN
// =========================

client.login(process.env.TOKEN);
