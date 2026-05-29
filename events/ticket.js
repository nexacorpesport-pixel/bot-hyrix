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

// =========================
// CHANNELS STATIQUES
// =========================
const LOGS_CHANNEL = "1508157026491175002";
const ARCHIVE_CHANNEL = "1510019228047114300";

// =========================
// STOCKAGE EN MÉMOIRE
// =========================
const cooldown = new Map();
const ticketData = new Map(); // Permet de suivre l'état de chaque ticket (ID du membre, PR, pseudo, etc.)

module.exports = async (client) => {

    console.log("[TICKET] Support HoveX prêt et configuré.");

    const channel = await client.channels.fetch(config.PANEL_CHANNEL).catch(() => null);
    if (!channel) return console.log("⚠️ Le salon du Panel est introuvable.");

    // =====================================================
    // ENVOI DU PANEL PRINCIPAL (Optionnel: nettoie avant pour éviter les doublons)
    // =====================================================
    const panelEmbed = new EmbedBuilder()
        .setColor("#ffb347")
        .setTitle("🎫 HoveX Support System")
        .setDescription(`Bienvenue dans le support officiel.\n\nChoisis une catégorie :\n\n🛡️ Staff\n🎮 Joueur (PR System)\n🎬 Audiovisuel\n🆘 Aide\n🤝 Partenariat\n\n⚠️ *Un seul ticket autorisé à la fois.*`);

    const menu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("ticket_select")
            .setPlaceholder("Sélectionne une catégorie")
            .addOptions([
                { label: "Staff", value: "staff", emoji: "🛡️" },
                { label: "Joueur", value: "joueur", emoji: "🎮" },
                { label: "Audiovisuel", value: "audiovisuel", emoji: "🎬" },
                { label: "Aide", value: "aide", emoji: "🆘" },
                { label: "Partenariat", value: "partenariat", emoji: "🤝" }
            ])
    );

    // Envoi initial du panel (Commenter cette ligne si tu veux l'envoyer via une commande dédiée pour éviter le spam au reboot)
    // await channel.send({ embeds: [panelEmbed], components: [menu] });

    // =====================================================
    // GESTIONNAIRE D'INTERACTIONS
    // =====================================================
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.guild) return;

        // 1. SÉLECTION D'UNE CATÉGORIE DE TICKET
        if (interaction.isStringSelectMenu() && interaction.customId === "ticket_select") {
            const userId = interaction.user.id;
            const type = interaction.values[0];

            if (cooldown.has(userId)) {
                return interaction.reply({ content: "⏳ Tu as déjà un ticket ou une demande active.", ephemeral: true });
            }

            cooldown.set(userId, true);
            const targetCategory = config.CATEGORIES[type === "partenariat" ? "autre" : type];

            // Configuration de base des permissions
            const permissionOverwrites = [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
            ];

            // Ajout automatique des rôles Staff spécifiques à la catégorie
            const allowedRoles = config.ROLES[type === "partenariat" ? "autre" : type] || [];
            allowedRoles.forEach(roleId => {
                permissionOverwrites.push({
                    id: roleId,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
                });
            });

            // Création du salon de ticket dans la bonne catégorie
            const ticket = await interaction.guild.channels.create({
                name: `${type}-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: targetCategory || null,
                permissionOverwrites: permissionOverwrites
            });

            // Stockage initial des données du ticket
            ticketData.set(ticket.id, { creatorId: userId, type: type, step: "init" });

            // Message de bienvenue standard avec les boutons principaux
            const baseEmbed = new EmbedBuilder()
                .setColor("#ffb347")
                .setTitle(`🎫 Ticket ${type.toUpperCase()} ouvert`)
                .setDescription(`Bienvenue ${interaction.user}. Le staff a été notifié.`);

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Primary).setEmoji("📌"),
                new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(ButtonStyle.Secondary).setEmoji("🔒"),
                new ButtonBuilder().setCustomId("delete").setLabel("Delete").setStyle(ButtonStyle.Danger).setEmoji("🗑️")
            );

            await ticket.send({ embeds: [baseEmbed], components: [buttons] });

            // LOG de création du ticket
            const logsChan = await client.channels.fetch(LOGS_CHANNEL).catch(() => null);
            if (logsChan) {
                logsChan.send({
                    embeds: [new EmbedBuilder().setColor("Blue").setTitle("📩 Nouveau ticket créé").addFields({ name: "Utilisateur", value: `${interaction.user.tag} (${interaction.user.id})` }, { name: "Salon", value: `${ticket}` }, { name: "Type", value: type.toUpperCase() })]
                });
            }

            // --- FLOW SPECIFIQUE : JOUEUR ---
            if (type === "joueur") {
                const intro = new EmbedBuilder()
                    .setColor("#3498db")
                    .setTitle("🎮 Recrutement Joueur - Règlement")
                    .setDescription("Bonjour ! Bienvenue dans ton espace de recrutement. Prends le temps de lire attentivement nos conditions d'entrée.\n\nUne fois prêt, clique sur le bouton ci-dessous pour remplir ton formulaire complet.");

                const formBtn = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("joueur_form").setLabel("Remplir le formulaire").setStyle(ButtonStyle.Success).setEmoji("🧾")
                );
                await ticket.send({ embeds: [intro], components: [formBtn] });
            }

            // --- FLOW SPECIFIQUE : STAFF ---
            if (type === "staff") {
                await ticket.send({
                    embeds: [new EmbedBuilder().setColor("#e74c3c").setTitle("🛡️ Recrutement Staff").setDescription("Merci de ton intérêt ! Explique tes motivations, tes anciennes expériences et tes disponibilités directement à la suite de ce message.")]
                });
            }

            // --- FLOW SPECIFIQUE : AUDIOVISUEL ---
            if (type === "audiovisuel") {
                const audioEmbed = new EmbedBuilder()
                    .setColor("#9b59b6")
                    .setTitle("🎬 Recrutement Audiovisuel")
                    .setDescription("Bienvenue ! Afin de mieux vous aiguiller, veuillez sélectionner la spécialité qui vous correspond le mieux :");

                const audioMenu = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("audio_select")
                        .setPlaceholder("Choisis ta spécialité...")
                        .addOptions([
                            { label: "Monteur", value: "monteur", emoji: "🎥" },
                            { label: "Graphiste", value: "graphiste", emoji: "🎨" },
                            { label: "Content Creator", value: "creator", emoji: "📱" },
                            { label: "Thumbnail Maker / Mapper", value: "mapper", emoji: "🗺️" }
                        ])
                );
                await ticket.send({ embeds: [audioEmbed], components: [audioMenu] });
            }

            return interaction.reply({ content: `✅ Ton ticket a été créé : ${ticket}`, ephemeral: true });
        }

        // 2. APPARITION DU MODAL JOUEUR
        if (interaction.isButton() && interaction.customId === "joueur_form") {
            const data = ticketData.get(interaction.channel.id);
            if (!data || data.creatorId !== interaction.user.id) {
                return interaction.reply({ content: "❌ Seul le créateur du ticket peut remplir ce formulaire.", ephemeral: true });
            }

            const modal = new ModalBuilder().setCustomId("joueur_modal").setTitle("Recrutement Joueur");

            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("pseudo").setLabel("Pseudo Epic Games").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("age").setLabel("Âge").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("pr").setLabel("Points PR EU").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("platform").setLabel("Plateforme (PC, PS5, Xbox...)").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("motivation").setLabel("Pourquoi rejoindre la structure ?").setStyle(TextInputStyle.Paragraph).setRequired(true))
            );

            return interaction.showModal(modal);
        }

        // 3. SOUMISSION DU MODAL JOUEUR & ENVOI AU STAFF POUR VALIDATION
        if (interaction.isModalSubmit() && interaction.customId === "joueur_modal") {
            await interaction.deferReply({ ephemeral: true });

            const pseudo = interaction.fields.getTextInputValue("pseudo");
            const age = interaction.fields.getTextInputValue("age");
            const prInput = interaction.fields.getTextInputValue("pr");
            const pr = parseInt(prInput.replace(/\s/g, "")) || 0;
            const platform = interaction.fields.getTextInputValue("platform");
            const motivation = interaction.fields.getTextInputValue("motivation");

            // Détermination automatique du rôle associé au PR
            let assignedRoleId = config.PR_ROLES[0].role;
            for (const prRange of config.PR_ROLES) {
                if (pr >= prRange.min && pr < prRange.max) {
                    assignedRoleId = prRange.role;
                    break;
                }
            }

            // Sauvegarde des informations de candidature dans la mémoire du ticket
            const currentData = ticketData.get(interaction.channel.id) || {};
            ticketData.set(interaction.channel.id, {
                ...currentData,
                candidateId: interaction.user.id,
                epicPseudo: pseudo,
                assignedRole: assignedRoleId,
                step: "pending_review"
            });

            // Message envoyé dans le ticket du joueur
            await interaction.channel.send({
                embeds: [new EmbedBuilder().setColor("#f1c40f").setTitle("⏳ Candidature envoyée !").setDescription("Ta candidature est en cours de validation par le staff.\nTu recevras une notification ici et en privé dès qu'un administrateur l'aura acceptée ou refusée.")]
            });

            // Envoi dans les LOGS pour action du staff
            const logsChan = await client.channels.fetch(LOGS_CHANNEL).catch(() => null);
            if (logsChan) {
                const staffReviewEmbed = new EmbedBuilder()
                    .setColor("#f39c12")
                    .setTitle("📊 Nouvelle Candidature Joueur à Vérifier")
                    .setDescription(`Soumise par ${interaction.user} (${interaction.user.id})\nDans le salon : ${interaction.channel}`)
                    .addFields(
                        { name: "🎮 Pseudo Epic", value: pseudo, inline: true },
                        { name: "🎂 Âge", value: age, inline: true },
                        { name: "🏆 Points PR", value: `${pr} PR`, inline: true },
                        { name: "💻 Plateforme", value: platform, inline: true },
                        { name: "🎯 Rôle Pré-calculé", value: `<@&${assignedRoleId}>`, inline: true },
                        { name: "📝 Motivation", value: motivation }
                    );

                const staffActionButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`accept_candidate_${interaction.channel.id}`).setLabel("Accepter").setStyle(ButtonStyle.Success).setEmoji("✅"),
                    new ButtonBuilder().setCustomId(`reject_candidate_${interaction.channel.id}`).setLabel("Refuser").setStyle(ButtonStyle.Danger).setEmoji("❌")
                );

                await logsChan.send({ embeds: [staffReviewEmbed], components: [staffActionButtons] });
            }

            return interaction.editReply({ content: "Candidature bien transmise à l'équipe d'administration !" });
        }

        // 4. LOGIQUE DE VALIDATION D'UN CANDIDAT PAR LE STAFF (DEPUIS LE SALON LOGS)
        if (interaction.isButton() && (interaction.customId.startsWith("accept_candidate_") || interaction.customId.startsWith("reject_candidate_"))) {
            const isAccept = interaction.customId.startsWith("accept_candidate_");
            const targetChannelId = interaction.customId.split("_").pop();
            const targetChannel = await interaction.guild.channels.fetch(targetChannelId).catch(() => null);

            // Vérification des droits staff
            const requiredRoles = config.ROLES.joueur;
            const hasRole = interaction.member.roles.cache.some(r => requiredRoles.includes(r.id));
            if (!hasRole && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                return interaction.reply({ content: "❌ Tu n'as pas le rôle requis pour valider cette candidature.", ephemeral: true });
            }

            const data = ticketData.get(targetChannelId);
            if (!data) return interaction.reply({ content: "❌ Impossible de retrouver les données associées à cette candidature.", ephemeral: true });

            const candidateMember = await interaction.guild.members.fetch(data.candidateId).catch(() => null);

            if (isAccept) {
                // Attribution du rôle de PR
                if (candidateMember && data.assignedRole) {
                    await candidateMember.roles.add(data.assignedRole).catch(() => null);
                    // Changement de pseudo : "HVX " + son pseudo original
                    const currentNickname = candidateMember.displayName;
                    if (!currentNickname.startsWith("HVX")) {
                        await candidateMember.setNickname(`HVX ${currentNickname.substring(0, 28)}`).catch(() => null);
                    }
                }

                // Notification en DM du joueur
                if (candidateMember) {
                    await candidateMember.send({
                        embeds: [new EmbedBuilder().setColor("Green").setTitle("🎉 Félicitations !").setDescription(`Ta candidature au sein de la structure HoveX a été **Acceptée** !\nLe rôle <@&${data.assignedRole}> t'a été attribué.`)]
                    }).catch(() => null);
                }

                // Suite dans son salon ticket : Phase des questions de suivi
                if (targetChannel) {
                    ticketData.set(targetChannelId, { ...data, step: "questionnaire_1" });
                    
                    const followUpEmbed = new EmbedBuilder()
                        .setColor("Green")
                        .setTitle("✅ Candidature Validée !")
                        .setDescription(`Félicitations <@${data.candidateId}>, tu as été retenu. Ton rôle a été assigné.\n\n**Question :** As-tu besoin d'aide supplémentaire concernant ce rôle ?`);

                    const helpButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("help_yes").setLabel("Oui").setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId("help_no").setLabel("Non").setStyle(ButtonStyle.Secondary)
                    );

                    await targetChannel.send({ content: `<@${data.candidateId}>`, embeds: [followUpEmbed], components: [helpButtons] });
                }

                await interaction.reply({ content: `✅ Candidature de <@${data.candidateId}> acceptée avec succès !`, ephemeral: true });
            } else {
                // Traitement d'un Refus
                if (candidateMember) {
                    await candidateMember.send({
                        embeds: [new EmbedBuilder().setColor("Red").setTitle("❌ Candidature Refusée").setDescription("Malheureusement, ton profil ne correspond pas à nos critères actuels pour intégrer la structure.")]
                    }).catch(() => null);
                }

                if (targetChannel) {
                    await targetChannel.send({ content: "❌ Ta candidature a été refusée par l'équipe de gestion. Ce ticket va être clôturé." });
                    setTimeout(() => targetChannel.delete().catch(() => {}), 5000);
                }

                await interaction.reply({ content: `❌ Candidature de <@${data.candidateId}> refusée.`, ephemeral: true });
            }

            // Désactivation des boutons du message de log d'origine
            await interaction.message.edit({ components: [] }).catch(() => null);
        }

        // 5. ENCHAÎNEMENT DU QUESTIONNAIRE DE SUIVI DANS LE TICKET JOUEUR
        if (interaction.isButton() && ["help_yes", "help_no", "struct_yes", "struct_no"].includes(interaction.customId)) {
            const data = ticketData.get(interaction.channel.id);
            if (!data || interaction.user.id !== data.candidateId) {
                return interaction.reply({ content: "❌ Seul le candidat concerné peut répondre.", ephemeral: true });
            }

            await interaction.deferUpdate();

            // Étape 1 : Aide sur le rôle ?
            if (interaction.customId === "help_yes" || interaction.customId === "help_no") {
                const nextEmbed = new EmbedBuilder()
                    .setColor("#34495e")
                    .setTitle("❓ Deuxième question")
                    .setDescription("As-tu des questions spécifiques concernant notre structure (HoveX) ?");

                const structButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("struct_yes").setLabel("Oui").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId("struct_no").setLabel("Non").setStyle(ButtonStyle.Secondary)
                );

                await interaction.channel.send({ embeds: [nextEmbed], components: [structButtons] });
            }

            // Étape 2 : Des questions sur la structure ?
            if (interaction.customId === "struct_no") {
                // Pas de question -> Fermeture / Suppression immédiate
                await interaction.channel.send({ content: "🏁 Pas d'autres questions. Merci à toi ! Clôture du ticket..." });
                
                // Archivage textuel
                await archiveTicketChannel(interaction.channel, client);
                
                setTimeout(() => {
                    cooldown.delete(data.candidateId);
                    interaction.channel.delete().catch(() => {});
                }, 4000);
            }

            if (interaction.customId === "struct_yes") {
                // Sélection du nombre de questions
                const countEmbed = new EmbedBuilder()
                    .setColor("#2ecc71")
                    .setTitle("💬 Combien de questions as-tu à nous poser ?")
                    .setDescription("Sélectionne le nombre ci-dessous pour ouvrir le fil de discussion :");

                const menuCount = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("question_count_select")
                        .setPlaceholder("Nombre de questions...")
                        .addOptions([
                            { label: "1 Question", value: "1" },
                            { label: "2 Questions", value: "2" },
                            { label: "3 Questions ou plus", value: "3" }
                        ])
                );
                await interaction.channel.send({ embeds: [countEmbed], components: [menuCount] });
            }
        }

        // Étape 3 : Traitement du choix du nombre de questions
        if (interaction.isStringSelectMenu() && interaction.customId === "question_count_select") {
            const data = ticketData.get(interaction.channel.id);
            if (!data || interaction.user.id !== data.candidateId) {
                return interaction.reply({ content: "❌ Non autorisé.", ephemeral: true });
            }

            const nbr = interaction.values[0];
            await interaction.reply({ content: `✍️ Tu as choisi de poser **${nbr}** question(s). Écris-la/les ci-dessous. Un staff va se charger de te répondre.`, ephemeral: false });

            // Alerte dans les logs pour prévenir qu'une question attend le staff
            const logsChan = await client.channels.fetch(LOGS_CHANNEL).catch(() => null);
            if (logsChan) {
                logsChan.send({
                    embeds: [new EmbedBuilder().setColor("Orange").setTitle("❓ Question en attente").setDescription(`Le joueur ${interaction.user} attend un staff dans son ticket ${interaction.channel} pour répondre à ses questions.`)]
                });
            }
        }

        // 6. FILTRAGE SELECT AUDIOVISUEL
        if (interaction.isStringSelectMenu() && interaction.customId === "audio_select") {
            const choice = interaction.values[0];
            await interaction.reply({ content: `🎨 Tu as sélectionné la spécialité : **${choice.toUpperCase()}**. Un responsable va te prendre en charge pour analyser tes travaux / portfolio.`, ephemeral: false });
        }

        // =====================================================
        // CONTROLES GENERAUX DES SYSTEMES (CLAIM, CLOSE, DELETE)
        // =====================================================

        // 🛡️ ACCÈS CLAIM 
        if (interaction.isButton() && interaction.customId === "claim") {
            const data = ticketData.get(interaction.channel.id);
            const ticketType = data ? data.type : "autre";
            const allowedRoles = config.ROLES[ticketType] || [];

            const isStaff = interaction.member.roles.cache.some(r => allowedRoles.includes(r.id)) || interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels);

            if (!isStaff) return interaction.reply({ content: "❌ Seuls les membres du staff assignés à cette catégorie peuvent claim.", ephemeral: true });

            return interaction.reply({ content: `📌 Ce ticket est désormais pris en charge par ${interaction.user}.` });
        }

        // 🔒 ACCÈS CLOSE (Retire la visibilité au membre d'origine)
        if (interaction.isButton() && interaction.customId === "close") {
            const data = ticketData.get(interaction.channel.id);
            const ticketType = data ? data.type : "autre";
            const allowedRoles = config.ROLES[ticketType] || [];

            const isStaff = interaction.member.roles.cache.some(r => allowedRoles.includes(r.id)) || interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels);

            if (!isStaff) return interaction.reply({ content: "❌ Droits staff insuffisants pour exécuter cette commande.", ephemeral: true });

            if (data && data.creatorId) {
                await interaction.channel.permissionOverwrites.edit(data.creatorId, { ViewChannel: false }).catch(() => null);
            }
            return interaction.reply({ content: "🔒 Le ticket a été masqué pour l'utilisateur. Seul le staff y a encore accès." });
        }

        // 🗑️ ACCÈS SUPPRESSION UNIQUE AVEC EXCLUSIVITÉ ARCHIVAGE
        if (interaction.isButton() && interaction.customId === "delete") {
            const data = ticketData.get(interaction.channel.id);
            const ticketType = data ? data.type : "autre";
            const allowedRoles = config.ROLES[ticketType] || [];

            const isStaff = interaction.member.roles.cache.some(r => allowedRoles.includes(r.id)) || interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels);

            if (!isStaff) return interaction.reply({ content: "❌ Droits staff insuffisants.", ephemeral: true });

            await interaction.reply({ content: "🗑️ Archivage et suppression imminente..." });

            // Exécution de l'archivage avant destruction physique du salon
            await archiveTicketChannel(interaction.channel, client);

            setTimeout(() => {
                if (data && data.creatorId) cooldown.delete(data.creatorId);
                interaction.channel.delete().catch(() => {});
            }, 3000);
        }
    });
};

