const express = require("express");

const {
    Client,
    GatewayIntentBits,
    Partials,
    ActivityType,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder
} = require("discord.js");

require("dotenv").config();

// =========================
// EXPRESS
// =========================
const app = express();

const PORT = 3000;

app.get("/", (req, res) => {
    res.send("🚧 Pyxar Maintenance Online");
});

app.listen(PORT, () => {
    console.log(`🌐 Maintenance server running on port ${PORT}`);
});

// =========================
// CONFIG
// =========================
const GUILD_ID = "1505330441274658876";

const CEO_ROLE = "1505330692106485781";

const MAINTENANCE_ROLE =
    "1508206039151935578";

// =========================
// CHANNELS
// =========================
const CHANNEL_ANNONCE =
    "1508207035852787742";

const CHANNEL_INFOS =
    "1508207063132803113";

const CHANNEL_STATUS =
    "1508207088248033311";

const CHANNEL_TIMER =
    "1508207128920461372";

// =========================
// MAINTENANCE TIME
// =========================

// 6 heures de maintenance
const MAINTENANCE_HOURS = 6;

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
// VARIABLES
// =========================
let maintenanceEnd = null;

let timerMessage = null;

let statusMessage = null;

// =========================
// FORMAT TIMER
// =========================
function formatTime(ms) {

    const totalSeconds =
        Math.floor(ms / 1000);

    const hours =
        Math.floor(totalSeconds / 3600);

    const minutes =
        Math.floor(
            (totalSeconds % 3600) / 60
        );

    const seconds =
        totalSeconds % 60;

    return `${hours}h ${minutes}m ${seconds}s`;
}

// =========================
// STATUS EMBED
// =========================
function createSystemEmbed() {

    return new EmbedBuilder()

        .setColor("#ffcc00")

        .setTitle("📡 État des Systèmes")

        .setDescription(`
# 🚧 Maintenance en cours

## 🔴 Systèmes actuellement hors ligne

╭──────────────
🔴 Ticket System  
🔴 VoiceTemp  
🔴 Logs System  
🔴 AntiSpam  
🔴 Moderation  
🔴 AntiRaid  
🔴 Bunker System  
🔴 TempChannels  
🔴 Sécurité Serveur  
🔴 Protection Permissions  
🔴 Protection Liens  
🔴 Protection Vocales  
🔴 Onboarding  
🔴 AutoMod  
🔴 API Interne  
🔴 Protection Staff  
🔴 Protection Channels  
🔴 Protection Roles  
🔴 Protection Webhooks  
╰──────────────

# 🛠️ Développeurs actuellement en intervention

Merci de patienter 💛🤍
        `)

        .setFooter({
            text: "Team Pyxar"
        })

        .setTimestamp();
}

