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
        GatewayIntentBits.GuildVoiceStates // 🔥 OBLIGATOIRE POUR VOICE SYSTEM
    ],
    partials: [
        Partials.Channel
    ]
});

// =========================
// EVENTS
// =========================

const onboarding = require("./events/onboarding");
const ticketSystem = require("./events/ticket");
const voiceTemp = require("./events/voiceTemp"); // ✅ juste import

// =========================
// READY
// =========================

client.once("ready", async () => {

    console.log(`✅ Logged as ${client.user.tag}`);

    // LOAD SYSTEMS ICI (PAS AVANT)
    ticketSystem(client);
    voiceTemp(client); // ✅ FIX ICI

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

    if (message.content === "!ping") {
        const ping = Date.now() - message.createdTimestamp;
        message.reply(`🏓 Pong : ${ping}ms`);
    }

});

// =========================
// LOGIN
// =========================

client.login(process.env.TOKEN);
