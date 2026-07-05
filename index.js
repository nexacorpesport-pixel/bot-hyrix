require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const {
    Client,
    GatewayIntentBits,
    Partials,
    ActivityType
} = require("discord.js");

// =========================
// ÉTAT DE SÉCURITÉ (LOCKDOWN)
// =========================
// Passe à true par défaut pour protéger immédiatement au démarrage, ou utilise les commandes !lockdown on/off
let LOCKDOWN_MODE = true; 

const COACHING_DB_PATH = path.join(__dirname, "./data/coaching_database.json");
if (!fs.existsSync(path.dirname(COACHING_DB_PATH))) {
    fs.mkdirSync(path.dirname(COACHING_DB_PATH), { recursive: true });
}
if (!fs.existsSync(COACHING_DB_PATH)) {
    fs.writeFileSync(COACHING_DB_PATH, JSON.stringify({ dashboardMessageId: null, sessions: [] }, null, 4));
}

// =========================
// EXPRESS
// =========================
const app = express();
const PORT = 3000;
app.get("/", (req, res) => { res.send("HoveX Bot Online & Protected"); });
app.listen(PORT, () => { console.log(`🌐 Web server running on port ${PORT}`); });

// =========================
// DISCORD CLIENT
// =========================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildPresences
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.GuildMember
    ]
});

// =========================
// IMPORT SYSTEMS & EVENTS
// =========================
const antiSpam = require("./events/antiSpam");
const ticketSystem = require("./events/ticket");
const voiceTemp = require("./events/voiceTemp");
const moderation = require("./events/moderation");
const logsSystem = require("./events/logs");
const antiNuke = require("./events/antiNuke"); 
const bienvenue = require("./events/bienvenue");
const coaching = require("./events/coaching");

const GUILD_ID = "1501625824028266676";
const TWITCH_URL = "https://www.twitch.tv/teampyxar";
let index = 0;

// =========================
// STATUS SYSTEM (MODIFIÉ)
// =========================
async function updateStatus() {
    try {
        if (LOCKDOWN_MODE) {
            // Statut d'alerte maximale si le confinement est actif
            client.user.setPresence({
                activities: [{
                    type: ActivityType.Custom,
                    name: "🚨 URGENCE : Serveur Sécurisé [Raid Protection]"
                }],
                status: "dnd" // Mode Ne Pas Déranger (Rouge)
            });
            return;
        }

        let guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
        
        const memberCount = guild ? guild.memberCount : 0;
        let status;

        if (index === 0) {
            status = { type: ActivityType.Streaming, name: "#HvXWIN 🩷🤍", url: TWITCH_URL };
        } else if (index === 1) {
            status = { type: ActivityType.Watching, name: `Surveille ${memberCount} membres` };
        } else {
            status = { type: ActivityType.Watching, name: "Dev By Luxx" };
        }

        client.user.setPresence({ activities: [status], status: "online" });
        index = (index + 1) % 3;
    } catch (err) {
        console.log("❌ Erreur status :", err);
    }
}

// =========================
// READY EVENT
// =========================
client.once("ready", async () => {
    console.log(`✅ Logged as ${client.user.tag}`);
    try {
        ticketSystem(client);
        voiceTemp(client);
        antiSpam(client);
        moderation(client);
        logsSystem(client);
        antiNuke(client); 
        bienvenue(client);
        coaching(client);

        console.log("✅ Tous les systèmes chargés.");
        if (LOCKDOWN_MODE) console.log("🚨 ATTENTION : LE MODE LOCKDOWN EST ACTIF !");

        setTimeout(async () => {
            await updateStatus();
            setInterval(updateStatus, 30000);
        }, 2000);
    } catch (err) {
        console.log("❌ Erreur chargement systèmes :", err);
    }
});

// =========================
// SÉCURITÉ ANTI-RAID (NEW)
// =========================
client.on("guildMemberAdd", async (member) => {
    if (!LOCKDOWN_MODE) return;

    try {
        // Envoi du message explicatif privé en toute discrétion
        await member.send({
            content: "⚠️ **Accès Refusé** : Le serveur **HoveX** est actuellement inaccessible et placé sous protection maximale en raison d'une menace de Raid. Les invitations sont temporairement suspendues. Merci de réessayer plus tard."
        }).catch(() => console.log(`Impossible d'envoyer un MP à ${member.user.tag}`));

        // Kick automatique et instantané du membre
        await member.kick("Mode confinement actif : Menace de Raid ou d'attaque massive.");
        console.log(`🚨 [ANTI-RAID] Utilisateur exclu instantanément : ${member.user.tag}`);
    } catch (error) {
        console.log(`❌ Erreur lors de l'expulsion anti-raid de ${member.user.tag} :`, error);
    }
});

// =========================
// COMMANDES ET CONTRÔLE
// =========================
client.on("messageCreate", async (message) => {
    try {
        if (message.author.bot) return;

        if (message.content === "!ping") {
            const ping = Date.now() - message.createdTimestamp;
            return message.reply(`🏓 Pong : ${ping}ms`);
        }

        // Commande d'urgence pour activer/désactiver le protocole
        if (message.content.startsWith("!lockdown")) {
            // Vérifie si l'utilisateur est Administrateur sur le serveur
            if (!message.member.permissions.has("Administrator")) {
                return message.reply("❌ Vous n'avez pas la permission d'utiliser le protocole d'urgence.");
            }

            const args = message.content.split(" ")[1];

            if (args === "on") {
                LOCKDOWN_MODE = true;
                await updateStatus();
                return message.reply("🚨 **PROTOCOLE DE CONFINEMENT ACTIVÉ.** Tous les nouveaux membres seront désormais exclus automatiquement.");
            } 
            
            if (args === "off") {
                LOCKDOWN_MODE = false;
                await updateStatus();
                return message.reply("✅ **PROTOCOLE DE CONFINEMENT DÉSACTIVÉ.** Le serveur accepte à nouveau les nouveaux membres.");
            }

            return message.reply("Statut actuel du confinement : " + (LOCKDOWN_MODE ? "🔴 ACTIF (!lockdown off pour couper)" : "🟢 INACTIF (!lockdown on pour activer)"));
        }

    } catch (err) {
        console.log("❌ Erreur messageCreate :", err);
    }
});

process.on("unhandledRejection", (err) => { console.log("❌ Unhandled Rejection:", err); });
process.on("uncaughtException", (err) => { console.log("❌ Uncaught Exception:", err); });

client.login(process.env.TOKEN);
