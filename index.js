// Import des modules
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const express = require('express');
const app = express();

// ID du serveur
const GUILD_ID = "1455368732296872160";

// Création du bot Discord
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ] 
});

// Quand le bot est prêt
client.once('ready', async () => {
    console.log(`Connecté en tant que ${client.user.tag}!`);

    const guild = await client.guilds.fetch(GUILD_ID);

    // Fonction pour mettre à jour le statut
    const updateStatus = async () => {
        const memberCount = guild.memberCount;

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
                name: "Dev by Kyrel 👑",
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

    // Mise à jour immédiate
    updateStatus();

    // Mise à jour toutes les 30 secondes
    setInterval(updateStatus, 30000);
});

// Commande simple
client.on('messageCreate', message => {
    if (message.content === '!ping') {
        message.channel.send('Pong!');
    }
});

// Connexion du bot
client.login(process.env.TOKEN);

// Serveur express pour Render
app.get('/', (req, res) => {
    res.send('Bot Discord actif !');
});

app.listen(process.env.PORT || 3000, () => {
    console.log('Serveur web actif');
});