// =========================
// READY
// =========================
client.once("clientReady", async () => {

    console.log(
        `✅ Maintenance connecté : ${client.user.tag}`
    );

    try {

        const guild =
            client.guilds.cache.get(GUILD_ID);

        if (!guild)
            return console.log(
                "❌ Serveur introuvable."
            );

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

        console.log(
            "✅ Status maintenance activé."
        );

        // =========================
        // CHANNELS
        // =========================
        const annonceChannel =
            guild.channels.cache.get(
                CHANNEL_ANNONCE
            );

        const infosChannel =
            guild.channels.cache.get(
                CHANNEL_INFOS
            );

        const statusChannel =
            guild.channels.cache.get(
                CHANNEL_STATUS
            );

        const timerChannel =
            guild.channels.cache.get(
                CHANNEL_TIMER
            );

        // =========================
        // CLEAR CHANNELS
        // =========================
        async function clear(channel) {

            if (!channel) return;

            const messages =
                await channel.messages.fetch({
                    limit: 100
                });

            await channel.bulkDelete(
                messages,
                true
            ).catch(() => {});
        }

        await clear(annonceChannel);
        await clear(infosChannel);
        await clear(statusChannel);
        await clear(timerChannel);

        // =========================
        // GIVE ROLE
        // =========================
        const members =
            await guild.members.fetch();

        for (const member of members.values()) {

            if (member.user.bot) continue;

            if (
                member.roles.cache.has(
                    CEO_ROLE
                )
            ) continue;

            await member.roles.add(
                MAINTENANCE_ROLE
            ).catch(() => {});
        }

        console.log(
            "✅ Rôle maintenance ajouté."
        );

        // =========================
        // END DATE
        // =========================
        maintenanceEnd =
            Date.now() +
            MAINTENANCE_HOURS *
            60 *
            60 *
            1000;

        // =========================
        // ANNONCE
        // =========================
        const annonceEmbed =
            new EmbedBuilder()

            .setColor("#ffcc00")

            .setTitle(
                "🚧 Maintenance Générale"
            )

            .setDescription(`
# 🚧 Le serveur est en maintenance

Nos développeurs travaillent actuellement sur :

• les systèmes de sécurité
• les protections anti-raid
• les protections permissions
• les systèmes bunker
• les systèmes vocaux
• les systèmes logs
• les optimisations serveur

Merci de votre patience 💛🤍
            `)

            .setTimestamp();

        await annonceChannel.send({
            embeds: [annonceEmbed]
        });

        // =========================
        // INFOS
        // =========================
        const infosEmbed =
            new EmbedBuilder()

            .setColor("#2b2d31")

            .setTitle(
                "📌 Informations Maintenance"
            )

            .setDescription(`
# 📌 Pourquoi cette maintenance ?

Cette maintenance sert à :

✅ corriger plusieurs bugs  
✅ améliorer la sécurité  
✅ améliorer les performances  
✅ renforcer les protections  
✅ optimiser les systèmes du bot  
✅ stabiliser les systèmes Discord  

Le serveur reviendra automatiquement une fois les systèmes stabilisés.
            `)

            .setFooter({
                text: "Dev By Vyrn"
            })

            .setTimestamp();

        await infosChannel.send({
            embeds: [infosEmbed]
        });

        // =========================
        // BUTTON
        // =========================
        const row =
            new ActionRowBuilder()

            .addComponents(

                new ButtonBuilder()

                .setCustomId(
                    "maintenance_refresh"
                )

                .setLabel(
                    "🔄 Mettre à jour"
                )

                .setStyle(
                    ButtonStyle.Primary
                )
            );

        // =========================
        // STATUS MESSAGE
        // =========================
        statusMessage =
            await statusChannel.send({

                embeds: [
                    createSystemEmbed()
                ],

                components: [row]

            });

        // =========================
        // TIMER MESSAGE
        // =========================
        timerMessage =
            await timerChannel.send(
                "⏳ Chargement..."
            );

        // =========================
        // TIMER LOOP
        // =========================
        async function updateTimer() {

            const now = Date.now();

            const remaining =
                maintenanceEnd - now;

            const endTimestamp =
                Math.floor(
                    maintenanceEnd / 1000
                );

            await timerMessage.edit(`
# ⏳ Temps restant avant retour

## 🚧 Maintenance estimée :
# ${formatTime(remaining)}

🕒 Retour estimé :
<t:${endTimestamp}:F>

⏰ Fin prévue :
<t:${endTimestamp}:R>

Merci de votre patience 💛🤍
            `);
        }

        updateTimer();

        setInterval(updateTimer, 1000);

        console.log(
            "✅ Maintenance totalement active."
        );

    } catch (err) {

        console.log(
            "❌ Erreur maintenance :"
        );

        console.log(err);

    }
});

// =========================
// BUTTONS
// =========================
client.on(
    "interactionCreate",
    async (interaction) => {

        try {

            if (
                !interaction.isButton()
            ) return;

            // =========================
            // REFRESH
            // =========================
            if (
                interaction.customId ===
                "maintenance_refresh"
            ) {

                // CHECK CEO
                if (
                    !interaction.member.roles.cache.has(
                        CEO_ROLE
                    )
                ) {

                    return interaction.reply({

                        content:
                            "❌ Réservé aux CEO.",

                        ephemeral: true

                    });
                }

                await statusMessage.edit({

                    embeds: [
                        createSystemEmbed()
                    ]

                });

                return interaction.reply({

                    content:
                        "✅ Systèmes mis à jour.",

                    ephemeral: true

                });
            }

        } catch (err) {

            console.log(
                "❌ Erreur interaction :"
            );

            console.log(err);

        }
    }
);

// =========================
// MESSAGE BLOCK
// =========================
client.on(
    "messageCreate",
    async (message) => {

        try {

            if (message.author.bot)
                return;

            if (
                !message.guild
            ) return;

            // CEO IGNORÉ
            if (
                message.member.roles.cache.has(
                    CEO_ROLE
                )
            ) return;

            // BLOQUE ÉCRITURE
            await message.delete()
                .catch(() => {});

        } catch (err) {

            console.log(
                "❌ Erreur blocage :"
            );

            console.log(err);

        }
    }
);

// =========================
// ERRORS
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
