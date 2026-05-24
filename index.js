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
    res.send("Pyxar Bot Online");
});

app.listen(PORT, () => {
    console.log(`🌐 Web server running on port ${PORT}`);
});

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
        Partials.Channel
    ]

});

// =========================
// IMPORT EVENTS
// =========================
const antiSpam = require("./events/antiSpam");
const onboarding = require("./events/onboarding");
const ticketSystem = require("./events/ticket");
const voiceTemp = require("./events/voiceTemp");
const moderation = require("./events/moderation");
const logsSystem = require("./events/logs");

// =========================
// CONFIG
// =========================
const GUILD_ID = "1505330441274658876";

const TWITCH_URL =
    "https://www.twitch.tv/teampyxar";

// =========================
// MAINTENANCE CONFIG
// =========================
const maintenanceState = {

    enabled: false

};

// =========================
// CHANNELS MAINTENANCE
// =========================
const MAINTENANCE_ANNONCE =
    "1508207035852787742";

const MAINTENANCE_INFO =
    "1508207063132803113";

const MAINTENANCE_STATUS =
    "1508207088248033311";

const MAINTENANCE_TIMER =
    "1508207128920461372";

// =========================
// TIMER CONFIG
// =========================
const MAINTENANCE_END =
    new Date("2026-05-24T04:37:00").getTime();

// =========================
// STATUS ROTATIF
// =========================
let index = 0;

async function updateStatus() {

    try {

        // =========================
        // MAINTENANCE STATUS
        // =========================
        if (maintenanceState.enabled) {

            client.user.setPresence({

                activities: [{

                    type: ActivityType.Watching,

                    name: "🔧 Système en maintenance"

                }],

                status: "dnd"

            });

            return;

        }

        // =========================
        // NORMAL STATUS
        // =========================
        const guild =
            client.guilds.cache.get(GUILD_ID);

        const memberCount =
            guild ? guild.memberCount : 0;

        let status;

        // STATUS 1
        if (index === 0) {

            status = {

                type: ActivityType.Streaming,

                name: "#PXRWIN 💛🤍",

                url: TWITCH_URL

            };

        }

        // STATUS 2
        else if (index === 1) {

            status = {

                type: ActivityType.Watching,

                name: `Surveille ${memberCount} membres 👀`

            };

        }

        // STATUS 3
        else {

            status = {

                type: ActivityType.Watching,

                name: "Dev By Vyrn 🧑‍💻"

            };

        }

        client.user.setPresence({

            activities: [status],

            status: "online"

        });

        index = (index + 1) % 3;

    } catch (err) {

        console.log("❌ Erreur status :");
        console.log(err);

    }
}

