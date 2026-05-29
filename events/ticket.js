// =====================================================
// events/ticket.js
// HOVEX TICKET SYSTEM V2 (PATCH)
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

const ticketCooldown = new Map();

module.exports = async (client) => {

    try {

        console.log("[TICKET] Chargement du système...");

        const channel = await client.channels.fetch(config.PANEL_CHANNEL).catch(() => null);

        if (!channel) return console.log("[TICKET] Salon introuvable.");

        // =====================================================
        // PANEL EMBED (STYLÉ)
        // =====================================================
        const embed = new EmbedBuilder()
            .setColor("#ffb347")
            .setTitle("🎫 HOVEX SUPPORT CENTER")
            .setDescription(`
✨ Bienvenue dans le système officiel

━━━━━━━━━━━━━━━━━━

🛡️ **STAFF**
→ Recrutement équipe

🎮 **JOUEUR**
→ Grinder / Esport / PR System

🎬 **AUDIOVISUEL**
→ Création / montage / design

🆘 **ASSISTANCE**
🚧 Maintenance en cours

🤝 **PARTENARIAT**
🚧 Maintenance en cours

📩 **AUTRE**
→ Support général

━━━━━━━━━━━━━━━━━━

⚠️ Système en amélioration continue
            `)
            .setFooter({ text: "HOVEX • Ticket System V2" });

        // =====================================================
        // MENU STYLÉ + LOCK SYSTEM
        // =====================================================
        const menu = new StringSelectMenuBuilder()
            .setCustomId("ticket_select")
            .setPlaceholder("🎫 Ouvre un ticket")
            .addOptions([
                {
                    label: "🛡️ Recrutement Staff",
                    value: "staff",
                    description: "Rejoins l'équipe staff"
                },
                {
                    label: "🎮 Recrutement Joueur",
                    value: "joueur",
                    description: "Grinder / compétitif / PR system"
                },
                {
                    label: "🎬 Audiovisuel",
                    value: "audiovisuel",
                    description: "Création & contenu"
                },
                {
                    label: "🆘 Assistance (MAINTENANCE)",
                    value: "locked",
                    description: "Système temporairement indisponible"
                },
                {
                    label: "🤝 Partenariat (MAINTENANCE)",
                    value: "locked",
                    description: "Bientôt disponible"
                },
                {
                    label: "📩 Autre",
                    value: "autre",
                    description: "Support général"
                }
            ]);

        const row = new ActionRowBuilder().addComponents(menu);

        await channel.send({
            embeds: [embed],
            components: [row]
        });

        console.log("[TICKET] Panel envoyé.");

    } catch (err) {
        console.log("[TICKET] Erreur :", err);
    }

    // =====================================================
    // INTERACTIONS (GLOBAL LISTENER SAFE)
    // =====================================================
    client.on("interactionCreate", async (i) => {

        // =========================
        // MENU
        // =========================
        if (i.isStringSelectMenu() && i.customId === "ticket_select") {

            const type = i.values[0];

            // 🚧 LOCK SYSTEM
            if (type === "locked") {
                return i.reply({
                    content: "🚧 Ce système est en maintenance. Réessaie plus tard.",
                    ephemeral: true
                });
            }

            const existing = i.guild.channels.cache.find(
                c => c.name === `ticket-${i.user.username}`
            );

            if (existing) {
                return i.reply({
                    content: `❌ Ticket déjà existant : ${existing}`,
                    ephemeral: true
                });
            }

            const category = config.CATEGORIES[type];

            const ticket = await i.guild.channels.create({
                name: `ticket-${i.user.username}`,
                type: ChannelType.GuildText,
                parent: category,
                permissionOverwrites: [
                    {
                        id: i.guild.id,
                        deny: [PermissionsBitField.Flags.ViewChannel]
                    },
                    {
                        id: i.user.id,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ReadMessageHistory
                        ]
                    }
                ]
            });

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("claim").setLabel("📌 Claim").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("close").setLabel("🔒 Close").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("delete").setLabel("🗑️ Delete").setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId("help").setLabel("❓ Help").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("form_joueur").setLabel("🎮 Formulaire PR").setStyle(ButtonStyle.Success)
            );

            const embedTicket = new EmbedBuilder()
                .setColor("#ffb347")
                .setTitle("🎫 TICKET OUVERT")
                .setDescription(`
👋 Bienvenue ${i.user}

━━━━━━━━━━━━━━━━━━

📌 Explique ta demande clairement
⏱️ Réponse rapide du staff
🚫 Pas de spam

━━━━━━━━━━━━━━━━━━
                `)
                .setFooter({ text: "HOVEX SUPPORT" });

            await ticket.send({
                content: `<@${i.user.id}>`,
                embeds: [embedTicket],
                components: [buttons]
            });

            // =========================
            // STAFF / AUTRES FORMS
            // =========================
            if (type === "staff") {
                await ticket.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("🛡️ Recrutement Staff")
                            .setColor("#ffb347")
                            .setDescription("Réponds directement dans le ticket.")
                    ]
                });
            }

            if (type === "audiovisuel") {
                await ticket.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("🎬 Audiovisuel")
                            .setColor("#ffb347")
                            .setDescription("Présente ton portfolio et ton expérience.")
                    ]
                });
            }

            return i.reply({
                content: "✅ Ticket créé",
                ephemeral: true
            });
        }

        // =========================
        // FORM JOUEUR
        // =========================
        if (i.isButton() && i.customId === "form_joueur") {

            const modal = new ModalBuilder()
                .setCustomId("joueur_form")
                .setTitle("🎮 Recrutement Joueur");

            const pr = new TextInputBuilder()
                .setCustomId("pr")
                .setLabel("PR EU")
                .setStyle(TextInputStyle.Short);

            const age = new TextInputBuilder()
                .setCustomId("age")
                .setLabel("Âge")
                .setStyle(TextInputStyle.Short);

            modal.addComponents(
                new ActionRowBuilder().addComponents(pr),
                new ActionRowBuilder().addComponents(age)
            );

            return i.showModal(modal);
        }

        // =========================
        // FORM SUBMIT
        // =========================
        if (i.isModalSubmit() && i.customId === "joueur_form") {

            const pr = parseInt(i.fields.getTextInputValue("pr"));
            const age = i.fields.getTextInputValue("age");

            return i.reply({
                content: `
🎮 **CANDIDATURE ENREGISTRÉE**

👤 ${i.user}

━━━━━━━━━━━━━━━━━━

📊 PR : ${pr}
🎂 Âge : ${age}

━━━━━━━━━━━━━━━━━━

🏆 Analyse en cours...
                `,
                ephemeral: true
            });
        }

        // =========================
        // BUTTONS
        // =========================
        if (!i.isButton()) return;

        if (i.customId === "claim") return i.reply(`📌 Claim par ${i.user}`);

        if (i.customId === "close") {
            await i.channel.permissionOverwrites.edit(i.guild.roles.everyone, {
                SendMessages: false
            });
            return i.reply("🔒 fermé");
        }

        if (i.customId === "delete") {
            await i.reply("🗑️ suppression 5s");
            setTimeout(() => i.channel.delete().catch(() => {}), 5000);
        }

        if (i.customId === "help") {
            return i.reply({
                ephemeral: true,
                content: "📩 Un staff va arriver"
            });
        }

    });
};
