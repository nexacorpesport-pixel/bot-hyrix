const express = require("express");

const {
    Client,
    GatewayIntentBits,
    Partials
} = require("discord.js");

require("dotenv").config();

// =========================
// EVENTS
// =========================

const onboarding = require("./events/onboarding");
const ticketSystem = require("./events/ticket");

// =========================
// EXPRESS
// =========================

const app = express();

const PORT = 3000;

// =========================
// WEB SERVER
// =========================

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
        GatewayIntentBits.MessageContent
    ],
    partials: [
        Partials.Channel
    ]
});

// =========================
// READY (CORRIGÉ ICI)
// =========================

client.once("ready", async () => {

    console.log(`✅ Logged as ${client.user.tag}`);

    // =========================
    // LOAD SYSTEMS
    // =========================

    ticketSystem(client);

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

    // Ignore bots
    if (message.author.bot) return;

    // =========================
    // PING COMMAND
    // =========================

    if (message.content === "!ping") {
        const ping = Date.now() - message.createdTimestamp;
        message.reply(`🏓 Pong : ${ping}ms`);
    }

});

// =========================
// LOGIN
// =========================

client.login(process.env.TOKEN);
