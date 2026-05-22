// =====================================================
// events/ticket.js
// PYXAR TICKET SYSTEM FINAL FIX
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
                limit: 50
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
                        emoji: "🛡️",
                        description:
                        "Postule pour rejoindre le staff"
                    },

                    {
                        label: "Recrutement Joueur",
                        value: "joueur",
                        emoji: "🎮",
                        description:
                        "Postule comme joueur"
                    },

                    {
                        label: "Audiovisuel",
                        value: "audiovisuel",
                        emoji: "🎬",
                        description:
                        "Graphisme / montage / caster"
                    },

                    {
                        label: "Assistance",
                        value: "aide",
                        emoji: "🆘",
                        description:
                        "Besoin d'aide"
                    },

                    {
                        label: "Partenariat",
                        value: "partenariat",
                        emoji: "🤝",
                        description:
                        "Demande de partenariat"
                    },

                    {
                        label: "Autre",
                        value: "autre",
                        emoji: "📩",
                        description:
                        "Autre demande"
                    }

                ]);

        const row =
            new ActionRowBuilder()
                .addComponents(menu);

        // =====================================================
        // PANEL EMBED
        // =====================================================

        const embed =
            new EmbedBuilder()

                .setColor("#ffb347")

                .setTitle("🎫 Support Pyxar")

                .setDescription(`

Bienvenue dans le système de tickets officiel.

Choisis une catégorie pour ouvrir un ticket.

━━━━━━━━━━━━━━━━━━

🛡️ Staff
🎮 Joueur
🎬 Audiovisuel
🆘 Assistance
🤝 Partenariat
📩 Autre

━━━━━━━━━━━━━━━━━━

⚠️ 2 tickets / 10 min max
⚠️ Pas de spam

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
        // MENU TICKET
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
                    "❌ Limite de 2 tickets / 10 min atteinte.",

                    ephemeral: true

                });

            }

            filtered.push(now);

            ticketCooldown.set(
                userId,
                filtered
            );

            // =====================================================
            // CHECK EXISTING
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
                            .setCustomId("claim")
                            .setLabel("Claim")
                            .setEmoji("📌")
                            .setStyle(ButtonStyle.Primary),

                        new ButtonBuilder()
                            .setCustomId("close")
                            .setLabel("Fermer")
                            .setEmoji("🔒")
                            .setStyle(ButtonStyle.Secondary),

                        new ButtonBuilder()
                            .setCustomId("delete")
                            .setLabel("Supprimer")
                            .setEmoji("🗑️")
                            .setStyle(ButtonStyle.Danger),

                        new ButtonBuilder()
                            .setCustomId("rename")
                            .setLabel("Rename")
                            .setEmoji("✏️")
                            .setStyle(ButtonStyle.Success),

                        new ButtonBuilder()
                            .setCustomId("help")
                            .setLabel("Aide")
                            .setEmoji("❓")
                            .setStyle(ButtonStyle.Secondary)

                    );

            // =====================================================
            // TICKET EMBED
            // =====================================================

            const embedTicket =
                new EmbedBuilder()

                    .setColor("#ffb347")

                    .setTitle("🎫 Ticket Ouvert")

                    .setDescription(`
Bienvenue ${interaction.user}

Merci d'avoir ouvert un ticket.

Notre équipe va te répondre rapidement.
                    `)

                    .setFooter({
                        text: "Pyxar Ticket System"
                    });

            // =====================================================
            // SEND TICKET
            // =====================================================

            await ticket.send({

                content:
                `${interaction.user} ${roles.map(r => `<@&${r}>`).join(" ")}`,

                embeds: [embedTicket],

                components: [buttons]

            });

            // =====================================================
            // STAFF FORM
            // =====================================================

            if (type === "staff") {

                await ticket.send({

                    embeds: [

                        new EmbedBuilder()

                            .setColor("#ffb347")

                            .setTitle("🛡️ Recrutement Staff")

                            .setDescription(`
Réponds au formulaire dans le chat.

• Âge
• Motivations
• Expérience
• Disponibilités
• Pourquoi toi ?
                            `)

                    ]

                });

            }

            // =====================================================
            // JOUEUR FORM
            // =====================================================

            if (type === "joueur") {

                const testButton =
                    new ActionRowBuilder()

                        .addComponents(

                            new ButtonBuilder()

                                .setCustomId("test_modo")

                                .setLabel("Test Modérateur")

                                .setEmoji("🧪")

                                .setStyle(
                                    ButtonStyle.Success
                                )

                        );

                await ticket.send({

                    embeds: [

                        new EmbedBuilder()

                            .setTitle(
                                "🎮 Recrutement Joueur"
                            )

                            .setDescription(`
• Pseudo Epic Games
• Âge
• Plateforme
• PR
• Disponibilités
                            `)

                            .setColor("#ffb347")

                    ],

                    components: [testButton]

                });

            }

            // =====================================================
            // AUDIOVISUEL
            // =====================================================

            if (type === "audiovisuel") {

                await ticket.send({

                    embeds: [

                        new EmbedBuilder()

                            .setTitle("🎬 Audiovisuel")

                            .setDescription(`
• Logiciels
• Portfolio
• Expérience
• Motivations
                            `)

                            .setColor("#ffb347")

                    ]

                });

            }

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
        // BUTTONS
        // =====================================================

        if (!interaction.isButton()) return;

        // =====================================================
        // CLAIM
        // =====================================================

        if (interaction.customId === "claim") {

            return interaction.reply({

                content:
                `📌 Claim par ${interaction.user}`

            });

        }

        // =====================================================
        // CLOSE
        // =====================================================

        if (interaction.customId === "close") {

            await interaction.channel.permissionOverwrites.edit(

                interaction.guild.roles.everyone,

                {
                    SendMessages: false
                }

            );

            return interaction.reply({

                content:
                "🔒 Fermé."

            });

        }

        // =====================================================
        // DELETE
        // =====================================================

        if (interaction.customId === "delete") {

            await interaction.reply({

                content:
                "🗑️ Suppression dans 5s..."

            });

            setTimeout(() => {

                interaction.channel
                    .delete()
                    .catch(() => {});

            }, 5000);

        }

        // =====================================================
        // HELP
        // =====================================================

        if (interaction.customId === "help") {

            return interaction.reply({

                ephemeral: true,

                embeds: [

                    new EmbedBuilder()

                        .setTitle("❓ Aide")

                        .setDescription(`
📱 Téléphone :
Réponds directement dans le ticket.

💻 PC :
Copie le formulaire puis réponds dessous.
                        `)

                        .setColor("#ffb347")

                ]

            });

        }

        // =====================================================
        // TEST MODO
        // =====================================================

        if (interaction.customId === "test_modo") {

            return interaction.reply({

                embeds: [

                    new EmbedBuilder()

                        .setTitle(
                            "🧪 Test Modérateur"
                        )

                        .setDescription(`
Le candidat doit être évalué sur :

• Gestion
• Communication
• Réactivité
• Professionnalisme
                        `)

                        .setColor("#ffb347")

                ]

            });

        }

        // =====================================================
        // RENAME
        // =====================================================

        if (interaction.customId === "rename") {

            const modal =
                new ModalBuilder()

                    .setCustomId("rename_modal")

                    .setTitle("Renommer ticket");

            const input =
                new TextInputBuilder()

                    .setCustomId("ticket_name")

                    .setLabel("Nouveau nom")

                    .setStyle(
                        TextInputStyle.Short
                    )

                    .setRequired(true);

            modal.addComponents(

                new ActionRowBuilder()
                    .addComponents(input)

            );

            return interaction.showModal(modal);

        }

        // =====================================================
        // MODAL
        // =====================================================

        if (
            interaction.isModalSubmit() &&
            interaction.customId === "rename_modal"
        ) {

            const name =
                interaction.fields
                    .getTextInputValue(
                        "ticket_name"
                    );

            await interaction.channel
                .setName(name);

            return interaction.reply({

                content:
                `✏️ Renommé en ${name}`,

                ephemeral: true

            });

        }

    });

};
