require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');

// ============================
// CONFIG
// ============================
const app = express();
const PORT = process.env.PORT || 3000;

const GUILD_ID = "1455368732296872160";
const WELCOME_CHANNEL_ID = "1456080758815850679"; // Salon de bienvenue

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
// READY EVENT
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
            { name: "Dev by Kyrel", type: ActivityType.Streaming, url: "https://twitch.tv/kyrelfn" }
        ];

        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        client.user.setActivity(randomStatus.name, { type: randomStatus.type, url: randomStatus.url });
    };

    updateStatus();
    setInterval(updateStatus, 30000);
});

// ============================
// BIENVENUE
// ============================
client.on('guildMemberAdd', async member => {
    if (member.guild.id !== GUILD_ID) return;

    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!channel) return;

    try {
        const invites = await member.guild.invites.fetch();
        const invite = invites.find(i => i.uses > 0 && i.inviter);

        let inviterTag = "Inconnu";
        let inviteCount = 0;

        if (invite && invite.inviter) {
            inviterTag = invite.inviter.tag;
            inviteCount = invite.uses;
        }

        const message = `
**Bienvenue sur HoveX**

*${member.user.username}*, nous sommes heureux de vous accueillir au sein du serveur.

Vous êtes le **${member.guild.memberCount}ème membre**.

Vous avez été invité par **${inviterTag}**, qui comptabilise désormais **${inviteCount} invitation(s)**.

Nous vous souhaitons une excellente intégration parmi nous.
        `;

        await channel.send(message);

    } catch (err) {
        console.error("Erreur système bienvenue :", err);
    }
});

// ============================
// CONNEXION DISCORD
// ============================
client.login(process.env.TOKEN);

// ============================
// SERVEUR EXPRESS
// ============================
app.get('/', (req, res) => res.send('🚀 Bot HoveX actif !'));

// ⚡ Gestion du port pour éviter EADDRINUSE
const server = app.listen(PORT, () => {
    console.log(`🌐 Serveur web actif sur le port ${PORT}`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} déjà utilisé, impossible de démarrer le serveur !`);
        process.exit(1);
    } else {
        console.error('Erreur serveur :', err);
    }
});
