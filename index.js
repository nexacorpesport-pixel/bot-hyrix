const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");
require("dotenv").config();

const app = express();

const PORT = 3000;

// ===== SERVEUR WEB =====
app.get("/", (req, res) => {
    res.send("Ventrix Bot is online.");
});

app.listen(PORT, () => {
    console.log(`🌐 Serveur web actif sur le port ${PORT}`);
});

// ===== BOT DISCORD =====
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once("clientReady", () => {
    console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

// ===== COMMANDE !ping =====
client.on("messageCreate", (message) => {

    if (message.author.bot) return;

    if (message.content === "!ping") {
        message.reply("🏓 Pong !");
    }

});

client.login(process.env.TOKEN);
