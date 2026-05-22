// =====================================================
// events/ticket.js
// SYSTÈME TICKETS PYXAR V3
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
// EXPORT MODULE
// =====================================================

module.exports = async (client) => {

    // =====================================================
    // READY
    // =====================================================

    client.once("ready", async () => {

        try {

            console.log(`[TICKET] Système chargé : ${client.user.tag}`);

            // =====================================================
            // PANEL CHANNEL
            // =====================================================

            const channel =
                client.channels.cache.get(config.PANEL_CHANNEL);

            if (!channel) {

                return console.log(
                    "[TICKET] Salon du panel introuvable."
                );

            }

            // =====================================================
            // FETCH MESSAGES
            // =====================================================

            const messages =
                await channel.messages.fetch({ limit: 50 });

            // =====================================================
            // DELETE OLD PANELS
            // =====================================================

            const oldPanels =
                messages.filter(msg =>

                    msg.author.id === client.user.id &&
                    msg.embeds.length > 0 &&
                    msg.embeds[0]?.title === "🎫 Support Pyxar"

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

Bienvenue dans le système de tickets officiel de **Pyxar**.

Sélectionne une catégorie afin d'ouvrir un ticket.

━━━━━━━━━━━━━━━━━━

🛡️ Recrutement Staff
🎮 Recrutement Joueur
🎬 Audiovisuel
🆘 Assistance
🤝 Partenariat
📩 Autre

━━━━━━━━━━━━━━━━━━

⚠️ Deux tickets maximum toutes les 10 minutes.
⚠️ Merci d'éviter le spam.

Nos équipes te répondront rapidement.

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
                "[TICKET] Panel envoyé avec succès."
            );

        } catch (err) {

            console.log(
                "[TICKET] Erreur panel :",
                err
            );

        }

    });

    // =====================================================
    // INTERACTION CREATE
    // =====================================================

    client.on("interactionCreate", async (interaction) => {

        // =====================================================
        // SELECT MENU
        // =====================================================

        if (
            interaction.isStringSelectMenu() &&
            interaction.customId === "ticket_select"
        ) {

            try {

                const userId = interaction.user.id;

                // =====================================================
                // COOLDOWN SYSTEM
                // =====================================================

                if (!ticketCooldown.has(userId)) {

                    ticketCooldown.set(userId, []);

                }

                const timestamps =
                    ticketCooldown.get(userId);

                const now = Date.now();

                const filtered =
                    timestamps.filter(
                        time => now - time < 600000
                    );

                if (filtered.length >= 2) {

                    return interaction.reply({

                        content:
                        "❌ Tu as atteint la limite de 2 tickets en 10 minutes.",

                        ephemeral: true

                    });

                }

                filtered.push(now);

                ticketCooldown.set(userId, filtered);

                // =====================================================
                // EXISTING TICKET CHECK
                // =====================================================

                const existing =
                    interaction.guild.channels.cache.find(c =>

                        c.name.includes(
                            interaction.user.username
                                .toLowerCase()
                        )

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

                // =====================================================
                // CATEGORY + ROLES
                // =====================================================

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
                        `${type}-${interaction.user.username}`,

                        type: ChannelType.GuildText,

                        parent: category,

                        permissionOverwrites: [

                            {
                                id: interaction.guild.id,

                                deny: [
                                    PermissionsBitField
                                        .Flags
                                        .ViewChannel
                                ]
                            },

                            {
                                id: interaction.user.id,

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

                                .setStyle(
                                    ButtonStyle.Primary
                                ),

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
                                ),

                            new ButtonBuilder()

                                .setCustomId("rename")

                                .setLabel("Rename")

                                .setEmoji("✏️")

                                .setStyle(
                                    ButtonStyle.Success
                                ),

                            new ButtonBuilder()

                                .setCustomId("help")

                                .setLabel("Aide")

                                .setEmoji("❓")

                                .setStyle(
                                    ButtonStyle.Secondary
                                )

                        );

                // =====================================================
                // TICKET EMBED
                // =====================================================

                const ticketEmbed =
                    new EmbedBuilder()

                        .setColor("#ffb347")

                        .setTitle("🎫 Ticket Ouvert")

                        .setDescription(`

Bienvenue ${interaction.user}

Merci d'avoir ouvert un ticket.

Notre équipe va te répondre rapidement.

📌 Merci de compléter correctement le formulaire.

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

                    embeds: [ticketEmbed],

                    components: [buttons]

                });

                // =====================================================
                // STAFF FORM
                // =====================================================

                if (type === "staff") {

                    const embed =
                        new EmbedBuilder()

                            .setColor("#ffb347")

                            .setTitle(
                                "🛡️ Recrutement Staff"
                            )

                            .setDescription(`

Merci de répondre au formulaire suivant :

• Pseudo Discord
• Âge
• Pays
• Motivations
• Expériences
• Disponibilités
• Gestion des conflits
• Pourquoi toi ?

Merci d'envoyer tes réponses directement dans le ticket.

                            `);

                    await ticket.send({

                        embeds: [embed]

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

                                    .setCustomId(
                                        "test_modo"
                                    )

                                    .setLabel(
                                        "Test Modérateur"
                                    )

                                    .setEmoji("🧪")

                                    .setStyle(
                                        ButtonStyle.Success
                                    )

                            );

                    const embed =
                        new EmbedBuilder()

                            .setColor("#ffb347")

                            .setTitle(
                                "🎮 Recrutement Joueur"
                            )

                            .setDescription(`

Merci de répondre au formulaire :

• Pseudo Epic Games
• Âge
• Plateforme
• PR
• Expérience
• Points forts
• Objectifs
• Disponibilités

                            `);

                    await ticket.send({

                        embeds: [embed],

                        components: [testButton]

                    });

                }

                // =====================================================
                // AUDIOVISUEL FORM
                // =====================================================

                if (type === "audiovisuel") {

                    const embed =
                        new EmbedBuilder()

                            .setColor("#ffb347")

                            .setTitle(
                                "🎬 Recrutement Audiovisuel"
                            )

                            .setDescription(`

Merci de préciser :

• Ton rôle
• Tes logiciels
• Ton portfolio
• Tes créations
• Tes disponibilités
• Ton expérience

                            `);

                    await ticket.send({

                        embeds: [embed]

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

            } catch (err) {

                console.log(err);

            }

        }

        // =====================================================
        // BUTTONS
        // =====================================================

        if (interaction.isButton()) {

            // =====================================================
            // CLAIM
            // =====================================================

            if (interaction.customId === "claim") {

                return interaction.reply({

                    content:
                    `📌 Ticket claim par ${interaction.user}`

                });

            }

            // =====================================================
            // CLOSE
            // =====================================================

            if (interaction.customId === "close") {

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
            // DELETE
            // =====================================================

            if (interaction.customId === "delete") {

                await interaction.reply({

                    content:
                    "🗑️ Suppression du ticket dans 5 secondes..."

                });

                setTimeout(async () => {

                    await interaction.channel
                        .delete()
                        .catch(() => {});

                }, 5000);

            }

            // =====================================================
            // HELP
            // =====================================================

            if (interaction.customId === "help") {

                return interaction.reply({

                    embeds: [

                        new EmbedBuilder()

                            .setColor("#ffb347")

                            .setTitle("❓ Assistance")

                            .setDescription(`

📱 Téléphone :
Appuie sur "Répondre".

💻 PC :
Écris directement dans le ticket.

Notre équipe peut t'aider à remplir le formulaire.

                            `)

                    ],

                    ephemeral: true

                });

            }

            // =====================================================
            // TEST MODO
            // =====================================================

            if (interaction.customId === "test_modo") {

                return interaction.reply({

                    embeds: [

                        new EmbedBuilder()

                            .setColor("#ffb347")

                            .setTitle("🧪 Test Modérateur")

                            .setDescription(`

Le candidat doit maintenant gérer une fausse situation.

Évalue :
• Son calme
• Sa communication
• Ses sanctions
• Son professionnalisme

                            `)

                    ]

                });

            }

            // =====================================================
            // RENAME
            // =====================================================

            if (interaction.customId === "rename") {

                const modal =
                    new ModalBuilder()

                        .setCustomId(
                            "rename_modal"
                        )

                        .setTitle(
                            "Renommer le ticket"
                        );

                const input =
                    new TextInputBuilder()

                        .setCustomId(
                            "ticket_name"
                        )

                        .setLabel(
                            "Nouveau nom"
                        )

                        .setStyle(
                            TextInputStyle.Short
                        )

                        .setRequired(true);

                modal.addComponents(

                    new ActionRowBuilder()
                        .addComponents(input)

                );

                return interaction.showModal(
                    modal
                );

            }

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
                `✏️ Ticket renommé en \`${name}\``,

                ephemeral: true

            });

        }

    });

};
