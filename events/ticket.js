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
    TextInputStyle,
    AttachmentBuilder
} = require("discord.js");

const fs = require("fs");
const path = require("path");
const config = require("../data/ticketConfig");

// Identifiants des salons système
const LOGS_CHANNEL = "1521923500439240968";
const ARCHIVE_CHANNEL = "1521923533272256773";
const AVIS_CHANNEL = "1521923443006898237"; 

// Base de données locale (Anti-Crash & Statistiques / Blacklist)
const DB_PATH = path.join(__dirname, "../data/ticket_database.json");
if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({ tickets: {}, blacklist: [], stats: {} }, null, 4));

function readDB() { return JSON.parse(fs.readFileSync(DB_PATH, "utf-8")); }
function writeDB(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 4), "utf-8"); }

const globalCooldowns = new Set();

module.exports = async (client) => {

    console.log("[🎫 TICKET SYSTEM] Chargement de la configuration Premium Aeroz Esports...");

    // =====================================================
    // 1. CRÉATION / SYNC DU PANEL PRINCIPAL
    // =====================================================
    const panelChannel = await client.channels.fetch(config.PANEL_CHANNEL).catch(() => null);
    if (panelChannel) {
        const cachedMessages = await panelChannel.messages.fetch({ limit: 10 }).catch(() => null);
        if (cachedMessages) {
            const botMessages = cachedMessages.filter(m => m.author.id === client.user.id);
            for (const msg of botMessages.values()) await msg.delete().catch(() => {});
        }

        const panelEmbed = new EmbedBuilder()
            .setColor("#ffb347")
            .setTitle("🎫 Aeroz Esports — Centre de Support")
            .setDescription("Sélectionnez la catégorie adaptée à votre demande pour ouvrir un accès privé :\n\n🛡️ **Staff** (Recrutement Modération)\n🎮 **Joueur (PR & Rôles Compétitifs)**\n🎬 **Audiovisuel** (Design, Vidéo, Mapping)\n🆘 **Assistance / Aide**\n🤝 **Partenariat / Projets**")
            .setFooter({ text: "Aeroz Automations • Cliquez ci-dessous" });

        const menuSelection = new StringSelectMenuBuilder()
            .setCustomId("ticket_select")
            .setPlaceholder("Sélectionnez votre catégorie...")
            .addOptions([
                { label: "Recrutement Staff", value: "staff", emoji: "🛡️" },
                { label: "Pôle Joueur & Rôles", value: "joueur", emoji: "🎮" },
                { label: "Pôle Audiovisuel", value: "audiovisuel", emoji: "🎬" },
                { label: "Assistance Générale", value: "aide", emoji: "🆘" },
                { label: "Partenariats", value: "partenariat", emoji: "🤝" }
            ]);

        await panelChannel.send({
            embeds: [panelEmbed],
            components: [new ActionRowBuilder().addComponents(menuSelection)]
        }).catch(() => {});
    }

    // =====================================================
    // 2. ÉVÉNEMENT MESSAGE (PRÉFIXE + & RYTHME D'ACTIVITÉ)
    // =====================================================
    client.on("messageCreate", async (message) => {
        if (message.author.bot || !message.guild) return;

        const db = readDB();
        if (db.tickets[message.channel.id]) {
            db.tickets[message.channel.id].lastActivity = Date.now();
            db.tickets[message.channel.id].messageCount = (db.tickets[message.channel.id].messageCount || 0) + 1;
            writeDB(db);
        }

        if (message.content.startsWith("+test modérateur")) {
            const allowedRoles = config.ROLES.staff || [];
            const isStaff = message.member.roles.cache.some(r => allowedRoles.includes(r.id)) || message.member.permissions.has(PermissionsBitField.Flags.ManageChannels);
            if (!isStaff) return message.reply("❌ Action réservée à la direction.");

            const targetUser = message.mentions.members.first();
            if (!targetUser) return message.reply("❌ Veuillez mentionner le modérateur en test.");

            await targetUser.roles.add(config.TEST_MODO_ROLE).catch(() => {});
            await message.channel.permissionOverwrites.edit(targetUser.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }).catch(() => {});

            return message.reply({ embeds: [new EmbedBuilder().setColor("#3498db").setTitle("🛡️ ÉVALUATION STAFF").setDescription(`Bienvenue ${targetUser} dans votre salon de test.`)] });
        }
    });

    // =====================================================
    // 3. GESTIONNAIRE GLOBAL DES INTERACTIONS
    // =====================================================
    client.on("interactionCreate", async (i) => {
        if (!i.guild) {
            const db = readDB();

            if (i.isButton() && i.customId.startsWith("rate_")) {
                const parts = i.customId.split("_");
                const stars = parts[1];
                const staffId = parts[2];

                const modal = new ModalBuilder().setCustomId(`submit_review_${stars}_${staffId}`).setTitle("Votre avis sur Aeroz Esports");
                modal.addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId("comment").setLabel("Rédigez votre commentaire de satisfaction").setStyle(TextInputStyle.Paragraph).setRequired(true)
                ));
                return i.showModal(modal);
            }

            if (i.isModalSubmit() && i.customId.startsWith("submit_review_")) {
                await i.deferReply();
                const parts = i.customId.split("_");
                const stars = parseInt(parts[2]);
                const staffId = parts[3];
                const comment = i.fields.getTextInputValue("comment");

                const starsVisual = "⭐".repeat(stars);
                const reviewEmbed = new EmbedBuilder()
                    .setColor(stars >= 4 ? "Gold" : "Orange")
                    .setTitle("📝 Nouvel Avis Support — Aeroz Esports")
                    .addFields(
                        { name: "Staff Évalué", value: `<@${staffId}> (\`${staffId}\`)`, inline: true },
                        { name: "Note globale", value: `${starsVisual} (${stars}/5)`, inline: true },
                        { name: "Auteur de l'avis", value: `${i.user} (\`${i.user.id}\`)`, inline: false },
                        { name: "Commentaire", value: comment }
                    )
                    .setTimestamp();

                if (!db.stats[staffId]) db.stats[staffId] = { closedTickets: 0, reviews: [] };
                db.stats[staffId].reviews.push(stars);
                writeDB(db);

                const guildInstance = client.guilds.cache.first();
                if (guildInstance) {
                    const reviewLogs = await guildInstance.channels.fetch(AVIS_CHANNEL).catch(() => null);
                    if (reviewLogs) await reviewLogs.send({ embeds: [reviewEmbed] });
                }

                return i.editReply({ content: "✅ Merci beaucoup ! Votre évaluation a bien été transmise à la direction de Aeroz Esports." });
            }
            return;
        }

        if (i.isButton() || i.isStringSelectMenu()) {
            const cooldownKey = `${i.user.id}-${i.customId}`;
            if (globalCooldowns.has(cooldownKey)) return i.reply({ content: "⏳ Action trop rapide, veuillez patienter.", ephemeral: true });
            globalCooldowns.add(cooldownKey);
            setTimeout(() => globalCooldowns.delete(cooldownKey), 1200);
        }

        const db = readDB();
        const context = db.tickets[i.channel.id];

        // --- A. SYSTÈME D'OUVERTURE DE TICKET ---
        if (i.isStringSelectMenu() && i.customId === "ticket_select") {
            const type = i.values[0];
            if (db.blacklist.includes(i.user.id)) return i.reply({ content: "❌ Vous êtes banni du système de support.", ephemeral: true });

            const hasActiveTicket = Object.values(db.tickets).some(t => t.userId === i.user.id && t.status === "open");
            if (hasActiveTicket) return i.reply({ content: "⏳ Vous possédez déjà un ticket ouvert.", ephemeral: true });

            const categoryId = config.CATEGORIES[type];
            const basePermissions = [
                { id: i.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
            ];

            (config.ROLES[type] || []).forEach(rId => {
                basePermissions.push({ id: rId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] });
            });

            const ticketChannel = await i.guild.channels.create({
                name: `${type}-${i.user.username}`,
                type: ChannelType.GuildText,
                parent: categoryId || null,
                permissionOverwrites: basePermissions
            });

            db.tickets[ticketChannel.id] = { userId: i.user.id, username: i.user.username, type: type, createdAt: Date.now(), lastActivity: Date.now(), messageCount: 0, status: "open", claimedBy: null, detectedPole: null };
            writeDB(db);

            const actionButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("claim").setLabel("Prendre en charge").setStyle(ButtonStyle.Primary).setEmoji("📌"),
                new ButtonBuilder().setCustomId("close").setLabel("Fermer").setStyle(ButtonStyle.Secondary).setEmoji("🔒"),
                new ButtonBuilder().setCustomId("delete").setLabel("Supprimer").setStyle(ButtonStyle.Danger).setEmoji("🗑️"),
                new ButtonBuilder().setCustomId("blacklist_user").setLabel("Blacklist").setStyle(ButtonStyle.Danger).setEmoji("⛔")
            );

            const utilityButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("ticket_add_user").setLabel("Ajouter").setStyle(ButtonStyle.Secondary).setEmoji("➕"),
                new ButtonBuilder().setCustomId("ticket_remove_user").setLabel("Retirer").setStyle(ButtonStyle.Secondary).setEmoji("➖"),
                new ButtonBuilder().setCustomId("ticket_create_voice").setLabel("Salon Vocal").setStyle(ButtonStyle.Success).setEmoji("🔊")
            );

            let mainEmbed = new EmbedBuilder().setColor("#ffb347").setTitle(`🎫 Espace de Support ${type.toUpperCase()}`);
            const infoEmbed = new EmbedBuilder().setColor("#2f3136").setDescription(`👤 **Demandeur :** ${i.user} (\`${i.user.id}\`)`);

            if (type === "joueur") {
                mainEmbed.setDescription("Bienvenue dans l'espace Joueurs de Aeroz Esports.\n\nMerci de cliquer sur le bouton vert ci-dessous pour soumettre vos PR et démarrer votre processus d'intégration.");
                actionButtons.addComponents(new ButtonBuilder().setCustomId("form_joueur").setLabel("Remplir Formulaire").setStyle(ButtonStyle.Success).setEmoji("🧾"));
                await ticketChannel.send({ content: `<@${i.user.id}>`, embeds: [mainEmbed, infoEmbed], components: [actionButtons, utilityButtons] });
            } 
            else if (type === "staff") {
                mainEmbed.setDescription("Espace Recrutement Équipe Support / Modération.\n\nMerci de cliquer sur le bouton bleu ci-dessous pour démarrer votre formulaire de candidature.");
                actionButtons.addComponents(new ButtonBuilder().setCustomId("form_staff").setLabel("Dossier Recrutement").setStyle(ButtonStyle.Primary).setEmoji("🛡️"));
                await ticketChannel.send({ content: `<@${i.user.id}>`, embeds: [mainEmbed, infoEmbed], components: [actionButtons, utilityButtons] });
            } 
            else if (type === "audiovisuel") {
                mainEmbed.setDescription("Espace de Candidature Pôle Audiovisuel.\n\nVeuillez choisir votre spécialité dans le menu déroulant ci-dessous :");
                const audioMenu = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("audio_form_select")
                        .setPlaceholder("Choisissez votre branche d'activité...")
                        .addOptions([
                            { label: "Monteur Vidéo", value: "monteur", emoji: "🎥" },
                            { label: "Graphiste / Designer", value: "graphiste", emoji: "🎨" },
                            { label: "Mapper", value: "mapper", emoji: "🗺️" }
                        ])
                );
                await ticketChannel.send({ content: `<@${i.user.id}>`, embeds: [mainEmbed, infoEmbed], components: [actionButtons, utilityButtons] });
                await ticketChannel.send({ components: [audioMenu] });
            } else {
                mainEmbed.setDescription(`Bonjour ${i.user}, un responsable de la structure va vous prendre en charge. Expliquez votre demande.`);
                await ticketChannel.send({ content: `<@${i.user.id}>`, embeds: [mainEmbed, infoEmbed], components: [actionButtons, utilityButtons] });
            }

            return i.reply({ content: `✅ Votre salon privé a été initialisé : ${ticketChannel}`, ephemeral: true });
        }

        // --- B. TRAITEMENT DU FORMULAIRE PR JOUEUR ---
        if (i.isButton() && i.customId === "form_joueur") {
            if (!context || context.userId !== i.user.id) return i.reply({ content: "❌ Seul le propriétaire du ticket peut interagir.", ephemeral: true });
            const modal = new ModalBuilder().setCustomId("joueur_modal_submit").setTitle("Recrutement Joueur Aeroz");
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("epic").setLabel("Pseudo Epic Games").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("age").setLabel("Âge").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("pr").setLabel("Points PR (Fortnite Tracker)").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("platform").setLabel("Plateforme (PC/PS5/Xbox)").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("motivation").setLabel("Vos objectifs au sein de Aeroz Esports ?").setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
            return i.showModal(modal);
        }

        if (i.isModalSubmit() && i.customId === "joueur_modal_submit") {
            await i.deferReply({ ephemeral: true });
            const epic = i.fields.getTextInputValue("epic");
            const prValue = parseInt(i.fields.getTextInputValue("pr").replace(/\s/g, "")) || 0;

            let finalRole = config.PR_ROLES[0].role;
            let roleName = config.PR_ROLES[0].name;
            let poleType = "grinder"; 

            for (const item of config.PR_ROLES) {
                if (prValue >= item.min && prValue < item.max) { 
                    finalRole = item.role; 
                    roleName = item.name; 
                    if (item.name.toLowerCase().includes("espoir")) poleType = "espoir";
                    if (item.name.toLowerCase().includes("académie") || item.name.toLowerCase().includes("officiel")) poleType = "contrat";
                    break; 
                }
            }

            db.tickets[i.channel.id].detectedPole = poleType;
            writeDB(db);

            const currentName = i.member.displayName;
            if (!currentName.startsWith("AZ")) await i.member.setNickname(`AZ ${currentName.substring(0, 25)}`).catch(() => {});
            await i.channel.setName(`az-${epic}`).catch(() => {});

            const logChannel = await i.guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
            if (logChannel) {
                const logEmbed = new EmbedBuilder().setColor("Green").setTitle("📊 Profil Enregistré").setDescription(`Le joueur ${i.user} a complété son formulaire.`)
                    .addFields({ name: "Epic", value: epic, inline: true }, { name: "Score PR", value: `${prValue} PR`, inline: true }, { name: "Grade Calculé", value: `${roleName}` });
                await logChannel.send({ embeds: [logEmbed] });
            }

            if (poleType === "contrat") {
                const embedContrat = new EmbedBuilder()
                    .setColor("#e74c3c")
                    .setTitle("📜 PÔLES OFFICIEL & ACADÉMIE (SOUS CONTRAT)")
                    .setDescription(`Félicitations ${i.user}, votre nombre de PR (${prValue} PR) correspond à nos critères pour intégrer nos **pôles sous contrat** !\n\n⚠️ **Procédure de vérification obligatoire :**\nCes grades ne sont pas attribués automatiquement car ils nécessitent une signature. Un membre du Staff / de la Direction va arriver dans les minutes à suivre pour analyser de façon stricte votre dossier et valider votre Tracker.\n\n*Veuillez patienter s'il vous plaît.*`);
                
                await i.channel.send({ content: "@here", embeds: [embedContrat] });
                return i.editReply({ content: "Formulaire envoyé ! Un staff arrive." });
            }

            await i.member.roles.add(finalRole).catch(() => {});

            const infoRequestEmbed = new EmbedBuilder()
                .setColor("#3498db")
                .setTitle("🏆 Rôle Assigné avec succès !")
                .setDescription(`Félicitations, vous viens d'obtenir le grade **${roleName}** par rapport à vos statistiques.\n\n**Souhaitez-vous obtenir les informations et la fiche technique complète concernant ce rôle ?**`);

            const rowInfoButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("ask_fiche_yes").setLabel("Oui, je veux voir la fiche").setStyle(ButtonStyle.Primary).setEmoji("🧾"),
                new ButtonBuilder().setCustomId("ask_fiche_no").setLabel("Non, pas besoin").setStyle(ButtonStyle.Secondary)
            );

            await i.channel.send({ content: `<@${i.user.id}>`, embeds: [infoRequestEmbed], components: [rowInfoButtons] });
            return i.editReply({ content: "Rôle attribué !" });
        }

        // --- C. ROUTAGE DYNAMIQUE DES QUESTIONS (GRINDER / ESPOIR) ---
        if (i.isButton() && ["ask_fiche_yes", "ask_fiche_no", "more_questions_yes", "more_questions_no"].includes(i.customId)) {
            if (!context || i.user.id !== context.userId) return i.reply({ content: "❌ Réservé à l'auteur du ticket.", ephemeral: true });
            await i.deferUpdate();

            const pole = context.detectedPole || "grinder";

            if (i.customId === "ask_fiche_yes") {
                const embedFiche = new EmbedBuilder().setTimestamp();

                if (pole === "grinder") {
                    embedFiche.setColor("#3498db")
                        .setTitle("🏅 FICHE TECHNIQUE : PÔLE GRINDER")
                        .setDescription("Le pôle Grinder est destiné aux joueurs souhaitant grind sérieusement sous les couleurs de Aeroz Esports.\n\n**L’objectif principal** est de représenter activement la structure à travers votre activité, votre progression et votre présence au sein de la communauté.\n\n**Les joueurs grinders doivent principalement :**\n• Publier régulièrement du contenu lié à leur progression\n• Être actifs sur le serveur Discord\n• Représenter correctement Aeroz Esports\n• Être investis dans leur grind et leurs objectifs\n• Garder une bonne mentalité et un comportement sérieux\n\n*Plus un joueur montre de l’implication et de la régularité, plus nous pourrons lui proposer des opportunités d’évolution.*\n\nNous mettons également en place différents systèmes de progression afin d’aider les grinders à évoluer.\n\n**Conditions :**\n• Étre âgé d’au minimum 13 ans\n• Respecter le règlement\n• Étre actif et motivé");
                } else if (pole === "espoir") {
                    embedFiche.setColor("#e67e22")
                        .setTitle("⚡ FICHE TECHNIQUE : PÔLE ESPOIR")
                        .setDescription("Le pôle Espoir est conçu pour les joueurs souhaitant progresser dans un cadre plus compétitif.\n\nNous recherchons des joueurs sérieux, actifs et capables de maintenir une bonne image de Aeroz Esports.\n\n**Conditions :**\n• Étre âgé d’au minimum 13 ans\n• Étre régulier et investi\n• Respecter les membres et le staff\n• Avoir un comportement correct et mature");
                }

                await i.channel.send({ embeds: [embedFiche] });

                const rowMoreQuestions = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("more_questions_yes").setLabel("Oui").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId("more_questions_no").setLabel("Non, tout est bon").setStyle(ButtonStyle.Secondary)
                );

                return await i.channel.send({ 
                    embeds: [new EmbedBuilder().setColor("#2c3e50").setDescription("📊 **Avez-vous d'autres questions ou besoin d'une assistance supplémentaire à propos de ce pôle ?**")], 
                    components: [rowMoreQuestions]
                });
            }

            if (i.customId === "ask_fiche_no") {
                const rowMoreQuestions = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("more_questions_yes").setLabel("Oui").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId("more_questions_no").setLabel("Non, tout est bon").setStyle(ButtonStyle.Secondary)
                );

                return await i.channel.send({ 
                    embeds: [new EmbedBuilder().setColor("#2c3e50").setDescription("📊 **Avez-vous d'autres questions pour l'équipe ou pour le Staff ?**")], 
                    components: [rowMoreQuestions]
                });
            }

            if (i.customId === "more_questions_yes") {
                return await i.channel.send({ embeds: [new EmbedBuilder().setColor("#f1c40f").setDescription("💬 Un membre de notre Staff va arriver pour répondre à vos questions. Veuillez les poser ci-dessous en attendant.")] });
            }

            if (i.customId === "more_questions_no") {
                await i.channel.send({ content: "🏁 Procédure terminée. Lancement de la fermeture automatique..." });
                
                const targetUser = await i.guild.members.fetch(context.userId).catch(() => null);
                if (targetUser) {
                    const claimedStaff = context.claimedBy || client.user.id;
                    const reviewRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`rate_5_${claimedStaff}`).setLabel("5 ⭐").setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(`rate_4_${claimedStaff}`).setLabel("4 ⭐").setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId(`rate_3_${claimedStaff}`).setLabel("3 ⭐").setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId(`rate_2_${claimedStaff}`).setLabel("2 ⭐").setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setCustomId(`rate_1_${claimedStaff}`).setLabel("1 ⭐").setStyle(ButtonStyle.Danger)
                    );
                    await targetUser.send({
                        embeds: [new EmbedBuilder().setColor("Gold").setTitle("✨ Votre avis compte — Aeroz Esports").setDescription("Votre ticket vient d'être pris en charge ou validé. Merci de noter l'efficacité et la réponse apportée par notre équipe à l'aide des boutons ci-dessous :")],
                        components: [reviewRow]
                    }).catch(() => {});
                }

                return await generateSystemClose(i.channel, client, context);
            }
        }

        // --- D. STAFF & AUDIOVISUEL SUBMITS ---
        if (i.isButton() && i.customId === "form_staff") {
            if (!context || context.userId !== i.user.id) return i.reply({ content: "❌ Action non autorisée.", ephemeral: true });
            const modal = new ModalBuilder().setCustomId("staff_modal_submit").setTitle("Candidature Équipe Aeroz");
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("age").setLabel("Âge").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("xp").setLabel("Vos anciennes expériences").setStyle(TextInputStyle.Paragraph).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("motivation").setLabel("Vos motivations ?").setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
            return i.showModal(modal);
        }

        if (i.isModalSubmit() && i.customId === "staff_modal_submit") {
            await i.deferReply({ ephemeral: true });
            await i.channel.send({ embeds: [new EmbedBuilder().setColor("Green").setTitle("📝 Candidature Validée").setDescription("Votre dossier a été transmis aux administrateurs de la structure.")] });
            return i.editReply({ content: "Envoi validé !" });
        }

        if (i.isStringSelectMenu() && i.customId === "audio_form_select") {
            if (!context || context.userId !== i.user.id) return i.reply({ content: "❌ Réservé au créateur du ticket.", ephemeral: true });
            const choice = i.values[0];
            const modal = new ModalBuilder().setCustomId(`audio_submit_${choice}`).setTitle(`Recrutement Pôle - ${choice.toUpperCase()}`);
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("portfolio").setLabel("Lien du Portfolio").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("motivation").setLabel("Pourquoi vouloir produire pour Aeroz Esports ?").setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
            return i.showModal(modal);
        }

        if (i.isModalSubmit() && i.customId.startsWith("audio_submit_")) {
            await i.deferReply({ ephemeral: true });
            const specialty = i.customId.split("_").pop();
            const autoRole = config.AUDIO_ROLES[specialty];
            if (autoRole) await i.member.roles.add(autoRole).catch(() => {});

            await i.channel.send({ embeds: [new EmbedBuilder().setColor("Purple").setTitle("🎬 Branche Enregistrée").setDescription(`Le grade associé à la spécialité **${specialty.toUpperCase()}** vous a été attribué.`)] });
            return i.editReply({ content: "Profil mis à jour !" });
        }

        // --- E. ACTIONS DU STAFF SÉCURISÉES ---
        const isStaffUser = i.member.roles.cache.some(r => (config.ROLES[context ? context.type : "autre"] || []).includes(r.id)) || i.member.permissions.has(PermissionsBitField.Flags.ManageChannels);

        if (i.isButton() && ["ticket_add_user", "ticket_remove_user", "ticket_create_voice"].includes(i.customId)) {
            if (!isStaffUser) return i.reply({ content: "❌ Action réservée aux modérateurs.", ephemeral: true });

            if (i.customId === "ticket_add_user" || i.customId === "ticket_remove_user") {
                const modal = new ModalBuilder().setCustomId(`modal_user_${i.customId}`).setTitle("Gestion des permissions");
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("user_id").setLabel("ID Unique du joueur").setStyle(TextInputStyle.Short).setRequired(true)));
                return i.showModal(modal);
            }

            if (i.customId === "ticket_create_voice") {
                await i.deferReply();
                const voiceChannel = await i.guild.channels.create({ name: `🔊 Entretien-${i.channel.name.split("-")[1] || ""}`, type: ChannelType.GuildVoice, parent: i.channel.parentId, permissionOverwrites: i.channel.permissionOverwrites.cache.map(p => p) });
                return i.editReply({ content: `🔊 Salon d'entretien vocal éphémère initialisé : ${voiceChannel}` });
            }
        }

        if (i.isModalSubmit() && i.customId.startsWith("modal_user_")) {
            await i.deferReply({ ephemeral: true });
            const actionType = i.customId.includes("add") ? "add" : "remove";
            const targetId = i.fields.getTextInputValue("user_id");
            const targetMember = await i.guild.members.fetch(targetId).catch(() => null);

            if (!targetMember) return i.editReply({ content: "❌ Cet identifiant n'appartient pas à ce serveur." });

            if (actionType === "add") {
                await i.channel.permissionOverwrites.edit(targetMember.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
                await i.channel.send({ content: `➕ ${targetMember} a été intégré à cet espace privé par le Staff.` });
            } else {
                await i.channel.permissionOverwrites.delete(targetMember.id);
                await i.channel.send({ content: `➖ ${targetMember} a été déconnecté de cet espace.` });
            }
            return i.editReply({ content: "Permissions mises à jour !" });
        }

        // --- F. BOUTONS PANELS DU STAFF (CLAIM, CLOSE, DELETE, BLACKLIST) ---
        if (i.isButton() && ["claim", "close", "delete", "force_close_confirm", "cancel_close", "blacklist_user"].includes(i.customId)) {
            if (!isStaffUser && !["cancel_close"].includes(i.customId)) {
                return i.reply({ content: "❌ Action refusée. Droits de Modération requis.", ephemeral: true });
            }

            if (i.customId === "blacklist_user") {
                if (!context) return i.reply({ content: "❌ Impossible de cibler le créateur.", ephemeral: true });
                await i.reply({ content: "⛔ Application du bannissement du support..." });

                db.blacklist.push(context.userId);
                delete db.tickets[i.channel.id];
                writeDB(db);

                const logChannel = await i.guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
                if (logChannel) {
                    logChannel.send({ embeds: [new EmbedBuilder().setColor("Red").setTitle("⛔ BLACKLIST SUPPORT").setDescription(`L'ID \`${context.userId}\` a été banni définitivement du système par ${i.user}.`)] });
                }

                return setTimeout(() => i.channel.delete().catch(() => {}), 2000);
            }

            if (i.customId === "claim") {
                await i.deferUpdate();
                db.tickets[i.channel.id].claimedBy = i.user.id; 
                
                if (!db.stats[i.user.id]) db.stats[i.user.id] = { closedTickets: 0, reviews: [] };
                db.stats[i.user.id].closedTickets++;
                writeDB(db);

                await i.channel.setName(`📌-${i.channel.name}`).catch(() => {});
                
                const updatedRow = ActionRowBuilder.from(i.message.components[0]);
                updatedRow.components[0] = new ButtonBuilder()
                    .setCustomId("claimed")
                    .setLabel(`Pris en charge par ${i.user.username}`)
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true)
                    .setEmoji("📌");

                await i.message.edit({ components: [updatedRow, i.message.components[1]].filter(Boolean) }).catch(() => {});
                return i.channel.send({ embeds: [new EmbedBuilder().setColor("Green").setDescription(`📌 Le ticket a été pris en charge par ${i.user}.`)] });
            }

            if (i.customId === "close") {
                await i.deferReply();
                const confirmEmbed = new EmbedBuilder().setColor("Orange").setDescription("🔒 **Voulez-vous initier la procédure de fermeture définitive du ticket ?**");
                const rowConfirm = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("force_close_confirm").setLabel("Confirmer").setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId("cancel_close").setLabel("Annuler").setStyle(ButtonStyle.Secondary)
                );
                return i.editReply({ embeds: [confirmEmbed], components: [rowConfirm] });
            }

            if (i.customId === "cancel_close") {
                await i.deferUpdate();
                return i.message.delete().catch(() => {});
            }

            if (i.customId === "force_close_confirm") {
                await i.deferUpdate();
                return await generateSystemClose(i.channel, client, context);
            }

            if (i.customId === "delete") {
                await i.reply({ content: "🗑️ Suppression immédiate du salon en cours..." });
                if (db.tickets[i.channel.id]) {
                    delete db.tickets[i.channel.id];
                    writeDB(db);
                }
                return setTimeout(() => i.channel.delete().catch(() => {}), 1500);
            }
        }
    });
};