// =========================
// MAINTENANCE SYSTEM
// =========================
async function updateMaintenanceChannels() {

    try {

        if (!maintenanceState.enabled) return;

        const annonce =
            await client.channels.fetch(
                MAINTENANCE_ANNONCE
            );

        const info =
            await client.channels.fetch(
                MAINTENANCE_INFO
            );

        const status =
            await client.channels.fetch(
                MAINTENANCE_STATUS
            );

        const timer =
            await client.channels.fetch(
                MAINTENANCE_TIMER
            );

        // =========================
        // CALCUL TIMER
        // =========================
        const now = Date.now();

        const diff =
            MAINTENANCE_END - now;

        const hours =
            Math.floor(diff / 3600000);

        const minutes =
            Math.floor(
                (diff % 3600000) / 60000
            );

        const seconds =
            Math.floor(
                (diff % 60000) / 1000
            );

        // =========================
        // RENAME TIMER CHANNEL
        // =========================
        await timer.setName(
            `⏳・${hours}h ${minutes}m ${seconds}s`
        );

        // =========================
        // ANNONCE
        // =========================
        const annonceEmbed =
            new EmbedBuilder()

            .setColor("#f1c40f")

            .setTitle(
                "🔧 Maintenance en cours"
            )

            .setDescription(`

Une maintenance importante est actuellement en cours sur Team Pyxar.

Nos équipes travaillent actuellement sur :

• Correctifs de sécurité
• Optimisation des systèmes
• Stabilisation du bot
• Correctifs bunker
• Optimisation anti-raid
• Optimisation logs
• Optimisation tickets
• Optimisation vocal temporaire

Merci de votre patience 💛🤍

            `)

            .setFooter({
                text: "Team Pyxar"
            });

        // =========================
        // INFO
        // =========================
        const infoEmbed =
            new EmbedBuilder()

            .setColor("#2b2d31")

            .setTitle(
                "📌 Informations maintenance"
            )

            .setDescription(`

Cette maintenance est due à l'ajout
de nouveaux systèmes de sécurité avancés.

Les systèmes actuellement en cours
de correction :

• Bunker
• AntiRaid
• AntiSpam
• Logs
• TempVoice
• Permissions
• Modération
• Systèmes automatiques

L'objectif est de rendre le serveur
beaucoup plus stable et sécurisé.

            `);

        // =========================
        // STATUS
        // =========================
        const statusEmbed =
            new EmbedBuilder()

            .setColor("#e74c3c")

            .setTitle(
                "📊 État des systèmes"
            )

            .setDescription(`

🔴 Tickets
🔴 Logs
🔴 TempVoice
🔴 Modération
🔴 AntiSpam
🔴 AntiRaid
🔴 Bunker
🔴 AutoMod
🔴 Vocal
🔴 Permissions
🔴 Sécurité
🔴 Onboarding
🔴 Protection liens
🔴 Protection spam
🔴 Protection raids

🟡 API Discord
🟢 Core Bot

            `);

        // =========================
        // CLEAR + SEND
        // =========================
        const channels = [
            annonce,
            info,
            status
        ];

        for (const ch of channels) {

            const messages =
                await ch.messages.fetch({
                    limit: 10
                });

            await ch.bulkDelete(
                messages,
                true
            ).catch(() => {});

        }

        await annonce.send({
            embeds: [annonceEmbed]
        });

        await info.send({
            embeds: [infoEmbed]
        });

        await status.send({
            embeds: [statusEmbed]
        });

    } catch (err) {

        console.log(
            "❌ Maintenance erreur :"
        );

        console.log(err);

    }
}

// =========================
// READY
// =========================
client.once("clientReady", async () => {

    console.log(`✅ Logged as ${client.user.tag}`);

    try {

        // =========================
        // LOAD SYSTEMS
        // =========================
        ticketSystem(client);

        voiceTemp(client);

        antiSpam(client);

        moderation(client);

        logsSystem(client);

        console.log(
            "✅ Tous les systèmes chargés."
        );

        // =========================
        // START STATUS
        // =========================
        await updateStatus();

        setInterval(
            updateStatus,
            30000
        );

        console.log(
            "🔁 Status rotatif activé."
        );

        // =========================
        // START MAINTENANCE TIMER
        // =========================
        setInterval(async () => {

            await updateMaintenanceChannels();

        }, 10000);

    } catch (err) {

        console.log(
            "❌ Erreur chargement systèmes :"
        );

        console.log(err);

    }
});

// =========================
// MEMBER JOIN
// =========================
client.on(
    "guildMemberAdd",
    async (member) => {

        try {

            onboarding(client, member);

        } catch (err) {

            console.log(
                "❌ Erreur onboarding :"
            );

            console.log(err);

        }
    }
);

// =========================
// MESSAGE CREATE
// =========================
client.on(
    "messageCreate",
    async (message) => {

        try {

            if (message.author.bot) return;

            // =========================
            // PING
            // =========================
            if (
                message.content === "!ping"
            ) {

                const ping =
                    Date.now() -
                    message.createdTimestamp;

                return message.reply(
                    `🏓 Pong : ${ping}ms`
                );
            }

        } catch (err) {

            console.log(
                "❌ Erreur messageCreate :"
            );

            console.log(err);

        }
    }
);

// =========================
// ERROR HANDLERS
// =========================
process.on(
    "unhandledRejection",
    (err) => {

        console.log(
            "❌ Unhandled Rejection:"
        );

        console.log(err);

    }
);

process.on(
    "uncaughtException",
    (err) => {

        console.log(
            "❌ Uncaught Exception:"
        );

        console.log(err);

    }
);

// =========================
// LOGIN
// =========================
client.login(process.env.TOKEN);
