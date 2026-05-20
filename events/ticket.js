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

module.exports = async (client) => {

    // =========================================
    // CONFIG
    // =========================================

    const TICKET_CHANNEL = "1505330772343656680";

    const STAFF_CATEGORY = "1505559323105951744";
    const JOUEUR_CATEGORY = "1505559260975595753";
    const AUDIO_CATEGORY = "1506771653621710848";
    const AIDE_CATEGORY = "1505559399442284605";
    const AUTRE_CATEGORY = "1506771703769071726";

    const STAFF_ROLES = [
        "1505330692106485781",
        "1505330696619688027",
        "1505330697806811271"
    ];

    const JOUEUR_ROLES = [
        "1505330692106485781",
        "1505330696619688027",
        "1505330697806811271",
        "1505330699752706269",
        "1505330700654477403"
    ];

    // =========================================
    // ANTI SPAM
    // =========================================

    const ticketCooldown = new Map();

    // =========================================
    // READY
    // =========================================

    client.once("clientReady", async () => {

        const channel = client.channels.cache.get(TICKET_CHANNEL);

        if (!channel) return;

        // =========================================
        // CHECK PANEL
        // =========================================

        const messages = await channel.messages.fetch({ limit: 10 });

        const alreadyExists = messages.find(
            msg =>
                msg.author.id === client.user.id &&
                msg.embeds.length > 0 &&
                msg.embeds[0].title === "🎫 Support Pyxar"
        );

        if (alreadyExists) return;

        // =========================================
        // MENU
        // =========================================

        const menu = new StringSelectMenuBuilder()

            .setCustomId("ticket_select")

            .setPlaceholder("🎫 Sélectionne une catégorie")

            .addOptions([
                {
                    label: "Recrutement Staff",
                    value: "staff",
                    emoji: "🛡️",
                    description: "Postule pour rejoindre le staff"
                },
                {
                    label: "Recrutement Joueur",
                    value: "joueur",
                    emoji: "🎮",
                    description: "Postule comme joueur"
                },
                {
                    label: "Audiovisuel",
                    value: "audiovisuel",
                    emoji: "🎬",
                    description: "Graphisme / montage / caster"
                },
                {
                    label: "Assistance",
                    value: "aide",
                    emoji: "🆘",
                    description: "Besoin d'aide"
                },
                {
                    label: "Partenariat",
                    value: "partenariat",
                    emoji: "🤝",
                    description: "Demande de partenariat"
                },
                {
                    label: "Autre",
                    value: "autre",
                    emoji: "📩",
                    description: "Autre demande"
                }
            ]);

        const row = new ActionRowBuilder().addComponents(menu);

        const embed = new EmbedBuilder()

            .setColor("#ffb347")

            .setTitle("🎫 Support Pyxar")

            .setDescription(`
Bienvenue dans le système de tickets officiel de **Pyxar**.

Sélectionne une catégorie afin d'ouvrir un ticket.

⚠️ Merci d'éviter le spam.
⚠️ Deux tickets maximum toutes les 10 minutes.

Nos équipes te répondront dès que possible.
`)

            .setFooter({
                text: "Pyxar Support"
            });

        await channel.send({
            embeds: [embed],
            components: [row]
        });

    });

    // =========================================
    // INTERACTION CREATE
    // =========================================

    client.on("interactionCreate", async (interaction) => {

        // =========================================
        // MENU
        // =========================================

        if (
            interaction.isStringSelectMenu() &&
            interaction.customId === "ticket_select"
        ) {

            const userId = interaction.user.id;

            // =========================================
            // COOLDOWN
            // =========================================

            if (!ticketCooldown.has(userId)) {
                ticketCooldown.set(userId, []);
            }

            const timestamps = ticketCooldown.get(userId);

            const now = Date.now();

            const filtered = timestamps.filter(
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

            const type = interaction.values[0];

            // =========================================
            // CATEGORY
            // =========================================

            let category;
            let roles = [];

            switch (type) {

                case "staff":
                    category = STAFF_CATEGORY;
                    roles = STAFF_ROLES;
                    break;

                case "joueur":
                    category = JOUEUR_CATEGORY;
                    roles = JOUEUR_ROLES;
                    break;

                case "audiovisuel":
                    category = AUDIO_CATEGORY;
                    roles = STAFF_ROLES;
                    break;

                case "aide":
                    category = AIDE_CATEGORY;
                    roles = STAFF_ROLES;
                    break;

                default:
                    category = AUTRE_CATEGORY;
                    roles = STAFF_ROLES;

            }

            // =========================================
            // CREATE CHANNEL
            // =========================================

            const ticket = await interaction.guild.channels.create({

                name:
                `${type}-${interaction.user.username}`,

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

                    ...roles.map(role => ({
                        id: role,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ReadMessageHistory
                        ]
                    }))

                ]

            });

            // =========================================
            // BUTTONS
            // =========================================

            const buttons = new ActionRowBuilder()

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

            // =========================================
            // EMBED
            // =========================================

            const ticketEmbed = new EmbedBuilder()

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

            await ticket.send({
                content:
                `${interaction.user} ${roles.map(r => `<@&${r}>`).join(" ")}`,
                embeds: [ticketEmbed],
                components: [buttons]
            });

            // =========================================
            // FORM STAFF
            // =========================================

            if (type === "staff") {

                const embed = new EmbedBuilder()

                    .setColor("#ffb347")

                    .setTitle("🛡️ Recrutement Staff")

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

            // =========================================
            // FORM JOUEUR
            // =========================================

            if (type === "joueur") {

                const testButton = new ActionRowBuilder()

                    .addComponents(

                        new ButtonBuilder()
                            .setCustomId("test_modo")
                            .setLabel("Test Modérateur")
                            .setEmoji("🧪")
                            .setStyle(ButtonStyle.Success)

                    );

                const embed = new EmbedBuilder()

                    .setColor("#ffb347")

                    .setTitle("🎮 Recrutement Joueur")

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

            // =========================================
            // AUDIO
            // =========================================

            if (type === "audiovisuel") {

                const embed = new EmbedBuilder()

                    .setColor("#ffb347")

                    .setTitle("🎬 Recrutement Audiovisuel")

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

            // =========================================
            // REPLY
            // =========================================

            await interaction.reply({

                content:
                `✅ Ticket créé : ${ticket}`,

                ephemeral: true

            });

        }

        // =========================================
        // BUTTONS
        // =========================================

        if (interaction.isButton()) {

            // CLAIM
            if (interaction.customId === "claim") {

                await interaction.reply({
                    content:
                    `📌 Ticket claim par ${interaction.user}`,
                    ephemeral: false
                });

            }

            // CLOSE
            if (interaction.customId === "close") {

                await interaction.channel.permissionOverwrites.edit(
                    interaction.channel.guild.roles.everyone,
                    {
                        SendMessages: false
                    }
                );

                await interaction.reply({
                    content:
                    "🔒 Ticket fermé."
                });

            }

            // DELETE
            if (interaction.customId === "delete") {

                await interaction.reply({
                    content:
                    "🗑️ Suppression du ticket dans 5 secondes..."
                });

                setTimeout(async () => {

                    await interaction.channel.delete().catch(() => {});

                }, 5000);

            }

            // HELP
            if (interaction.customId === "help") {

                await interaction.reply({

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

            // TEST MODERATOR
            if (interaction.customId === "test_modo") {

                await interaction.reply({

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

            // RENAME
            if (interaction.customId === "rename") {

                const modal = new ModalBuilder()

                    .setCustomId("rename_modal")

                    .setTitle("Renommer le ticket");

                const input = new TextInputBuilder()

                    .setCustomId("ticket_name")

                    .setLabel("Nouveau nom")

                    .setStyle(TextInputStyle.Short)

                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(input)
                );

                await interaction.showModal(modal);

            }

        }

        // =========================================
        // MODAL
        // =========================================

        if (
            interaction.isModalSubmit() &&
            interaction.customId === "rename_modal"
        ) {

            const name =
                interaction.fields.getTextInputValue(
                    "ticket_name"
                );

            await interaction.channel.setName(name);

            await interaction.reply({

                content:
                `✏️ Ticket renommé en \`${name}\``,

                ephemeral: true

            });

        }

    });

};
