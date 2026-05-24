const express = require("express");

const {
    Client,
    GatewayIntentBits,
    Partials,
    ActivityType,
    EmbedBuilder
} = require("discord.js");

require("dotenv").config();

// =========================
// EXPRESS
// =========================
const app = express();

const PORT = 3000;

app.get("/", (req, res) => {
    res.send("🚧 Pyxar Maintenance Mode");
});

app.listen(PORT, () => {
    console.log(`🌐 Maintenance server running on port ${PORT}`);
});

// =========================
// CONFIG
// =========================
const GUILD_ID = "1505330441274658876";

const CEO_ROLE = "1505330692106485781";

const MAINTENANCE_ROLE = "1508206039151935578";

// CHANNELS
const MAINTENANCE_ANNONCE = "1508207035852787742";
const MAINTENANCE_INFOS = "1508207063132803113";
const MAINTENANCE_STATUS = "1508207088248033311";
const MAINTENANCE_TIMER = "1508207128920461372";

// =========================
// DISCORD CLIENT
// =========================
const client = new Client({

    intents: [

        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences

    ],

    partials: [
        Partials.Channel
    ]

});

// =========================
// MAINTENANCE CONFIG
// =========================

// ⏰ Heure de fin maintenance
// FORMAT : année, mois-1, jour, heure, minute
const maintenanceEnd =
    new Date(2026, 4, 24, 4, 37, 0);

// =========================
// FORMAT TIME
// =========================
function formatDuration(ms) {

    const totalSeconds = Math.floor(ms / 1000);

    const hours =
        Math.floor(totalSeconds / 3600);

    const minutes =
        Math.floor((totalSeconds % 3600) / 60);

    const seconds =
        totalSeconds % 60;

    return `${hours}h ${minutes}m ${seconds}s`;
}

