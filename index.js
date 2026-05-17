const express = require("express");
const {
    Client,
    GatewayIntentBits
} = require("discord.js");

require("dotenv").config();

// ===== IMPORTS =====
const bienvenue = require("./events/bienvenue");
const onboarding = require("./events/onboarding");

const app = express();

const PORT = 3000;

// ===== SERVEUR WEB =====
app.get("/", (req, res) => {
    res.send("Pixar Bot is online.");
});

app.listen(PORT, () => {
    console.log(`🌐 Serveur web actif sur le port ${PORT}`);
});

// ===== CLIENT DISCORD =====
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// ===== READY =====
client.once("clientReady", () => {

    console.log("=================================");
    console.log(`✅ Connecté en tant que ${client.user.tag}`);
    console.log("🚀 Pixar Bot opérationnel");
    console.log("=================================");

});

// ===== MEMBER JOIN =====
client.on("guildMemberAdd", async (member) => {

    // MESSAGE BIENVENUE
    bienvenue(client, member);

    // ONBOARDING
    onboarding(client, member);

});

// ===== COMMANDE PING =====
client.on("messageCreate", async (message) => {

    if (message.author.bot) return;

    if (message.content === "!ping") {

        const latency = Date.now() - message.createdTimestamp;

        message.reply({
            content: `🏓 Pong ! \`${latency}ms\``
        });

    }

});

// ===== LOGIN =====
client.login(process.env.TOKEN);