// =====================================================
// FONCTION : TRANSCRIPT & ARCHIVAGE DU TICKET
// =====================================================
async function generateSystemClose(channel, client, context) {
    const db = readDB();
    if (db.tickets[channel.id]) {
        db.tickets[channel.id].status = "closed";
        writeDB(db);
    }

    const fetchedMessages = await channel.messages.fetch({ limit: 100 }).catch(() => []);
    let transcriptString = `--- TRANSCRIPT DU TICKET : ${channel.name} ---\nCréé par : ID ${context?.userId || "Inconnu"}\n\n`;
    
    const sortedMessages = [...fetchedMessages.values()].reverse();
    sortedMessages.forEach(msg => {
        transcriptString += `[${new Date(msg.createdAt).toLocaleString("fr-FR")}] ${msg.author.tag}: ${msg.content}\n`;
    });

    const bufferTranscript = Buffer.from(transcriptString, "utf-8");
    const transcriptFile = new AttachmentBuilder(bufferTranscript, { name: `transcript-${channel.name}.txt` });

    const archiveChannel = await client.channels.fetch(ARCHIVE_CHANNEL).catch(() => null);
    if (archiveChannel) {
        const archiveEmbed = new EmbedBuilder()
            .setColor("#2c3e50")
            .setTitle(`📂 Archive Ticket — ${channel.name}`)
            .addFields(
                { name: "Demandeur ID", value: `\`${context?.userId || "Inconnu"}\``, inline: true },
                { name: "Catégorie", value: `${context?.type || "Non définie"}`.toUpperCase(), inline: true },
                { name: "Messages", value: `\`${context?.messageCount || 0}\``, inline: true }
            )
            .setTimestamp();
        await archiveChannel.send({ embeds: [archiveEmbed], files: [transcriptFile] }).catch(() => {});
    }

    const logChannel = await client.channels.fetch(LOGS_CHANNEL).catch(() => null);
    if (logChannel) {
        logChannel.send({ embeds: [new EmbedBuilder().setColor("Grey").setDescription(`🔒 Le salon textuel \`${channel.name}\` a été fermé et archivé.`)] });
    }

    if (db.tickets[channel.id]) {
        delete db.tickets[channel.id];
        writeDB(db);
    }

    return setTimeout(() => channel.delete().catch(() => {}), 3000);
}