// =========================
// READY
// =========================
client.once("clientReady", async () => {

    console.log(`✅ Maintenance connecté : ${client.user.tag}`);

    try {

        const guild =
            client.guilds.cache.get(GUILD_ID);

        if (!guild) {
            return console.log("❌ Serveur introuvable.");
        }

        // =========================
        // STATUS BOT
        // =========================
        client.user.setPresence({

            activities: [

                {
                    type: ActivityType.Watching,
                    name: "🚧 Système en maintenance"
                }

            ],

            status: "dnd"

        });

        console.log("✅ Status maintenance activé.");

        // =========================
        // CHANNELS
        // =========================
        const annonceChannel =
            guild.channels.cache.get(MAINTENANCE_ANNONCE);

        const infosChannel =
            guild.channels.cache.get(MAINTENANCE_INFOS);

        const statusChannel =
            guild.channels.cache.get(MAINTENANCE_STATUS);

        const timerChannel =
            guild.channels.cache.get(MAINTENANCE_TIMER);

        // =========================
        // CLEAR CHANNELS
        // =========================
        async function clearChannel(channel) {

            if (!channel) return;

            const messages =
                await channel.messages.fetch({
                    limit: 100
                });

            await channel.bulkDelete(messages, true)
                .catch(() => {});
        }

        await clearChannel(annonceChannel);
        await clearChannel(infosChannel);
        await clearChannel(statusChannel);
        await clearChannel(timerChannel);

        // =========================
        // DONNER ROLE MAINTENANCE
        // =========================
        const members =
            await guild.members.fetch();

        for (const member of members.values()) {

            if (member.user.bot) continue;

            // CEO IGNORÉS
            if (
                member.roles.cache.has(CEO_ROLE)
            ) continue;

            await member.roles.add(
                MAINTENANCE_ROLE
            ).catch(() => {});
        }

        console.log("✅ Rôle maintenance attribué.");

        // =========================
        // EMBED ANNONCE
        // =========================
        const annonceEmbed =
            new EmbedBuilder()

            .setColor("#ffcc00")

            .setTitle("🚧 Maintenance Pyxar")

            .setDescription(`
Le serveur est actuellement en maintenance.

Nos équipes travaillent actuellement sur plusieurs systèmes de sécurité avancés afin d'améliorer la stabilité et la protection du serveur.

Merci de votre patience 💛🤍
            `)

            .setFooter({
                text: "Team Pyxar"
            })

            .setTimestamp();

        await annonceChannel.send({
            embeds: [annonceEmbed]
        });

        // =========================
        // EMBED INFOS
        // =========================
        const infosEmbed =
            new EmbedBuilder()

            .setColor("#2b2d31")

            .setTitle("📌 Informations Maintenance")

            .setDescription(`
### Maintenance en cours

Cette maintenance est liée :

• aux systèmes de sécurité
• aux protections anti-raid
• aux protections anti-abus
• aux systèmes bunker
• aux systèmes de logs
• aux protections vocales
• aux protections permissions
• aux optimisations générales

Les développeurs travaillent actuellement afin de corriger plusieurs problèmes techniques détectés récemment.

Merci de votre compréhension.
            `)

            .setFooter({
                text: "Dev By Vyrn"
            })

            .setTimestamp();

        await infosChannel.send({
            embeds: [infosEmbed]
        });

        // =========================
        // EMBED STATUS
        // =========================
        const statusEmbed =
            new EmbedBuilder()

            .setColor("#ff0000")

            .setTitle("📡 État des systèmes")

            .setDescription(`
🔴 Ticket System  
🔴 VoiceTemp  
🔴 Logs System  
🔴 AntiSpam  
🔴 Moderation  
🔴 Bunker System  
🔴 Onboarding  
🔴 Permissions  
🔴 Sécurité Serveur  
🔴 Systèmes Vocaux  
🔴 Protection AntiRaid  
🔴 API Interne  
🔴 Protection Liens  
🔴 TempChannels  
🔴 Automodération  

Tous les systèmes sont actuellement hors ligne.
            `)

            .setFooter({
                text: "Pyxar Security"
            })

            .setTimestamp();

        await statusChannel.send({
            embeds: [statusEmbed]
        });

        // =========================
        // TIMER MESSAGE
        // =========================
        const timerMessage =
            await timerChannel.send("⏳ Initialisation...");

        async function updateTimer() {

            const now = new Date();

            const remaining =
                maintenanceEnd - now;

            if (remaining <= 0) {

                return timerMessage.edit(`
# ✅ Maintenance terminée

Le serveur revient progressivement en ligne.
                `);
            }

            await timerMessage.edit(`
# ⏳ Temps restant avant retour

🚧 Retour estimé dans :

## ${formatDuration(remaining)}

🕒 Heure estimée :
<t:${Math.floor(maintenanceEnd.getTime() / 1000)}:F>

Merci de votre patience 💛🤍
            `);
        }

        updateTimer();

        setInterval(updateTimer, 1000);

        console.log("✅ Maintenance totalement activée.");

    } catch (err) {

        console.log("❌ Erreur maintenance :");
        console.log(err);

    }
});

// =========================
// COMMANDES MAINTENANCE
// =========================
client.on("messageCreate", async (message) => {

    try {

        if (message.author.bot) return;

        if (!message.guild) return;

        // =========================
        // +maintenance on
        // =========================
        if (
            message.content.toLowerCase()
            === "+maintenance on"
        ) {

            // CHECK CEO
            if (
                !message.member.roles.cache.has(
                    CEO_ROLE
                )
            ) {

                return message.reply(
                    "❌ Tu n'es pas autorisé."
                );
            }

            return message.reply(
                "✅ Maintenance déjà active."
            );
        }

    } catch (err) {

        console.log("❌ Erreur commande maintenance :");
        console.log(err);

    }
});

// =========================
// ERROR HANDLERS
// =========================
process.on("unhandledRejection", (err) => {

    console.log("❌ Unhandled Rejection:");
    console.log(err);

});

process.on("uncaughtException", (err) => {

    console.log("❌ Uncaught Exception:");
    console.log(err);

});

// =========================
// LOGIN
// =========================
client.login(process.env.TOKEN);
