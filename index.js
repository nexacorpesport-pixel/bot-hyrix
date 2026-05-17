const express = require("express");
const {
    Client,
    GatewayIntentBits
} = require("discord.js");

require("dotenv").config();

// ===== IMPORT EVENT =====
const bienvenue = require("./events/bienvenue");

const app = express();

const PORT = 3000;

// ===== SERVEUR WEB =====
app.get("/", (req, res) => {
    res.send("Pixar Bot is online.");
});

app.listen(PORT, () => {
    console.log(`🌐 Serveur web actif sur le port ${PORT}`);
});

// ===== BOT DISCORD =====
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
    console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

// ===== EVENT BIENVENUE =====
client.on("guildMemberAdd", async (member) => {
    bienvenue(client, member);
});

// ===== COMMANDE !ping =====
client.on("messageCreate", (message) => {

    if (message.author.bot) return;

    if (message.content === "!ping") {

        const latency = Date.now() - message.createdTimestamp;

        message.reply(`🏓 Pong ! \`${latency}ms\``);

    }

});

client.login(process.env.TOKEN);
