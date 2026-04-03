// ============================
// IMPORTS
// ============================
require('dotenv').config();
const express = require('express');
const { 
    Client, 
    GatewayIntentBits, 
    ActivityType, 
    ChannelType, 
    PermissionsBitField, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');

const bienvenue = require('./bienvenue'); // ton fichier de bienvenue

// ============================
// CONFIG
// ============================
const PORT = process.env.PORT || 3000;
const GUILD_ID = "1487418699303620650"; // Serveur HoveX

// ============================
// CLIENT DISCORD
// ============================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ============================
// READY
// ============================
client.once('ready', async () => {
    console.log(`✅ Connecté en tant que ${client.user.tag}!`);

    // Statut dynamique
    const updateStatus = async () => {
        const guild = await client.guilds.fetch(GUILD_ID);
        const memberCount = guild.memberCount;

        const statuses = [
            { name: `${memberCount} membres`, type: ActivityType.Streaming, url: "https://twitch.tv/kyrelfn" },
            { name: "Surveille les membres", type: ActivityType.Streaming, url: "https://twitch.tv/kyrelfn" },
            { name: "Dev by zxlorz", type: ActivityType.Streaming, url: "https://twitch.tv/kyrelfn" }
        ];

        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        client.user.setActivity(randomStatus.name, { type: randomStatus.type, url: randomStatus.url });
    };

    updateStatus();
    setInterval(updateStatus, 30000);

    // Initialisation du système de tickets
    if (typeof ticketSystem === "function") ticketSystem(client);
});

// ============================
// BIENVENUE
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
        message.channel.send('Pong !');
    }
});

// ============================
// CONNEXION DU BOT
// ============================
client.login(process.env.TOKEN);

// ============================
// SERVEUR EXPRESS
// ============================
const app = express();

app.get('/', (req, res) => {
    res.send('🚀 Bot HoveX actif !');
});

// ⚡ Express écoute seulement sur process.env.PORT
app.listen(PORT, () => {
    console.log(`🌐 Serveur web actif sur le port ${PORT}`);
});
