// ============================
// IMPORTS
// ============================
require('dotenv').config(); // Obligatoire pour .env

const express = require('express');
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');

// Import des systèmes
const bienvenue = require('./bienvenue');
const ticketSystem = require('./ticket'); // Assure-toi d’avoir ticket.js

// ============================
// CONFIG
// ============================
const app = express();
const PORT = process.env.PORT || 3000;
const GUILD_ID = "1455368732296872160"; // ID de ton serveur HoveX

// ============================
// CLIENT DISCORD
// ============================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,    // Obligatoire pour les événements de bienvenue
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ============================
// EVENT READY
// ============================
client.once('ready', async () => {
    console.log(`✅ Connecté en tant que ${client.user.tag}!`);

    // Mettre à jour le statut du bot
    const updateStatus = async () => {
        const guild = await client.guilds.fetch(GUILD_ID);
        const memberCount = guild.memberCount;

        const statuses = [
            { name: `${memberCount} membres`, type: ActivityType.Streaming, url: "https://twitch.tv/kyrelfn" },
            { name: "Surveille les membres", type: ActivityType.Streaming, url: "https://twitch.tv/kyrelfn" },
            { name: "Dev by Kyrel", type: ActivityType.Streaming, url: "https://twitch.tv/kyrelfn" }
        ];

        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        client.user.setActivity(randomStatus.name, { type: randomStatus.type, url: randomStatus.url });
    };

    updateStatus();
    setInterval(updateStatus, 30000); // Mise à jour toutes les 30 secondes

    // Initialisation du système de tickets
    if (typeof ticketSystem === "function") ticketSystem(client); 
});

// ============================
// EVENT BIENVENUE
// ============================
client.on('guildMemberAdd', member => {
    if (member.guild.id === GUILD_ID) {
        bienvenue(client, member);
    }
});

// ============================
// COMMANDES SIMPLES
// ============================
client.on('messageCreate', message => {
    if (message.content === '!ping') {
        message.channel.send('Pong');
    }
});

// ============================
// CONNEXION DU BOT
// ============================
client.login(process.env.TOKEN);

// ============================
// SERVEUR EXPRESS POUR RENDER
// ============================
app.get('/', (req, res) => {
    res.send('🚀 Bot HoveX actif !');
});

// ⚡ Important : utiliser uniquement process.env.PORT pour Render
app.listen(PORT, () => {
    console.log(`🌐 Serveur web actif sur le port ${PORT}`);
});
