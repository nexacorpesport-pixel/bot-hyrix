// ============================
// IMPORTS
// ============================
require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');

const bienvenue = require('./bienvenue');
const statutBot = require('./statutBot');

// ============================
// CONFIG
// ============================
const PORT = process.env.PORT || 3000;
const GUILD_ID = "1487418699303620650";

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
client.once('clientReady', async () => {
    console.log(`✅ Connecté en tant que ${client.user.tag}!`);

    const guild = await client.guilds.fetch(GUILD_ID);

    const updateStatus = async () => {
        const memberCount = guild.memberCount;

        const statuses = [
            { name: `${memberCount} membres`, type: ActivityType.Streaming, url: "https://twitch.tv/kyrelfn" },
            { name: "Surveille les membres", type: ActivityType.Streaming, url: "https://twitch.tv/kyrelfn" },
            { name: "Dev by Logs", type: ActivityType.Streaming, url: "https://twitch.tv/kyrelfn" }
        ];

        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

        client.user.setActivity(randomStatus.name, {
            type: randomStatus.type,
            url: randomStatus.url
        });
    };

    updateStatus();
    setInterval(updateStatus, 30000);

    statutBot.initStatus(client);
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
// COMMANDES
// ============================
client.on('messageCreate', message => {
    if (message.author.bot) return;

    if (message.content === '!ping') {
        message.channel.send('Pong !');
    }
});

// ============================
// INTERACTIONS
// ============================
client.on('interactionCreate', async (interaction) => {
    statutBot.handleInteraction(interaction);
});

// ============================
// CONNEXION
// ============================
client.login(process.env.TOKEN);

// ============================
// SERVEUR EXPRESS
// ============================
const app = express();

app.get('/', (req, res) => {
    res.send('🚀 Bot actif !');
});

app.listen(PORT, () => {
    console.log(`🌐 Serveur web actif sur le port ${PORT}`);
});
