// =====================================================
// events/ticket.js
// MODE MAINTENANCE - PYXAR / HOVEX
// =====================================================

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const config = require("../data/ticketConfig");

// =====================================================
// MAINTENANCE CONFIG
// =====================================================

const MAINTENANCE = true; // 🔴 ACTIVE / DESACTIVE ICI
const MAINTENANCE_DURATION_HOURS = 4;

// heure de fin calculée
const endTime = Date.now() + MAINTENANCE_DURATION_HOURS * 60 * 60 * 1000;

// =====================================================
// EXPORT
// =====================================================

module.exports = async (client) => {

    try {

        console.log("[TICKET] Mode maintenance chargé...");

        const channel = await client.channels.fetch(config.PANEL_CHANNEL);

        if (!channel) {
            return console.log("[TICKET] Panel introuvable.");
        }

        // =====================================================
        // TIMER FORMAT
        // =====================================================

        function formatRemaining(ms) {

            const totalSeconds = Math.floor(ms / 1000);

            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            return `${hours}h ${minutes}m ${seconds}s`;
        }

        const remaining = endTime - Date.now();

        // =====================================================
        // PANEL EMBED
        // =====================================================

        const embed = new EmbedBuilder()
            .setColor("#ff0000")
            .setTitle("🚧 SYSTÈME DE TICKETS EN MAINTENANCE")
            .setDescription(`
⚠️ Le système de tickets est actuellement **désactivé temporairement**

━━━━━━━━━━━━━━━━━━

🛠️ Raison :
Mise à jour du système de recrutement + amélioration globale du panel

⏳ Durée estimée :
**${MAINTENANCE_DURATION_HOURS} heures max**

🕒 Temps restant estimé :
**${formatRemaining(remaining)}**

📌 Retour prévu vers :
<t:${Math.floor(endTime / 1000)}:F>

━━━━━━━━━━━━━━━━━━

Merci de votre patience 💛
        `)
            .setFooter({ text: "HoveX / Ticket System Maintenance" });

        // =====================================================
        // BUTTONS (disabled style)
        // =====================================================

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("maintenance")
                .setLabel("Système en maintenance")
                .setEmoji("🛑")
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true),

            new ButtonBuilder()
                .setCustomId("info")
                .setLabel("Infos système")
                .setEmoji("ℹ️")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        );

        await channel.send({
            embeds: [embed],
            components: [row]
        });

        console.log("[TICKET] Panel maintenance envoyé.");

        // =====================================================
        // BLOCK ALL INTERACTIONS (SAFE GUARD)
        // =====================================================

        client.on("interactionCreate", async (interaction) => {

            if (!interaction.isStringSelectMenu()) return;

            if (interaction.customId !== "ticket_select") return;

            if (MAINTENANCE) {

                return interaction.reply({
                    ephemeral: true,
                    content:
                        "🚧 Système de tickets en maintenance. Réouverture prochainement."
                });

            }
        });

    } catch (err) {

        console.log("[TICKET] Erreur maintenance:");
        console.log(err);

    }
};