// =====================================================
// FONCTION COMPLÈTE D'ARCHIVAGE TEXTUELLE AUTO-SUPPRIMABLE
// =====================================================
async function archiveTicketChannel(channel, client) {
    try {
        const messages = await channel.messages.fetch({ limit: 100 });
        let txtOutput = `--- ARCHIVE LOGS DU TICKET : ${channel.name} ---\n\n`;

        const sortedMessages = messages.reverse();
        sortedMessages.forEach(msg => {
            txtOutput += `[${msg.createdAt.toLocaleString()}] ${msg.author.tag}: ${msg.content}\n`;
        });

        const archiveChan = await client.channels.fetch(ARCHIVE_CHANNEL).catch(() => null);
        if (archiveChan) {
            const buffer = Buffer.from(txtOutput, "utf-8");
            
            // Envoi du fichier texte brut
            const archiveMsg = await archiveChan.send({
                content: `📁 Archive complète du ticket \`${channel.name}\` exécutée. Ce fichier texte s'autodétruira dans 1 heure.`,
                files: [{ attachment: buffer, name: `archive-${channel.name}.txt` }]
            });

            // Auto-suppression programmée au bout d'une heure (3600000 ms)
            setTimeout(() => {
                archiveMsg.delete().catch(() => {});
            }, 3600000);
        }
    } catch (err) {
        console.error("Erreur lors de la génération de l'archive :", err);
    }
}
