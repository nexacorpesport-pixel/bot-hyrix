const {

    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ChannelType,
    PermissionsBitField,
    ButtonBuilder,
    ButtonStyle

} = require("discord.js");

const config = require("../data/ticketConfig");

module.exports = async (client) => {

    client.once("clientReady", async () => {

        try {

            const panelChannel =
                client.channels.cache.get(config.PANEL_CHANNEL);

            if (!panelChannel) return;

            // =========================
            // EMBED PRINCIPAL
            // =========================

            const embed = new EmbedBuilder()

                .setColor("#ffb347")

                .setTitle("🎫 Centre de support Pyxar")

                .setDescription(`
Bienvenue dans le système de tickets officiel de Pyxar.

Merci de sélectionner la catégorie correspondant à votre demande.

📌 Catégories disponibles :
• Recrutement Staff
• Recrutement Joueur
• Recrutement Audiovisuel
• Assistance
• Partenariat
• Autre

Nos équipes vous répondront rapidement.
                `)

                .setFooter({
                    text: "Pyxar Support"
                });

            // =========================
            // MENU
            // =========================

            const menu = new ActionRowBuilder()

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

            // =========================
            // SEND PANEL
            // =========================

            const messages = await panelChannel.messages.fetch();

            const alreadyExists = messages.find(
                m => m.author.id === client.user.id
            );

            if (!alreadyExists) {

                await panelChannel.send({

                    embeds: [embed],
                    components: [menu]

                });

            }

        } catch (err) {

            console.log(err);

        }

    });

    // =========================
    // INTERACTION CREATE
    // =========================

    client.on("interactionCreate", async (interaction) => {

        if (!interaction.isStringSelectMenu()) return;

        if (interaction.customId !== "ticket_select") return;

        const choice = interaction.values[0];

        // =========================
        // ANTI SPAM
        // =========================

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

        // =========================
        // CATEGORY
        // =========================

        let categoryId;

        if (choice === "staff")
            categoryId = config.CATEGORIES.staff;

        if (choice === "joueur")
            categoryId = config.CATEGORIES.joueur;

        if (choice === "audiovisuel")
            categoryId = config.CATEGORIES.audiovisuel;

        if (choice === "aide")
            categoryId = config.CATEGORIES.aide;

        if (choice === "partenariat")
            categoryId = config.CATEGORIES.autre;

        if (choice === "autre")
            categoryId = config.CATEGORIES.autre;

        // =========================
        // ROLES
        // =========================

        let supportRoles = [];

        if (choice === "staff")
            supportRoles = config.ROLES.staff;

        if (choice === "joueur")
            supportRoles = config.ROLES.joueur;

        if (choice === "audiovisuel")
            supportRoles = config.ROLES.audiovisuel;

        if (choice === "aide")
            supportRoles = config.ROLES.aide;

        if (choice === "partenariat")
            supportRoles = config.ROLES.autre;

        if (choice === "autre")
            supportRoles = config.ROLES.autre;

        // =========================
        // CREATE CHANNEL
        // =========================

        const ticket =
            await interaction.guild.channels.create({

                name:
                `ticket-${interaction.user.username}`,

                type: ChannelType.GuildText,

                parent: categoryId,

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

                    ...supportRoles.map(roleId => ({

                        id: roleId,

                        allow: [

                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ReadMessageHistory

                        ]

                    }))

                ]

            });

        // =========================
        // BUTTONS
        // =========================

        const buttons =
            new ActionRowBuilder()

                .addComponents(

                    new ButtonBuilder()
                        .setCustomId("claim")
                        .setLabel("Claim")
                        .setStyle(ButtonStyle.Primary),

                    new ButtonBuilder()
                        .setCustomId("close")
                        .setLabel("Fermer")
                        .setStyle(ButtonStyle.Secondary),

                    new ButtonBuilder()
                        .setCustomId("delete")
                        .setLabel("Supprimer")
                        .setStyle(ButtonStyle.Danger),

                    new ButtonBuilder()
                        .setCustomId("rename")
                        .setLabel("Rename")
                        .setStyle(ButtonStyle.Success),

                    new ButtonBuilder()
                        .setCustomId("help")
                        .setLabel("Aide")
                        .setStyle(ButtonStyle.Secondary)

                );

        // =========================
        // EMBED TICKET
        // =========================

        const ticketEmbed =
            new EmbedBuilder()

                .setColor("#ffb347")

                .setTitle("🎫 Ticket ouvert")

                .setDescription(`
Bienvenue dans votre ticket Pyxar.

Merci d'expliquer votre demande précisément.

Un membre du staff vous répondra rapidement.
                `)

                .setFooter({
                    text: "Pyxar Support"
                });

        // =========================
        // SEND
        // =========================

        await ticket.send({

            content:
            `${interaction.user}`,

            embeds: [ticketEmbed],

            components: [buttons]

        });

        // =========================
        // REPONSE
        // =========================

        await interaction.reply({

            content:
            `✅ Ticket créé : ${ticket}`,

            ephemeral: true

        });

    });

};
