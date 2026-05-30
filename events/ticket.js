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
const LOGS_CHANNEL = "1508157026491175002";
const ARCHIVE_CHANNEL = "1510019228047114300";
const AVIS_CHANNEL = "1510250586703003708"; 

// Base de données locale (Anti-Crash & Statistiques / Blacklist)
const DB_PATH = path.join(__dirname, "../data/ticket_database.json");
if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({ tickets: {}, blacklist: [], stats: {} }, null, 4));

function readDB() { return JSON.parse(fs.readFileSync(DB_PATH, "utf-8")); }
function writeDB(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 4), "utf-8"); }

const globalCooldowns = new Set();

module.exports = async (client) => {

    console.log("[🎫 TICKET SYSTEM] Chargement de la configuration Pyxar Premium...");

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
            .setTitle("🎫 Team Pyxar — Centre de Support")
            .setDescription("Sélectionnez la catégorie adaptée à votre demande pour ouvrir un accès privé :\n\n🛡️ **Staff** (Recrutement Modération)\n🎮 **Joueur (PR / Renseignements Rôles)**\n🎬 **Audiovisuel** (Design, Vidéo, Mapping)\n🆘 **Assistance / Aide**\n🤝 **Partenariat / Projets**")
            .setFooter({ text: "Pyxar Automations • Cliquez ci-dessous" });

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
        if (!i.guild) return;

        if (i.isButton() || i.isStringSelectMenu()) {
            const cooldownKey = `${i.user.id}-${i.customId}`;
            if (globalCooldowns.has(cooldownKey)) return i.reply({ content: "⏳ Action trop rapide, veuillez patienter.", ephemeral: true });
            globalCooldowns.add(cooldownKey);
            setTimeout(() => globalCooldowns.delete(cooldownKey), 1200);
        }

        const db = readDB();

        // --- A. SYSTÈME D'OUVERTURE ---
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

            db.tickets[ticketChannel.id] = { userId: i.user.id, username: i.user.username, type: type, createdAt: Date.now(), lastActivity: Date.now(), messageCount: 0, status: "open", claimedBy: null };
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
                mainEmbed.setDescription("Bienvenue dans l'espace Joueurs de Team Pyxar.\n\n• Pour intégrer nos grades automatiquement via vos PR, cliquez sur **Remplir Formulaire**.\n• Pour obtenir des fiches d'informations sur nos rôles et sections compétitives, utilisez le menu ci-dessous.");
                
                actionButtons.addComponents(new ButtonBuilder().setCustomId("form_joueur").setLabel("Remplir Formulaire").setStyle(ButtonStyle.Success).setEmoji("🧾"));
                
                const roleMenuRow = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("info_roles_select")
                        .setPlaceholder("Se renseigner sur un rôle / pôle...")
                        .addOptions([
                            { label: "Pôle Grinder", value: "info_grinder", emoji: "🏅" },
                            { label: "Pôle Espoir", value: "info_espoir", emoji: "⚡" },
                            { label: "Pôles Officiel & Académie (Contrats)", value: "info_contrat", emoji: "📜" }
                        ])
                );

                await ticketChannel.send({ content: `<@${i.user.id}>`, embeds: [mainEmbed, infoEmbed], components: [actionButtons, utilityButtons] });
                await ticketChannel.send({ components: [roleMenuRow] });
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

        const context = db.tickets[i.channel.id];

        // --- B. MENUS INTERACTIFS DE RENSEIGNEMENT SUR LES RÔLES ---
        if (i.isStringSelectMenu() && i.customId === "info_roles_select") {
            await i.deferUpdate();
            const choice = i.values[0];
            const embedInfo = new EmbedBuilder().setTimestamp();

            if (choice === "info_grinder") {
                embedInfo.setColor("#3498db")
                    .setTitle("🏅 FICHE TECHNIQUE : PÔLE GRINDER")
                    .setDescription("Le pôle Grinder est destiné aux joueurs souhaitant grind sérieusement sous les couleurs de Team Pyxar.\n\n**Objectif Principal :** Représenter activement la structure à travers votre activité, votre progression et votre présence au sein de la communauté.\n\n**Vos Missions Principales :**\n• Publier régulièrement du contenu lié à votre progression\n• Être actifs sur le serveur Discord\n• Représenter correctement Team Pyxar\n• Être investis dans votre grind et vos objectifs\n• Garder une bonne mentalité et un comportement sérieux\n\n*Plus un joueur montre de l’implication et de la régularité, plus nous pourrons lui proposer des opportunités d’évolution.*\n\n**Conditions requises :**\n• Être âgé d’au minimum 13 ans\n• Respecter le règlement\n• Être actif et motivé");
            } 
            else if (choice === "info_espoir") {
                embedInfo.setColor("#e67e22")
                    .setTitle("⚡ FICHE TECHNIQUE : PÔLE ESPOIR")
                    .setDescription("Le pôle Espoir est conçu pour les joueurs souhaitant progresser dans un cadre plus compétitif.\n\nNous recherchons des joueurs sérieux, actifs et capables de maintenir une bonne image de Team Pyxar.\n\n**Conditions requises :**\n• Être âgé d’au minimum 13 ans\n• Être régulier et investi\n• Respecter les membres et le staff\n• Avoir un comportement correct et mature");
            } 
            else if (choice === "info_contrat") {
                embedInfo.setColor("#e74c3c")
                    .setTitle("📜 PÔLES OFFICIEL & ACADÉMIE (SOUS CONTRAT)")
                    .setDescription("⚠️ **Avis important :** Les rôles **Officiel** et **Académie** ne s'obtiennent pas de manière automatisée.\n\nCes grades impliquent une intégration officielle au sein de la structure avec signature de **CONTRAT**.\n\n**Procédure :**\nUn membre de la direction / du Staff va venir analyser manuellement votre dossier dans ce ticket afin de vérifier de façon stricte votre historique de jeu ainsi que votre **nombre exact de PR** sur Fortnite Tracker. Toute triche ou anomalie entraînera un refus immédiat.\n\n*Veuillez patienter pendant qu'un responsable prend en charge votre dossier.*");
            }

            return i.channel.send({ embeds: [embedInfo] });
        }

        // --- C. FORMULAIRES ET SUBMITS ---
        if (i.isButton() && i.customId === "form_joueur") {
            if (!context || context.userId !== i.user.id) return i.reply({ content: "❌ Seul le propriétaire du ticket peut interagir.", ephemeral: true });
            const modal = new ModalBuilder().setCustomId("joueur_modal_submit").setTitle("Recrutement Joueur Pyxar");
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("epic").setLabel("Pseudo Epic Games").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("age").setLabel("Âge").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("pr").setLabel("Points PR (Fortnite Tracker)").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("platform").setLabel("Plateforme (PC/PS5/Xbox)").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("motivation").setLabel("Vos objectifs au sein de Pyxar ?").setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
            return i.showModal(modal);
        }

        if (i.isModalSubmit() && i.customId === "joueur_modal_submit") {
            await i.deferReply({ ephemeral: true });
            const epic = i.fields.getTextInputValue("epic");
            const prValue = parseInt(i.fields.getTextInputValue("pr").replace(/\s/g, "")) || 0;

            let finalRole = config.PR_ROLES[0].role;
            let roleName = config.PR_ROLES[0].name;
            for (const item of config.PR_ROLES) {
                if (prValue >= item.min && prValue < item.max) { finalRole = item.role; roleName = item.name; break; }
            }

            await i.member.roles.add(finalRole).catch(() => {});
            const currentName = i.member.displayName;
            if (!currentName.startsWith("PX")) await i.member.setNickname(`PX ${currentName.substring(0, 25)}`).catch(() => {});
            await i.channel.setName(`px-${epic}`).catch(() => {});

            const logChannel = await i.guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
            if (logChannel) {
                const logEmbed = new EmbedBuilder().setColor("Green").setTitle("📊 Profil Enregistré").setDescription(`Le joueur ${i.user} a complété son formulaire.`)
                    .addFields({ name: "Epic", value: epic, inline: true }, { name: "Score PR", value: `${prValue} PR`, inline: true }, { name: "Grade attribué", value: `<@&${finalRole}> (${roleName})` });
                await logChannel.send({ embeds: [logEmbed] });
            }

            const followUpEmbed = new EmbedBuilder().setColor("Green").setTitle("🏆 Statut Assigné !").setDescription(`Vos statistiques sont synchronisées. Vous possédez le grade **${roleName}**.\n\nAvez-vous besoin d'une autre assistance technique ?`);
            const helpRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("follow_help_yes").setLabel("Oui").setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId("follow_help_no").setLabel("Non, tout est bon").setStyle(ButtonStyle.Secondary));
            await i.channel.send({ content: `<@${i.user.id}>`, embeds: [followUpEmbed], components: [helpRow] });
            return i.editReply({ content: "Modifications appliquées !" });
        }

        if (i.isButton() && i.customId === "form_staff") {
            if (!context || context.userId !== i.user.id) return i.reply({ content: "❌ Action non autorisée.", ephemeral: true });
            const modal = new ModalBuilder().setCustomId("staff_modal_submit").setTitle("Candidature Équipe Pyxar");
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("age").setLabel("Âge").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("xp").setLabel("Vos anciennes expériences").setStyle(TextInputStyle.Paragraph).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("motivation").setLabel("Vos motivations ?").setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
            return i.showModal(modal);
        }

        if (i.isModalSubmit() && i.customId === "staff_modal_submit") {
            await i.deferReply({ ephemeral: true });
            await i.channel.send({ embeds: [new EmbedBuilder().setColor("Green").setTitle("📝 Candidature Validée").setDescription("Votre dossier a été correctement archivé et transmis aux administrateurs de la structure.")] });
            return i.editReply({ content: "Envoi validé !" });
        }

        if (i.isStringSelectMenu() && i.customId === "audio_form_select") {
            if (!context || context.userId !== i.user.id) return i.reply({ content: "❌ Réservé au créateur du ticket.", ephemeral: true });
            const choice = i.values[0];
            const modal = new ModalBuilder().setCustomId(`audio_submit_${choice}`).setTitle(`Recrutement Pôle - ${choice.toUpperCase()}`);
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("portfolio").setLabel("Lien du Portfolio (Réalisations)").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("motivation").setLabel("Pourquoi vouloir produire pour Pyxar ?").setStyle(TextInputStyle.Paragraph).setRequired(true))
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

        if (i.isButton() && ["follow_help_yes", "follow_help_no", "follow_struct_yes", "follow_struct_no"].includes(i.customId)) {
            if (!context || i.user.id !== context.userId) return i.reply({ content: "❌ Réservé à l'auteur du ticket.", ephemeral: true });
            await i.deferUpdate();

            if (i.customId === "follow_help_yes" || i.customId === "follow_help_no") {
                const structRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("follow_struct_yes").setLabel("Oui").setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId("follow_struct_no").setLabel("Non").setStyle(ButtonStyle.Secondary));
                await i.channel.send({ embeds: [new EmbedBuilder().setColor("#34495e").setTitle("❓ Organisation Interne").setDescription("Souhaitez-vous obtenir des renseignements complémentaires sur le fonctionnement de nos entraînements (Scrims) et de nos Line-ups compétitives ?")], components: [structRow] });
            }
            if (i.customId === "follow_struct_no") {
                await i.channel.send({ content: "🏁 Fin de la procédure automatique. Fermeture globale de l'espace en cours..." });
                await generateSystemClose(i.channel, client, context);
            }
        }

        // --- D. SYSTÈME D'AVIS (FEEDBACK NOTATIONS STAFF) ---
        if (i.isButton() && i.customId.startsWith("rate_")) {
            const parts = i.customId.split("_");
            const stars = parts[1];
            const staffId = parts[2];

            const modal = new ModalBuilder().setCustomId(`submit_review_${stars}_${staffId}`).setTitle("Évaluez la réactivité du Staff");
            modal.addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId("comment").setLabel("Rédigez votre commentaire de satisfaction").setStyle(TextInputStyle.Paragraph).setRequired(true)
            ));
            return i.showModal(modal);
        }

        if (i.isModalSubmit() && i.customId.startsWith("submit_review_")) {
            await i.deferReply({ ephemeral: true });
            const parts = i.customId.split("_");
            const stars = parseInt(parts[2]);
            const staffId = parts[3];
            const comment = i.fields.getTextInputValue("comment");

            const starsVisual = "⭐".repeat(stars);
            const reviewEmbed = new EmbedBuilder()
                .setColor(stars >= 4 ? "Gold" : "Orange")
                .setTitle("📝 Note & Évaluation Support")
                .addFields(
                    { name: "Staff Évalué", value: `<@${staffId}> (\`${staffId}\`)`, inline: true },
                    { name: "Note globale", value: `${starsVisual} (${stars}/5)`, inline: true },
                    { name: "Auteur de l'avis", value: `${i.user} (\`${i.user.id}\`)`, inline: false },
                    { name: "Commentaire détaillé", value: comment }
                )
                .setTimestamp();

            // Enregistrement des performances de l'avis en Base de Données
            if (!db.stats[staffId]) db.stats[staffId] = { closedTickets: 0, reviews: [] };
            db.stats[staffId].reviews.push(stars);
            writeDB(db);

            const reviewLogs = await i.guild.channels.fetch(AVIS_CHANNEL).catch(() => null);
            if (reviewLogs) await reviewLogs.send({ embeds: [reviewEmbed] });

            await i.channel.send({ content: "✅ Merci pour votre évaluation ! Fermeture finale imminente." });
            await i.editReply({ content: "Votre avis a été archivé, merci !" });

            return setTimeout(() => generateSystemClose(i.channel, client, context), 4000);
        }

        // --- E. DROITS SÉCURISÉS DU STAFF ---
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

        // --- F. BOUTONS ADMINISTRATIFS SÉCURISÉS (CLAIM, CLOSE, DELETE, BLACKLIST) ---
        if (i.isButton() && ["claim", "close", "delete", "force_close_confirm", "cancel_close", "blacklist_user"].includes(i.customId)) {
            if (!isStaffUser && !["cancel_close"].includes(i.customId)) {
                return i.reply({ content: "❌ Action refusée. Droits de Modération requis.", ephemeral: true });
            }

            // BOUTON INTERACTIF : BLACKLIST EXTRÊME DU JOUEUR EN 1 CLIC
            if (i.customId === "blacklist_user") {
                if (!context) return i.reply({ content: "❌ Impossible de cibler le créateur.", ephemeral: true });
                await i.reply({ content: "⛔ Application de la restriction d'infrastructure..." });

                db.blacklist.push(context.userId);
                delete db.tickets[i.channel.id];
                writeDB(db);

                const logChannel = await i.guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
                if (logChannel) {
                    logChannel.send({ embeds: [new EmbedBuilder().setColor("Red").setTitle("⛔ BLACKLIST SUPPORT").setDescription(`L'ID \`${context.userId}\` a été banni définitivement du système de ticket par ${i.user}.`)] });
                }

                return setTimeout(() => i.channel.delete().catch(() => {}), 2000);
            }

            if (i.customId === "claim") {
                await i.deferUpdate();
                db.tickets[i.channel.id].claimedBy = i.user.id; 
                
                // Incrémentation des statistiques d'activité du Staff
                if (!db.stats[i.user.id]) db.stats[i.user.id] = { closedTickets: 0, reviews: [] };
                db.stats[i.user.id].closedTickets++;
                writeDB(db);

                await i.channel.setName(`📍-${i.channel.name}`).catch(() => {});
                
                const updatedRow = ActionRowBuilder.from(i.message.components[0]);
                updatedRow.components[0] = new ButtonBuilder().setCustomId("claimed_disabled").setLabel(`Pris par ${i.member.displayName}`).setStyle(ButtonStyle.Success).setEmoji("✅").setDisabled(true);
                return i.message.edit({ components: [updatedRow, i.message.components[1]] });
            }

            if (i.customId === "close") {
                await i.deferReply();
                if (context) {
                    db.tickets[i.channel.id].status = "closed"; writeDB(db);
                    await i.channel.permissionOverwrites.edit(context.userId, { ViewChannel: false }).catch(() => null);
                }
                
                await i.channel.setName(`🔒-${i.channel.name.replace("📍-", "")}`).catch(() => {});

                const reviewRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`rate_5_${i.user.id}`).setLabel("5 ⭐ Excellent").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`rate_4_${i.user.id}`).setLabel("4 ⭐ Bon").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`rate_3_${i.user.id}`).setLabel("3 ⭐ Moyen").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`rate_2_${i.user.id}`).setLabel("2 ⭐ Mauvais").setStyle(ButtonStyle.Danger)
                );

                const closeConfirmRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("force_close_confirm").setLabel("Suppression Directe").setStyle(ButtonStyle.Danger).setEmoji("🗑️"),
                    new ButtonBuilder().setCustomId("cancel_close").setLabel("Réouvrir l'Accès").setStyle(ButtonStyle.Secondary).setEmoji("🔓")
                );

                await i.editReply({ 
                    embeds: [new EmbedBuilder().setColor("#f1c40f").setTitle("🔒 Ticket Verrouillé").setDescription("L'accès du demandeur est révoqué.\nLe salon sera **automatiquement archivé et supprimé d'ici 1 heure** s'il n'est pas détruit manuellement.\n\n*Merci au joueur d'évaluer la réactivité du Staff via les boutons ci-dessous :*")],
                    components: [reviewRow, closeConfirmRow]
                });

                // ⏳ SÉCURITÉ : NETTOYEUR TEMPORISÉ ACTIF (1 HEURE CHRONO)
                return setTimeout(async () => {
                    const dynamicDB = readDB();
                    if (dynamicDB.tickets[i.channel.id]) {
                        await generateSystemClose(i.channel, client, dynamicDB.tickets[i.channel.id]);
                    }
                }, 60 * 60 * 1000);
            }

            if (i.customId === "cancel_close") {
                if (context) {
                    db.tickets[i.channel.id].status = "open"; writeDB(db);
                    await i.channel.permissionOverwrites.edit(context.userId, { ViewChannel: true, SendMessages: true }).catch(() => null);
                }
                await i.message.delete().catch(() => {});
                return i.reply({ content: "🔓 Statut réinitialisé. Les accès du salon sont de nouveau opérationnels." });
            }

            if (i.customId === "delete" || i.customId === "force_close_confirm") {
                await i.reply({ content: "⏳ Génération du transcript HTML Premium et suppression en cours..." });
                return await generateSystemClose(i.channel, client, context);
            }
        }
    });
};

