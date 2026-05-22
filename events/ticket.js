// =====================================================
// events/ticket.js
// PYXAR TICKET SYSTEM V3 FIXED
// =====================================================

const {

    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionsBitField,
    ChannelType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle

} = require("discord.js");

const config = require("../data/ticketConfig");

// =====================================================
// COOLDOWN
// =====================================================

const ticketCooldown = new Map();

// =====================================================
// EXPORT
// =====================================================

module.exports = async (client) => {

    // =====================================================
    // START SYSTEM
    // =====================================================

    try {

        console.log("[TICKET] Chargement du système...");

        // =====================================================
        // FETCH CHANNEL
        // =====================================================

        const channel =
            await client.channels.fetch(
                config.PANEL_CHANNEL
            );

        if (!channel) {

            return console.log(
                "[TICKET] Salon introuvable."
            );

        }

        console.log(
            "[TICKET] Salon trouvé."
        );

        // =====================================================
        // DELETE OLD PANELS
        // =====================================================

        const messages =
            await channel.messages.fetch({
                limit: 20
            });

        const oldPanels =
            messages.filter(msg =>

                msg.author.id === client.user.id &&
                msg.embeds.length > 0 &&
                msg.embeds[0]?.title ===
                "🎫 Support Pyxar"

            );

        for (const msg of oldPanels.values()) {

            await msg.delete().catch(() => {});

        }

        // =====================================================
        // MENU
        // =====================================================

        const menu =
            new StringSelectMenuBuilder()

                .setCustomId("ticket_select")

                .setPlaceholder(
                    "🎫 Sélectionne une catégorie"
                )

                .addOptions([

                    {
                        label: "Recrutement Staff",
                        value: "staff",
                        emoji: "🛡️"
                    },

                    {
                        label: "Recrutement Joueur",
                        value: "joueur",
                        emoji: "🎮"
                    },

                    {
                        label: "Audiovisuel",
                        value: "audiovisuel",
                        emoji: "🎬"
                    },

                    {
                        label: "Assistance",
                        value: "aide",
                        emoji: "🆘"
                    },

                    {
                        label: "Partenariat",
                        value: "partenariat",
                        emoji: "🤝"
                    },

                    {
                        label: "Autre",
                        value: "autre",
                        emoji: "📩"
                    }

                ]);

        const row =
            new ActionRowBuilder()
                .addComponents(menu);

        // =====================================================
        // EMBED
        // =====================================================

        const embed =
            new EmbedBuilder()

                .setColor("#ffb347")

                .setTitle("🎫 Support Pyxar")

                .setDescription(`

Bienvenue dans le système de tickets officiel de Pyxar.

Sélectionne une catégorie afin d'ouvrir un ticket.

━━━━━━━━━━━━━━━━━━

🛡️ Staff
🎮 Joueur
🎬 Audiovisuel
🆘 Assistance
🤝 Partenariat
📩 Autre

━━━━━━━━━━━━━━━━━━

⚠️ Pas de spam
⚠️ 2 tickets / 10 min max

                `)

                .setFooter({
                    text: "Pyxar Support"
                });

        // =====================================================
        // SEND PANEL
        // =====================================================

        await channel.send({

            embeds: [embed],
            components: [row]

        });

        console.log(
            "[TICKET] Panel envoyé."
        );

    } catch (err) {

        console.log(
            "[TICKET] Erreur :"
        );

        console.log(err);

    }

    // =====================================================
    // INTERACTIONS
    // =====================================================

    client.on("interactionCreate", async (interaction) => {

        // =====================================================
        // SELECT MENU
        // =====================================================

        if (
            interaction.isStringSelectMenu() &&
            interaction.customId === "ticket_select"
        ) {

            const userId =
                interaction.user.id;

            // =====================================================
            // COOLDOWN
            // =====================================================

            if (!ticketCooldown.has(userId)) {

                ticketCooldown.set(userId, []);

            }

            const timestamps =
                ticketCooldown.get(userId);

            const now = Date.now();

            const filtered =
                timestamps.filter(
                    t => now - t < 600000
                );

            if (filtered.length >= 2) {

                return interaction.reply({

                    content:
                    "❌ Limite de tickets atteinte.",

                    ephemeral: true

                });

            }

            filtered.push(now);

            ticketCooldown.set(
                userId,
                filtered
            );

            // =====================================================
            // EXISTING TICKET
            // =====================================================

            const existing =
                interaction.guild.channels.cache.find(c =>

                    c.name ===
                    `ticket-${interaction.user.username}`

                );

            if (existing) {

                return interaction.reply({

                    content:
                    `❌ Tu possèdes déjà un ticket : ${existing}`,

                    ephemeral: true

                });

            }

            // =====================================================
            // TYPE
            // =====================================================

            const type =
                interaction.values[0];

            let category;
            let roles = [];

            switch (type) {

                case "staff":

                    category =
                        config.CATEGORIES.staff;

                    roles =
                        config.ROLES.staff;

                    break;

                case "joueur":

                    category =
                        config.CATEGORIES.joueur;

                    roles =
                        config.ROLES.joueur;

                    break;

                case "audiovisuel":

                    category =
                        config.CATEGORIES.audiovisuel;

                    roles =
                        config.ROLES.audiovisuel;

                    break;

                case "aide":

                    category =
                        config.CATEGORIES.aide;

                    roles =
                        config.ROLES.aide;

                    break;

                default:

                    category =
                        config.CATEGORIES.autre;

                    roles =
                        config.ROLES.autre;

            }

            // =====================================================
            // CREATE CHANNEL
            // =====================================================

            const ticket =
                await interaction.guild.channels.create({

                    name:
                    `ticket-${interaction.user.username}`,

                    type:
                    ChannelType.GuildText,

                    parent: category,

                    permissionOverwrites: [

                        {
                            id:
                            interaction.guild.id,

                            deny: [
                                PermissionsBitField
                                    .Flags
                                    .ViewChannel
                            ]
                        },

                        {
                            id:
                            interaction.user.id,

                            allow: [

                                PermissionsBitField
                                    .Flags
                                    .ViewChannel,

                                PermissionsBitField
                                    .Flags
                                    .SendMessages,

                                PermissionsBitField
                                    .Flags
                                    .ReadMessageHistory

                            ]
                        },

                        ...roles.map(role => ({

                            id: role,

                            allow: [

                                PermissionsBitField
                                    .Flags
                                    .ViewChannel,

                                PermissionsBitField
                                    .Flags
                                    .SendMessages,

                                PermissionsBitField
                                    .Flags
                                    .ReadMessageHistory

                            ]

                        }))

                    ]

                });

            // =====================================================
            // BUTTONS
            // =====================================================

            const buttons =
                new ActionRowBuilder()

                    .addComponents(

                        new ButtonBuilder()

                            .setCustomId("close")

                            .setLabel("Fermer")

                            .setEmoji("🔒")

                            .setStyle(
                                ButtonStyle.Secondary
                            ),

                        new ButtonBuilder()

                            .setCustomId("delete")

                            .setLabel("Supprimer")

                            .setEmoji("🗑️")

                            .setStyle(
                                ButtonStyle.Danger
                            )

                    );

            // =====================================================
            // EMBED
            // =====================================================

            const ticketEmbed =
                new EmbedBuilder()

                    .setColor("#ffb347")

                    .setTitle("🎫 Ticket Ouvert")

                    .setDescription(`
Bienvenue ${interaction.user}

Merci d'avoir ouvert un ticket.
Le staff va bientôt te répondre.
                    `);

            // =====================================================
            // SEND
            // =====================================================

            await ticket.send({

                content:
                `${interaction.user}`,

                embeds: [ticketEmbed],

                components: [buttons]

            });

            // =====================================================
            // REPLY
            // =====================================================

            return interaction.reply({

                content:
                `✅ Ticket créé : ${ticket}`,

                ephemeral: true

            });

        }

        // =====================================================
        // BUTTON CLOSE
        // =====================================================

        if (
            interaction.isButton() &&
            interaction.customId === "close"
        ) {

            await interaction.channel
                .permissionOverwrites.edit(

                    interaction.guild.roles.everyone,

                    {
                        SendMessages: false
                    }

                );

            return interaction.reply({

                content:
                "🔒 Ticket fermé."

            });

        }

        // =====================================================
        // BUTTON DELETE
        // =====================================================

        if (
            interaction.isButton() &&
            interaction.customId === "delete"
        ) {

            await interaction.reply({

                content:
                "🗑️ Suppression dans 5 secondes..."

            });

            setTimeout(async () => {

                await interaction.channel
                    .delete()
                    .catch(() => {});

            }, 5000);

        }

    });

};
