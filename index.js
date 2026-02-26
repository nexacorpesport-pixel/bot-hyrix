require('dotenv').config(); // TOUT EN HAUT

const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Serveur web (obligatoire pour Render)
app.get('/', (req, res) => {
  res.send('AXION BOT ACTIF');
});

app.listen(PORT, () => {
  console.log(`Serveur actif sur le port ${PORT}`);
});

// Bot Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(`Connecté en tant que ${client.user.tag}`);
});

client.on('messageCreate', message => {
  if (message.content === '!ping') {
    message.reply('Pong 🏓');
  }
});

// Connexion du bot avec le token dans .env
client.login(process.env.TOKEN);