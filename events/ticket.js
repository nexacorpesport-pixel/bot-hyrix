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
    // COOLDOWN SYSTEM
    // =========================================

    const ticketCooldown = new Map();

    // =========================================
    // READY (FIXED)
    // =========================================

    client.once("ready", async () => {

        console.log(`[TICKET] Bot prêt: ${client.user.tag}`);

        const channel = client.channels.cache.get(TICKET_CHANNEL);
        if (!channel) return console.log("[TICKET] Salon introuvable");

        const messages = await channel.messages.fetch({ limit: 50 });

        // supprime anciens panels pour éviter doublons
        const old = messages.filter(m =>
            m.author.id === client.user.id &&
            m.embeds.length &&
            m.embeds[0]?.title === "🎫 Support Pyxar"
        );

        for (const msg of old.values()) {
            await msg.delete().catch(() => {});
        }

        // MENU
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
Bienvenue dans le système de tickets officiel.

Choisis une catégorie pour ouvrir un ticket.

⚠️ 2 tickets / 10 min max
⚠️ Pas de spam
`)
            .setFooter({ text: "Pyxar Support" });

        await channel.send({
            embeds: [embed],
            components: [row]
        });

    });

    // =========================================
    // INTERACTIONS
    // =========================================

    client.on("interactionCreate", async (interaction) => {

        // =========================
        // MENU TICKET
        // =========================

        if (interaction.isStringSelectMenu() && interaction.customId === "ticket_select") {

            // Sécurité : s'assurer que le menu ne fonctionne que dans le salon de configuration
            if (interaction.channelId !== TICKET_CHANNEL) return;

            const userId = interaction.user.id;

            if (!ticketCooldown.has(userId)) ticketCooldown.set(userId, []);

            const timestamps = ticketCooldown.get(userId);
            const now = Date.now();

            const filtered = timestamps.filter(t => now - t < 600000);

            if (filtered.length >= 2) {
                return interaction.reply({
                    content: "❌ Limite de 2 tickets / 10 min atteinte.",
                    ephemeral: true
                });
            }

            filtered.push(now);
            ticketCooldown.set(userId, filtered);

            const type = interaction.values[0];

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

            const ticket = await interaction.guild.channels.create({
                name: `${type}-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: category,

                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionsBitField.Flags.ViewChannel]
                    },
                    {
                        id: interaction.user.id,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ReadMessageHistory
                        ]
                    },
                    ...roles.map(r => ({
                        id: r,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ReadMessageHistory
                        ]
                    }))
                ]
            });

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("claim").setLabel("Claim").setEmoji("📌").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("close").setLabel("Fermer").setEmoji("🔒").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("delete").setLabel("Supprimer").setEmoji("🗑️").setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId("rename").setLabel("Rename").setEmoji("✏️").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId("help").setLabel("Aide").setEmoji("❓").setStyle(ButtonStyle.Secondary)
            );

            const embedTicket = new EmbedBuilder()
                .setColor("#ffb347")
                .setTitle("🎫 Ticket Ouvert")
                .setDescription(`Bienvenue ${interaction.user}`)
                .setFooter({ text: "Pyxar Ticket System" });

            await ticket.send({
                content: `${interaction.user} ${roles.map(r => `<@&${r}>`).join(" ")}`,
                embeds: [embedTicket],
                components: [buttons]
            });

            // FORMS
            if (type === "staff") {
                await ticket.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ffb347")
                            .setTitle("🛡️ Recrutement Staff")
                            .setDescription("Réponds au formulaire dans le chat.")
                    ]
                });
            }

            if (type === "joueur") {
                const testButton = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("test_modo")
                        .setLabel("Test Modérateur")
                        .setEmoji("🧪")
                        .setStyle(ButtonStyle.Success)
                );

                await ticket.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("🎮 Recrutement Joueur")
                            .setColor("#ffb347")
                    ],
                    components: [testButton]
                });
            }

            if (type === "audiovisuel") {
                await ticket.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("🎬 Audiovisuel")
                            .setColor("#ffb347")
                    ]
                });
            }

            return interaction.reply({
                content: `✅ Ticket créé : ${ticket}`,
                ephemeral: true
            });
        }

        // =========================
        // MODAL SUBMIT (Déplacé ici pour ne pas être bloqué par le return du bouton)
        // =========================

        if (interaction.isModalSubmit() && interaction.customId === "rename_modal") {
            const name = interaction.fields.getTextInputValue("ticket_name");

            await interaction.channel.setName(name);

            return interaction.reply({
                content: `✏️ Renommé en ${name}`,
                ephemeral: true
            });
        }

        // =========================
        // BUTTONS
        // =========================

        if (!interaction.isButton()) return;

        if (interaction.customId === "claim") {
            return interaction.reply({
                content: `📌 Claim par ${interaction.user}`
            });
        }

        if (interaction.customId === "close") {
            await interaction.channel.permissionOverwrites.edit(
                interaction.guild.roles.everyone,
                { SendMessages: false }
            );

            return interaction.reply("🔒 Fermé.");
        }

        if (interaction.customId === "delete") {
            await interaction.reply("🗑️ Suppression dans 5s...");
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        }

        if (interaction.customId === "help") {
            return interaction.reply({
                ephemeral: true,
                embeds: [
                    new EmbedBuilder()
                        .setTitle("❓ Aide")
                        .setColor("#ffb347")
                ]
            });
        }

        if (interaction.customId === "test_modo") {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("🧪 Test Modérateur")
                        .setColor("#ffb347")
                ]
            });
        }

        if (interaction.customId === "rename") {
            const modal = new ModalBuilder()
                .setCustomId("rename_modal")
                .setTitle("Renommer ticket");

            const input = new TextInputBuilder()
                .setCustomId("ticket_name")
                .setLabel("Nouveau nom")
                .setStyle(TextInputStyle.Short);

            modal.addComponents(new ActionRowBuilder().addComponents(input));

            return interaction.showModal(modal);
        }
    });
};
