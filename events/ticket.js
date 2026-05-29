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

const LOGS_CHANNEL = "1508157026491175002";
const ARCHIVE_CHANNEL = "1510019228047114300";

const ticketCooldown = new Map();
const sessionContext = new Map(); // Garde en mémoire l'ID de l'utilisateur pour le salon du ticket

module.exports = async (client) => {

    console.log("[TICKET] Initialisation du système HoveX...");

    // =====================================================
    // ENVOI DU PANEL (Sécurisé pour éviter les blocages)
    // =====================================================
    const panelChannel = await client.channels.fetch(config.PANEL_CHANNEL).catch(() => null);
    if (!panelChannel) {
        return console.log("[TICKET] Erreur : Salon Panel introuvable. Vérifie l'ID dans le fichier config.");
    }

    // Suppression des anciens messages du bot dans ce salon pour actualiser proprement le panel
    const cachedMessages = await panelChannel.messages.fetch({ limit: 10 }).catch(() => null);
    if (cachedMessages) {
        const botMessages = cachedMessages.filter(m => m.author.id === client.user.id);
        for (const msg of botMessages.values()) {
            await msg.delete().catch(() => {});
        }
    }

    const panelEmbed = new EmbedBuilder()
        .setColor("#ffb347")
        .setTitle("🎫 HoveX Support System")
        .setDescription("Bienvenue sur le support officiel de la structure.\n\nSélectionnez la catégorie correspondante à votre demande ci-dessous :\n\n🛡️ **Staff**\n🎮 **Joueur (PR System)**\n🎬 **Audiovisuel**\n🆘 **Assistance / Aide**\n🤝 **Partenariat**\n\n⚠️ *Un seul ticket actif par utilisateur.*");

    const menuSelection = new StringSelectMenuBuilder()
        .setCustomId("ticket_select")
        .setPlaceholder("Sélectionne une catégorie...")
        .addOptions([
            { label: "Staff", value: "staff", emoji: "🛡️" },
            { label: "Joueur", value: "joueur", emoji: "🎮" },
            { label: "Audiovisuel", value: "audiovisuel", emoji: "🎬" },
            { label: "Assistance", value: "aide", emoji: "🆘" },
            { label: "Partenariat", value: "partenariat", emoji: "🤝" }
        ]);

    await panelChannel.send({
        embeds: [panelEmbed],
        components: [new ActionRowBuilder().addComponents(menuSelection)]
    }).then(() => console.log("[TICKET] Panel envoyé avec succès !")).catch(err => console.log("[TICKET] Erreur envoi panel :", err));

    // =====================================================
    // GESTION DES INTERACTIONS
    // =====================================================
    client.on("interactionCreate", async (i) => {
        if (!i.guild) return;

        // --- OUVERTURE DU TICKET ---
        if (i.isStringSelectMenu() && i.customId === "ticket_select") {
            const type = i.values[0];

            if (ticketCooldown.has(i.user.id)) {
                return i.reply({ content: "⏳ Tu as déjà un ticket actif ou une demande en cours.", ephemeral: true });
            }

            const categoryId = config.CATEGORIES[type];
            ticketCooldown.set(i.user.id, true);

            // Structure des permissions de base
            const basePermissions = [
                { id: i.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
            ];

            // Assignation automatique des permissions pour le staff concerné
            const staffRoles = config.ROLES[type] || [];
            staffRoles.forEach(roleId => {
                basePermissions.push({
                    id: roleId,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
                });
            });

            const ticketChannel = await i.guild.channels.create({
                name: `${type}-${i.user.username}`,
                type: ChannelType.GuildText,
                parent: categoryId || null,
                permissionOverwrites: basePermissions
            });

            sessionContext.set(ticketChannel.id, { userId: i.user.id, type: type });

            // Boutons d'administration standard du ticket
            const actionButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Primary).setEmoji("📌"),
                new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(ButtonStyle.Secondary).setEmoji("🔒"),
                new ButtonBuilder().setCustomId("delete").setLabel("Delete").setStyle(ButtonStyle.Danger).setEmoji("🗑️")
            );

            // Message d'accueil personnalisé par section
            let sectionEmbed = new EmbedBuilder().setColor("#ffb347").setTitle(`🎫 Ticket ${type.toUpperCase()} Ouvert`).setDescription(`Bonjour ${i.user}, le staff a été alerté de ton ouverture de ticket. Précise ta demande.`);

            if (type === "joueur") {
                sectionEmbed.setDescription(`Bienvenue dans ton espace de recrutement Joueur.\n\nPour soumettre tes statistiques et obtenir ton rôle de manière automatisée, merci de cliquer sur le bouton **Formulaire** ci-dessous et de remplir les informations demandées.`);
                actionButtons.addComponents(
                    new ButtonBuilder().setCustomId("form_joueur").setLabel("Formulaire").setStyle(ButtonStyle.Success).setEmoji("🧾")
                );
            } else if (type === "audiovisuel") {
                sectionEmbed.setDescription("Bienvenue dans le pôle Audiovisuel. Veuillez utiliser le menu déroulant ci-dessous pour choisir votre spécialisation (Monteur, Graphiste, Creator, Mapper).");
            }

            await ticketChannel.send({
                content: `<@${i.user.id}>`,
                embeds: [sectionEmbed],
                components: [actionButtons]
            });

            // Envoi d'un sélecteur additionnel pour le pôle audiovisuel
            if (type === "audiovisuel") {
                const audioMenu = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("audio_specialty")
                        .setPlaceholder("Choisis ta spécialité...")
                        .addOptions([
                            { label: "Monteur", value: "monteur", emoji: "🎥" },
                            { label: "Graphiste", value: "graphiste", emoji: "🎨" },
                            { label: "Content Creator", value: "creator", emoji: "📱" },
                            { label: "Thumbnail Maker / Mapper", value: "mapper", emoji: "🗺️" }
                        ])
                );
                await ticketChannel.send({ components: [audioMenu] });
            }

            return i.reply({ content: `✅ Ticket créé avec succès : ${ticketChannel}`, ephemeral: true });
        }

        // --- AFFICHAGE DU MODAL RECRUTEMENT JOUER ---
        if (i.isButton() && i.customId === "form_joueur") {
            const context = sessionContext.get(i.channel.id);
            if (!context || context.userId !== i.user.id) {
                return i.reply({ content: "❌ Seul l'auteur initial du ticket peut compléter ce formulaire.", ephemeral: true });
            }

            const modal = new ModalBuilder().setCustomId("joueur_modal_submit").setTitle("Formulaire de Recrutement");

            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("epic").setLabel("Pseudo Epic Games").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("age").setLabel("Âge").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("pr").setLabel("Points PR EU").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("platform").setLabel("Plateforme").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("motivation").setLabel("Pourquoi HoveX ?").setStyle(TextInputStyle.Paragraph).setRequired(true))
            );

            return i.showModal(modal);
        }

        // --- TRAITEMENT AUTOMATIQUE DU FORMULAIRE PR ---
        if (i.isModalSubmit() && i.customId === "joueur_modal_submit") {
            await i.deferReply({ ephemeral: true });

            const epic = i.fields.getTextInputValue("epic");
            const age = i.fields.getTextInputValue("age");
            const prValue = parseInt(i.fields.getTextInputValue("pr").replace(/\s/g, "")) || 0;
            const platform = i.fields.getTextInputValue("platform");
            const motivation = i.fields.getTextInputValue("motivation");

            // Algorithme d'attribution automatique du rôle PR
            let finalRole = config.PR_ROLES[0].role;
            let roleName = config.PR_ROLES[0].name;

            for (const item of config.PR_ROLES) {
                if (prValue >= item.min && prValue < item.max) {
                    finalRole = item.role;
                    roleName = item.name;
                    break;
                }
            }

            // Attribution du rôle sur le membre
            await i.member.roles.add(finalRole).catch(() => {});

            // Modification automatique du pseudo : HVX + Pseudo original
            const currentName = i.member.displayName;
            if (!currentName.startsWith("HVX")) {
                await i.member.setNickname(`HVX ${currentName.substring(0, 28)}`).catch(() => {});
            }

            // Changement de nom du salon
            await i.channel.setName(`hvx-${epic}`).catch(() => {});

            // Envoi du rapport dans le salon LOGS
            const logChannel = await i.guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor("Green")
                    .setTitle("📊 Rôle PR Assigné Automatiquement")
                    .setDescription(`Le joueur ${i.user} a complété son formulaire.`)
                    .addFields(
                        { name: "🎮 Epic", value: epic, inline: true },
                        { name: "🎂 Âge", value: age, inline: true },
                        { name: "🏆 Score PR", value: `${prValue} PR`, inline: true },
                        { name: "💻 Plateforme", value: platform, inline: true },
                        { name: "🏷️ Rôle Donné", value: `<@&${finalRole}> (${roleName})` },
                        { name: "📝 Motivation", value: motivation }
                    );
                await logChannel.send({ embeds: [logEmbed] });
            }

            // Lancement instantané du questionnaire de suivi dans le ticket
            const followUpEmbed = new EmbedBuilder()
                .setColor("Green")
                .setTitle("✅ Rôle Attribué avec Succès !")
                .setDescription(`Tes données ont été enregistrées avec succès. Le rôle **${roleName}** t'a été donné et ton nom a été mis à jour.\n\n**Question 1 :** As-tu besoin d'aide supplémentaire concernant ce rôle ?`);

            const helpRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("follow_help_yes").setLabel("Oui").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("follow_help_no").setLabel("Non").setStyle(ButtonStyle.Secondary)
            );

            await i.channel.send({ content: `<@${i.user.id}>`, embeds: [followUpEmbed], components: [helpRow] });
            return i.editReply({ content: "Formulaire traité et validé !" });
        }

        // --- QUESTIONNAIRES DE SUIVI JOUEUR ---
        if (i.isButton() && ["follow_help_yes", "follow_help_no", "follow_struct_yes", "follow_struct_no"].includes(i.customId)) {
            const context = sessionContext.get(i.channel.id);
            if (!context || i.user.id !== context.userId) {
                return i.reply({ content: "❌ Action non autorisée.", ephemeral: true });
            }

            await i.deferUpdate();

            if (i.customId === "follow_help_yes" || i.customId === "follow_help_no") {
                const step2Embed = new EmbedBuilder()
                    .setColor("#34495e")
                    .setTitle("❓ Question Suivante")
                    .setDescription("As-tu des questions particulières à poser concernant le fonctionnement de notre structure (HoveX) ?");

                const structRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("follow_struct_yes").setLabel("Oui").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId("follow_struct_no").setLabel("Non").setStyle(ButtonStyle.Secondary)
                );
                await i.channel.send({ embeds: [step2Embed], components: [structRow] });
            }

            if (i.customId === "follow_struct_no") {
                await i.channel.send({ content: "🏁 Parfait, aucune question restante. Clôture et archivage automatique du ticket..." });
                await createTextArchive(i.channel, client);
                setTimeout(() => {
                    ticketCooldown.delete(context.userId);
                    i.channel.delete().catch(() => {});
                }, 4000);
            }

            if (i.customId === "follow_struct_yes") {
                const countEmbed = new EmbedBuilder()
                    .setColor("#2ecc71")
                    .setTitle("💬 Nombre de questions")
                    .setDescription("Combien de questions souhaites-tu soumettre à l'équipe ?");

                const menuCount = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("user_questions_count")
                        .setPlaceholder("Choisis le nombre...")
                        .addOptions([
                            { label: "1 Question", value: "1" },
                            { label: "2 Questions", value: "2" },
                            { label: "3 Questions ou plus", value: "3" }
                        ])
                );
                await i.channel.send({ embeds: [countEmbed], components: [menuCount] });
            }
        }

        if (i.isStringSelectMenu() && i.customId === "user_questions_count") {
            const context = sessionContext.get(i.channel.id);
            if (!context || i.user.id !== context.userId) return;

            const total = i.values[0];
            await i.reply({ content: `✍️ Tu as indiqué avoir **${total}** question(s). Pose-les directement à l'écrit ici. Le staff va prendre le relais.` });

            const logChannel = await i.guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
            if (logChannel) {
                logChannel.send({
                    embeds: [new EmbedBuilder().setColor("Orange").setTitle("❓ Question en attente").setDescription(`Le joueur ${i.user} a fini son questionnaire et attend une réponse dans le salon ${i.channel}.`)]
                });
            }
        }

        // --- INTERACTION AUDIOVISUEL ---
        if (i.isStringSelectMenu() && i.customId === "audio_specialty") {
            await i.reply({ content: `🎬 Spécialité enregistrée : **${i.values[0].toUpperCase()}**. Un gestionnaire média arrive pour analyser ton portfolio.` });
        }

        // =====================================================
        // ACTIONS ET SÉCURITÉS STAFF (CLAIM, CLOSE, DELETE)
        // =====================================================
        if (i.isButton() && ["claim", "close", "delete"].includes(i.customId)) {
            const context = sessionContext.get(i.channel.id);
            const currentType = context ? context.type : "autre";
            const allowedStaffRoles = config.ROLES[currentType] || [];

            const hasAccess = i.member.roles.cache.some(r => allowedStaffRoles.includes(r.id)) || i.member.permissions.has(PermissionsBitField.Flags.ManageChannels);
            if (!hasAccess) return i.reply({ content: "❌ Droits d'accès insuffisants (Réservé au staff autorisé).", ephemeral: true });

            if (i.customId === "claim") {
                return i.reply({ content: `📌 Ce ticket est maintenant géré par ${i.user}.` });
            }

            if (i.customId === "close") {
                if (context && context.userId) {
                    await i.channel.permissionOverwrites.edit(context.userId, { ViewChannel: false }).catch(() => null);
                }
                return i.reply({ content: "🔒 Le ticket a été fermé et masqué à l'utilisateur." });
            }

            if (i.customId === "delete") {
                await i.reply({ content: "🗑️ Génération de l'archive textuelle et suppression définitive..." });
                await createTextArchive(i.channel, client);
                setTimeout(() => {
                    if (context && context.userId) ticketCooldown.delete(context.userId);
                    i.channel.delete().catch(() => {});
                }, 3000);
            }
        }
    });
};

