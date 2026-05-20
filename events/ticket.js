// =====================================================
// events/ticket.js
// SYSTÈME TICKETS PYXAR V2
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

const cooldowns = new Map();

// =====================================================
// MODULE EXPORT
// =====================================================

module.exports = async (client) => {

    // =====================================================
    // PANEL
    // =====================================================

    client.once("clientReady", async () => {

        try {

            const panelChannel =
                client.channels.cache.get(config.PANEL_CHANNEL);

            if (!panelChannel) return;

            const embed = new EmbedBuilder()

                .setColor("#ffb347")

                .setTitle("🎫 Centre de support Pyxar")

                .setDescription(`
Bienvenue dans le centre de support officiel de **Pyxar**.

Sélectionnez la catégorie correspondant à votre demande afin d'ouvrir un ticket.

━━━━━━━━━━━━━━━━━━

🎓 Recrutement Staff  
🎮 Recrutement Joueur  
🎬 Recrutement Audiovisuel  
❓ Assistance  
🤝 Partenariat  
📌 Autre

━━━━━━━━━━━━━━━━━━

Nos équipes vous répondront rapidement.
                `)

                .setFooter({
                    text: "Pyxar Support"
                });

            const menu =
                new ActionRowBuilder()

                    .addComponents(

                        new StringSelectMenuBuilder()

                            .setCustomId("ticket_select")

                            .setPlaceholder("Sélectionne une catégorie")

                            .addOptions([

                                {
                                    label: "Recrutement Staff",
                                    value: "staff",
                                    emoji: "🎓"
                                },

                                {
                                    label: "Recrutement Joueur",
                                    value: "joueur",
                                    emoji: "🎮"
                                },

                                {
                                    label: "Recrutement Audiovisuel",
                                    value: "audiovisuel",
                                    emoji: "🎬"
                                },

                                {
                                    label: "Assistance",
                                    value: "aide",
                                    emoji: "❓"
                                },

                                {
                                    label: "Partenariat",
                                    value: "partenariat",
                                    emoji: "🤝"
                                },

                                {
                                    label: "Autre",
                                    value: "autre",
                                    emoji: "📌"
                                }

                            ])

                    );

            const messages =
                await panelChannel.messages.fetch();

            const already =
                messages.find(m =>
                    m.author.id === client.user.id
                );

            if (!already) {

                await panelChannel.send({

                    embeds: [embed],
                    components: [menu]

                });

            }

        } catch (err) {

            console.log(err);

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

            const userId = interaction.user.id;

            // =====================================================
            // COOLDOWN
            // =====================================================

            if (cooldowns.has(userId)) {

                return interaction.reply({

                    content:
                    "❌ Tu dois attendre avant de créer un autre ticket.",

                    ephemeral: true

                });

            }

            cooldowns.set(userId, true);

            setTimeout(() => {

                cooldowns.delete(userId);

            }, 600000);

            // =====================================================
            // CHECK EXISTING
            // =====================================================

            const existing =
                interaction.guild.channels.cache.find(c =>
                    c.name.includes(interaction.user.username.toLowerCase())
                );

            if (existing) {

                return interaction.reply({

                    content:
                    "❌ Tu possèdes déjà un ticket ouvert.",

                    ephemeral: true

                });

            }

            const choice = interaction.values[0];

            let category;
            let roles;

            // =====================================================
            // CATEGORY + ROLES
            // =====================================================

            if (choice === "staff") {

                category = config.CATEGORIES.staff;
                roles = config.ROLES.staff;

            }

            if (choice === "joueur") {

                category = config.CATEGORIES.joueur;
                roles = config.ROLES.joueur;

            }

            if (choice === "audiovisuel") {

                category = config.CATEGORIES.audiovisuel;
                roles = config.ROLES.audiovisuel;

            }

            if (choice === "aide") {

                category = config.CATEGORIES.aide;
                roles = config.ROLES.aide;

            }

            if (
                choice === "partenariat" ||
                choice === "autre"
            ) {

                category = config.CATEGORIES.autre;
                roles = config.ROLES.autre;

            }

            // =====================================================
            // CREATE CHANNEL
            // =====================================================

            const channel =
                await interaction.guild.channels.create({

                    name:
                    `ticket-${interaction.user.username}`,

                    type: ChannelType.GuildText,

                    parent: category,

                    permissionOverwrites: [

                        {
                            id: interaction.guild.id,

                            deny: [
                                PermissionsBitField.Flags.ViewChannel
                            ]
                        },

                        {
                            id: interaction.user.id,

                            allow: [

                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages,
                                PermissionsBitField.Flags.ReadMessageHistory

                            ]
                        },

                        ...roles.map(roleId => ({

                            id: roleId,

                            allow: [

                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages,
                                PermissionsBitField.Flags.ReadMessageHistory

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
                            .setCustomId("claim_ticket")
                            .setLabel("🔒 Claim")
                            .setStyle(ButtonStyle.Primary),

                        new ButtonBuilder()
                            .setCustomId("close_ticket")
                            .setLabel("🛑 Fermer")
                            .setStyle(ButtonStyle.Secondary),

                        new ButtonBuilder()
                            .setCustomId("delete_ticket")
                            .setLabel("🗑️ Supprimer")
                            .setStyle(ButtonStyle.Danger),

                        new ButtonBuilder()
                            .setCustomId("rename_ticket")
                            .setLabel("✏️ Rename")
                            .setStyle(ButtonStyle.Success),

                        new ButtonBuilder()
                            .setCustomId("help_ticket")
                            .setLabel("❓ Aide")
                            .setStyle(ButtonStyle.Secondary)

                    );

            // =====================================================
            // EMBED
            // =====================================================

            const embed =
                new EmbedBuilder()

                    .setColor("#ffb347")

                    .setTitle("🎫 Ticket ouvert")

                    .setDescription(`
Bienvenue dans votre ticket Pyxar.

Merci de compléter correctement le formulaire ci-dessous.

Un membre du staff prendra votre demande en charge rapidement.
                    `)

                    .setFooter({
                        text: "Pyxar Support"
                    });

            await channel.send({

                content:
                `${interaction.user}`,

                embeds: [embed],

                components: [buttons]

            });

            // =====================================================
            // FORMULAIRES
            // =====================================================

            if (choice === "staff") {

                await channel.send({

                    embeds: [

                        new EmbedBuilder()

                            .setColor("#ffb347")

                            .setTitle("🎓 Formulaire Staff")

                            .setDescription(`
🔹 Informations générales

• Pseudo Discord
• Âge
• Pays / Fuseau horaire
• Expérience Discord
• Motivations
• Qualités / Défauts

🔹 Expérience & compétences

• Expérience staff
• Bots maîtrisés
• Permissions Discord

🔹 Disponibilités

• Horaires
• Activité

🔹 Gestion des situations

• Toxicité
• Raid
• Sanctions
• Abuse permissions

🔹 Sécurité

• ToS Discord
• Scams / phishing

Merci de répondre sérieusement.
                            `)

                    ]

                });

            }

            if (choice === "joueur") {

                const testButtons =
                    new ActionRowBuilder()

                        .addComponents(

                            new ButtonBuilder()
                                .setCustomId("test_moderateur")
                                .setLabel("🧪 Test Modérateur")
                                .setStyle(ButtonStyle.Primary)

                        );

                await channel.send({

                    embeds: [

                        new EmbedBuilder()

                            .setColor("#ffb347")

                            .setTitle("🎮 Formulaire Joueur")

                            .setDescription(`
Merci de répondre aux questions suivantes :

• Pseudo Epic Games
• Âge
• PR Overall / EU
• Plateforme
• Rôle in-game
• Résultats tournois
• Points forts
• Points faibles
• Objectifs
• Disponibilités

Merci d'être précis.
                            `)

                    ],

                    components: [testButtons]

                });

            }

            if (choice === "audiovisuel") {

                await channel.send({

                    embeds: [

                        new EmbedBuilder()

                            .setColor("#ffb347")

                            .setTitle("🎬 Formulaire Audiovisuel")

                            .setDescription(`
Merci de sélectionner le rôle audiovisuel souhaité :

🎤 Caster
🎨 Graphiste
✂️ Monteur
📸 Media Maker
🎥 Content Creator
🖥️ Thumbnail Designer

Puis remplissez les informations demandées :

• Âge
• Expérience
• Logiciels maîtrisés
• Portfolio
• Motivations
                            `)

                    ]

                });

            }

            await interaction.reply({

                content:
                `✅ Ticket créé : ${channel}`,

                ephemeral: true

            });

        }

        // =====================================================
        // BUTTONS
        // =====================================================

        if (interaction.isButton()) {

            // =====================================================
            // CLAIM
            // =====================================================

            if (interaction.customId === "claim_ticket") {

                await interaction.reply({

                    embeds: [

                        new EmbedBuilder()

                            .setColor("#57f287")

                            .setDescription(`
🔒 Ticket claim par ${interaction.user}
                            `)

                    ]

                });

            }

            // =====================================================
            // HELP
            // =====================================================

            if (interaction.customId === "help_ticket") {

                await interaction.reply({

                    embeds: [

                        new EmbedBuilder()

                            .setColor("#ffb347")

                            .setTitle("❓ Assistance")

                            .setDescription(`
Si vous êtes sur téléphone :

1. Répondez directement dans le ticket.
2. Séparez bien vos réponses.
3. Prenez votre temps.

Si vous êtes sur PC :

1. Copiez le formulaire.
2. Répondez dessous.
3. Envoyez le tout dans le ticket.
                            `)

                    ],

                    ephemeral: true

                });

            }

            // =====================================================
            // CLOSE
            // =====================================================

            if (interaction.customId === "close_ticket") {

                await interaction.reply({

                    embeds: [

                        new EmbedBuilder()

                            .setColor("#ff0000")

                            .setDescription(`
🛑 Ticket fermé par ${interaction.user}
                            `)

                    ]

                });

            }

            // =====================================================
            // DELETE
            // =====================================================

            if (interaction.customId === "delete_ticket") {

                await interaction.reply({

                    content:
                    "🗑️ Suppression du ticket...",

                    ephemeral: true

                });

                setTimeout(async () => {

                    await interaction.channel.delete()
                        .catch(() => {});

                }, 2000);

            }

            // =====================================================
            // TEST MODERATEUR
            // =====================================================

            if (interaction.customId === "test_moderateur") {

                await interaction.reply({

                    embeds: [

                        new EmbedBuilder()

                            .setColor("#ffb347")

                            .setTitle("🧪 Test Modérateur")

                            .setDescription(`
Le candidat doit maintenant être évalué sur :

• Gestion
• Communication
• Réactivité
• Maturité
• Sanctions
• Connaissances Discord

Le staff pourra ensuite donner son avis.
                            `)

                    ]

                });

            }

        }

    });

};
