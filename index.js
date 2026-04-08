// ============================
// IMPORTS
// ============================
require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');

const bienvenue = require('./bienvenue');

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

    try {
        const guild = await client.guilds.fetch(GUILD_ID);

        const updateStatus = async () => {
            const memberCount = guild.memberCount;

            const statuses = [
                { name: `${memberCount} membres`, type: ActivityType.Watching },
                { name: "Surveille les membres", type: ActivityType.Watching },
                { name: "Dev by Logs", type: ActivityType.Playing }
            ];

            const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

            client.user.setActivity(randomStatus.name, {
                type: randomStatus.type
            });
        };

        updateStatus();
        setInterval(updateStatus, 30000);

    } catch (err) {
        console.error("Erreur récupération serveur :", err);
    }
});

// ============================
// BIENVENUE
// ============================
client.on('guildMemberAdd', async (member) => {
    try {
        if (member.guild.id === GUILD_ID) {
            await bienvenue(client, member);
        }
    } catch (err) {
        console.error("Erreur événement membre :", err);
    }
});

// ============================
// COMMANDES
// ============================
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '+ping') {
        message.channel.send('🏓 Pong !');
    }
});

// ============================
// CONNEXION
// ============================
client.login(process.env.TOKEN);

// ============================
// SERVEUR EXPRESS (ANTI-SLEEP)
// ============================
const app = express();

app.get('/', (req, res) => {
    res.send('🚀 Bot actif !');
});

app.listen(PORT, () => {
    console.log(`🌐 Serveur web actif sur le port ${PORT}`);
});