// =====================================================
// FONCTION D'ARCHIVAGE AUTOMATIQUE (DURÉE 1 HEURE)
// =====================================================
async function createTextArchive(channel, client) {
    try {
        const fetchedMessages = await channel.messages.fetch({ limit: 100 });
        let logFormat = `--- LOGS DU SALON SUPPORT : ${channel.name} ---\n\n`;

        const chronological = fetchedMessages.reverse();
        chronological.forEach(msg => {
            logFormat += `[${msg.createdAt.toLocaleString()}] ${msg.author.tag}: ${msg.content}\n`;
        });

        const destinationLog = await client.channels.fetch(ARCHIVE_CHANNEL).catch(() => null);
        if (destinationLog) {
            const textBuffer = Buffer.from(logFormat, "utf-8");
            const archivePost = await destinationLog.send({
                content: `📁 Archive générée pour le ticket \`${channel.name}\`. (Ce fichier s'effacera automatiquement dans 1 heure)`,
                files: [{ attachment: textBuffer, name: `log-${channel.name}.txt` }]
            });

            // Supprime l'archive au bout de 60 minutes exactement
            setTimeout(() => {
                archivePost.delete().catch(() => {});
            }, 3600000);
        }
    } catch (error) {
        console.error("[ARCHIVE] Erreur lors de la compilation du fichier :", error);
    }
}