// =====================================================
// 🛠️ COMPILATEUR DE LOGS & TRANSCRIPT PREMIUM HTML
// =====================================================
async function generateSystemClose(channel, client, context) {
    try {
        if (!context) return channel.delete().catch(() => {});

        const rawMessages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
        let transcriptHTML = "";

        if (rawMessages) {
            const sorted = Array.from(rawMessages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
            
            transcriptHTML = `
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <title>Archives Pyxar — ${channel.name}</title>
                <style>
                    body { background-color: #1e1f22; color: #dbdee1; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; }
                    .header { border-bottom: 2px solid #3f4147; padding-bottom: 15px; margin-bottom: 20px; }
                    .title { color: #ffb347; font-size: 24px; font-weight: bold; }
                    .meta { color: #949ba4; font-size: 14px; margin-top: 5px; }
                    .msg-container { display: flex; margin-bottom: 16px; }
                    .avatar { width: 40px; height: 40px; border-radius: 50%; background-color: #5865f2; margin-right: 16px; display:flex; align-items:center; justify-content:center; font-weight:bold; color:white; }
                    .msg-body { display: flex; flex-direction: column; }
                    .msg-author { font-weight: bold; color: #f2f3f5; font-size: 16px; }
                    .msg-time { color: #949ba4; font-size: 12px; margin-left: 8px; font-weight: normal; }
                    .msg-content { color: #dbdee1; font-size: 15px; margin-top: 4px; white-space: pre-wrap; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="title">📄 Archives de Support Team Pyxar</div>
                    <div class="meta">Salon : ${channel.name} | Catégorie : ${context.type.toUpperCase()} | Demandeur ID : ${context.userId}</div>
                </div>
            `;

            for (const msg of sorted) {
                if (msg.author.bot && msg.embeds.length === 0 && msg.components.length > 0) continue;
                const dateStr = new Date(msg.createdTimestamp).toLocaleString("fr-FR");
                const initial = msg.author.username.substring(0, 2).toUpperCase();
                
                transcriptHTML += `
                <div class="msg-container">
                    <div class="avatar">${initial}</div>
                    <div class="msg-body">
                        <div class="msg-author">${msg.author.tag}<span class="msg-time">${dateStr}</span></div>
                        <div class="msg-content">${msg.content || "[Contenu Multimédia / Embed Intégré]"}</div>
                    </div>
                </div>
                `;
            }
            transcriptHTML += `</body></html>`;
        }

        const buffer = Buffer.from(transcriptHTML, "utf-8");
        const attachment = new AttachmentBuilder(buffer, { name: `transcript-${channel.name}.html` });

        // Expédition des archives au pôle Direction
        const archiveChannel = await client.channels.fetch(ARCHIVE_CHANNEL).catch(() => null);
        if (archiveChannel) {
            const endEmbed = new EmbedBuilder()
                .setColor("Red")
                .setTitle(`📁 Archive Complète — ${channel.name}`)
                .setDescription(`**Détails d'intégration :**\n👤 **Auteur :** <@${context.userId}>\n🏷️ **Type d'Espace :** \`${context.type}\`\n💬 **Total de Messages :** \`${context.messageCount || 0}\``)
                .setTimestamp();
            await archiveChannel.send({ embeds: [endEmbed], files: [attachment] });
        }
        
        const db = readDB();
        delete db.tickets[channel.id];
        writeDB(db);
        
        return await channel.delete().catch(() => {});
    } catch (e) {
        console.error("[CRITICAL TRANSCRIPT EXCEPTION]", e);
        return channel.delete().catch(() => {});
    }
}
