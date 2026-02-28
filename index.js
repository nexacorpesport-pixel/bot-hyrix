// Import des modules
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const express = require('express');
const app = express();

// Import du système de bienvenue
const bienvenue = require('./bienvenue');

// ID du serveur
const GUILD_ID = "1455368732296872160";

// Création du bot Discord
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, // IMPORTANT pour bienvenue
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ] 
});

// Quand le bot est prêt
client.once('ready', async () => {
    console.log(`Connecté en tant que ${client.user.tag}!`);

    const guild = await client.guilds.fetch(GUILD_ID);

    const updateStatus = async () => {
        const updatedGuild = await client.guilds.fetch(GUILD_ID);
        const memberCount = updatedGuild.memberCount;

        const statuses = [
            {
                name: `${memberCount} membres`,
                type: ActivityType.Streaming,
                url: "https://twitch.tv/kyrelfn"
            },
            {
                name: "Surveille les membres 👀",
                type: ActivityType.Streaming,
                url: "https://twitch.tv/kyrelfn"
            },
            {
                name: "HoveX Community 💎",
                type: ActivityType.Streaming,
                url: "https://twitch.tv/kyrelfn"
            }
        ];

        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

        client.user.setActivity(randomStatus.name, {
            type: randomStatus.type,
            url: randomStatus.url
        });
    };

    updateStatus();
    setInterval(updateStatus, 30000);
});

// 🔥 Event bienvenue
client.on('guildMemberAdd', member => {
    if (member.guild.id === GUILD_ID) {
        bienvenue(client, member);
    }
});

// Commande test
client.on('messageCreate', message => {
    if (message.content === '!ping') {
        message.channel.send('Pong!');
    }
});

// Connexion du bot
client.login(process.env.TOKEN);

// Serveur express pour Render
app.get('/', (req, res) => {
    res.send('Bot Discord actif');
});

app.listen(process.env.PORT || 3000, () => {
    console.log('Serveur web actif');
});
