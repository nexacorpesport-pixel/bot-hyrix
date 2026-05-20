const express = require("express");
const {
    Client,
    GatewayIntentBits,
    Partials
} = require("discord.js");

require("dotenv").config();

const bienvenue = require("./events/bienvenue");
const onboarding = require("./events/onboarding");
const ticketSystem = require("./events/ticket");

const app = express();

const PORT = 3000;

// ===== WEB SERVER =====
app.get("/", (req, res) => {
    res.send("Pixar Bot Online");
});

app.listen(PORT, () => {
    console.log(`🌐 Web server running on port ${PORT}`);
});

// ===== DISCORD CLIENT =====
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

// ===== READY =====
client.once("clientReady", () => {
    console.log(`✅ Logged as ${client.user.tag}`);
});

// ===== MEMBER JOIN =====
client.on("guildMemberAdd", async (member) => {
    onboarding(client, member);
});

// ===== PING =====
client.on("messageCreate", async (message) => {

    if (message.author.bot) return;

    if (message.content === "!ping") {

        const ping = Date.now() - message.createdTimestamp;

        message.reply(`🏓 Pong : ${ping}ms`);

    }

});

client.login(process.env.TOKEN);
