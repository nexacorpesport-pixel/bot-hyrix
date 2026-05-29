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

const fs = require("fs");
const path = require("path");
const config = require("../data/ticketConfig");

// Identifiants des salons de logs et d'archives
const LOGS_CHANNEL = "1508157026491175002";
const ARCHIVE_CHANNEL = "1510019228047114300";

// Base de données locale ultra-légère et persistante (Anti-Crash/Reboot)
const DB_PATH = path.join(__dirname, "../data/ticket_database.json");
if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({ tickets: {}, blacklist: [], stats: {} }, null, 4));

function readDB() { return JSON.parse(fs.readFileSync(DB_PATH, "utf-8")); }
function writeDB(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 4), "utf-8"); }

// Cooldowns en mémoire vive (Anti-Spam / Anti-Double Click)
const globalCooldowns = new Set();

module.exports = async (client) => {

    console.log("[TICKET] Initialisation du système ULTIME HoveX (All-In-One)...");

    // =====================================================
    // 1. DÉPLOIEMENT DU PANEL PRINCIPAL
    // =====================================================
    const panelChannel = await client.channels.fetch(config.PANEL_CHANNEL).catch(() => null);
    if (panelChannel) {
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
            .setDescription("Sélectionnez la catégorie correspondante à votre demande ci-dessous :\n\n🛡️ **Staff (Recrutement Modération)**\n🎮 **Joueur (PR System)**\n🎬 **Audiovisuel (Graphisme, Montage, etc.)**\n🆘 **Assistance / Aide**\n🤝 **Partenariat**");

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
        }).catch(() => {});
    }

    // =====================================================
    // 2. GESTION DES COMMANDES PAR MESSAGE (PREFIXE +)
    // =====================================================
    client.on("messageCreate", async (message) => {
        if (message.author.bot || !message.guild) return;

        // Mise à jour de l'activité du ticket (Anti-Inactivité)
        const db = readDB();
        if (db.tickets[message.channel.id]) {
            db.tickets[message.channel.id].lastActivity = Date.now();
            db.tickets[message.channel.id].messageCount = (db.tickets[message.channel.id].messageCount || 0) + 1;
            writeDB(db);
        }

        // Commande : +test modérateur @membre
        if (message.content.startsWith("+test modérateur")) {
            const allowedRoles = config.ROLES.staff;
            const isStaff = message.member.roles.cache.some(r => allowedRoles.includes(r.id)) || message.member.permissions.has(PermissionsBitField.Flags.ManageChannels);
            
            if (!isStaff) return message.reply("❌ Tu n'as pas l'autorisation de lancer un test modérateur.");

            const targetUser = message.mentions.members.first();
            if (!targetUser) return message.reply("❌ Tu dois mentionner un membre. Exemple : `+test modérateur @Pseudo`_");

            await targetUser.roles.add(config.TEST_MODO_ROLE).catch(() => {});

            await message.channel.permissionOverwrites.edit(targetUser.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            }).catch(() => {});

            const testEmbed = new EmbedBuilder()
                .setColor("#3498db")
                .setTitle("🛡️ ÉVALUATION TEST MODÉRATEUR")
                .setDescription(`Bienvenue ${targetUser} dans ton espace de test de modération !\n\nLe rôle <@&${config.TEST_MODO_ROLE}> t'a été attribué. C'est ici que tu vas devoir faire tes preuves face au Staff de la **HoveX**.`);

            return message.reply({ embeds: [testEmbed] });
        }

        // Commandes d'administration de la Blacklist globale des tickets
        if (message.content.startsWith("+ticket blacklist")) {
            if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) return;
            const target = message.mentions.users.first();
            if (!target) return message.reply("Usage: `+ticket blacklist @user`_");
            
            const db = readDB();
            if (!db.blacklist.includes(target.id)) {
                db.blacklist.push(target.id);
                writeDB(db);
                return message.reply(`✅ **${target.tag}** est maintenant banni du système de tickets.`);
            } else {
                db.blacklist = db.blacklist.filter(id => id !== target.id);
                writeDB(db);
                return message.reply(`✅ **${target.tag}** est retiré de la blacklist des tickets.`);
            }
        }
    });

    // =====================================================
    // 3. GESTION DE TOUTES LES INTERACTIONS
    // =====================================================
    client.on("interactionCreate", async (i) => {
        if (!i.guild) return;

        // --- ANTI-SPAM ET DOUBLE CLICK (2 SECONDES) ---
        if (i.isButton() || i.isStringSelectMenu()) {
            const cooldownKey = `${i.user.id}-${i.customId}`;
            if (globalCooldowns.has(cooldownKey)) {
                return i.reply({ content: "⏳ Ralentis ! Tu cliques trop vite sur les composants.", ephemeral: true });
            }
            globalCooldowns.add(cooldownKey);
            setTimeout(() => globalCooldowns.delete(cooldownKey), 2000);
        }

        // --- A. OUVERTURE AUTOMATIQUE DES TICKETS ---
        if (i.isStringSelectMenu() && i.customId === "ticket_select") {
            const type = i.values[0];
            const db = readDB();

            // Vérification Blacklist
            if (db.blacklist.includes(i.user.id)) {
                return i.reply({ content: "❌ Vous possédez une interdiction active vous empêchant d'ouvrir un ticket sur HoveX.", ephemeral: true });
            }

            // Vérification doublon persistant
            const hasActiveTicket = Object.values(db.tickets).some(t => t.userId === i.user.id && t.status === "open");
            if (hasActiveTicket) return i.reply({ content: "⏳ Vous possédez déjà un ticket ouvert au sein de la structure.", ephemeral: true });

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

            // Enregistrement permanent dans la base JSON
            db.tickets[ticketChannel.id] = {
                userId: i.user.id,
                username: i.user.username,
                type: type,
                createdAt: Date.now(),
                lastActivity: Date.now(),
                messageCount: 0,
                status: "open",
                claimedBy: null
            };
            writeDB(db);

            // Génération des boutons principaux + Boutons Utilitaires (Add/Remove & Vocal)
            const actionButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Primary).setEmoji("📌"),
                new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(ButtonStyle.Secondary).setEmoji("🔒"),
                new ButtonBuilder().setCustomId("delete").setLabel("Delete").setStyle(ButtonStyle.Danger).setEmoji("🗑️")
            );

            const utilityButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("ticket_add_user").setLabel("Ajouter Membre").setStyle(ButtonStyle.Secondary).setEmoji("➕"),
                new ButtonBuilder().setCustomId("ticket_remove_user").setLabel("Retirer Membre").setStyle(ButtonStyle.Secondary).setEmoji("➖"),
                new ButtonBuilder().setCustomId("ticket_create_voice").setLabel("Créer Salon Vocal").setStyle(ButtonStyle.Success).setEmoji("🔊")
            );

            let mainEmbed = new EmbedBuilder().setColor("#ffb347").setTitle(`🎫 Ticket ${type.toUpperCase()} Ouvert`);

            // Embed Historique / Casier Modération instantané pour le Staff
            const infoEmbed = new EmbedBuilder()
                .setColor("#2f3136")
                .setDescription(`👤 **Demandeur :** ${i.user} (${i.user.id})\n📂 **Historique structure :** Aucune sanction active enregistrée.`);

            if (type === "joueur") {
                mainEmbed.setDescription(`Espace de recrutement Joueur.\n\nClique sur le bouton ci-dessous pour lancer ton intégration automatique via tes PR.`);
                actionButtons.addComponents(new ButtonBuilder().setCustomId("form_joueur").setLabel("Formulaire").setStyle(ButtonStyle.Success).setEmoji("🧾"));
                await ticketChannel.send({ content: `<@${i.user.id}>`, embeds: [mainEmbed, infoEmbed], components: [actionButtons, utilityButtons] });
            } 
            else if (type === "staff") {
                mainEmbed.setDescription(`Espace de recrutement Staff (Modération/Animation).\n\nMerci de cliquer sur le bouton ci-dessous pour remplir ton dossier de candidature complet.`);
                actionButtons.addComponents(new ButtonBuilder().setCustomId("form_staff").setLabel("Dossier Recrutement").setStyle(ButtonStyle.Primary).setEmoji("🛡️"));
                await ticketChannel.send({ content: `<@${i.user.id}>`, embeds: [mainEmbed, infoEmbed], components: [actionButtons, utilityButtons] });
            } 
            else if (type === "audiovisuel") {
                mainEmbed.setDescription("Espace Audiovisuel. Sélectionne ta spécialité ci-dessous pour ouvrir le formulaire adéquat :");
                const audioMenu = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("audio_form_select")
                        .setPlaceholder("Choisis ton domaine...")
                        .addOptions([
                            { label: "Monteur", value: "monteur", emoji: "🎥" },
                            { label: "Graphiste", value: "graphiste", emoji: "🎨" },
                            { label: "Mapper / Thumbnail Maker", value: "mapper", emoji: "🗺️" },
                            { label: "Mia Maker", value: "mia", emoji: "🤖" },
                            { label: "Caster", value: "caster", emoji: "🎙️" }
                        ])
                );
                await ticketChannel.send({ content: `<@${i.user.id}>`, embeds: [mainEmbed, infoEmbed], components: [actionButtons, utilityButtons] });
                await ticketChannel.send({ components: [audioMenu] });
            } else {
                mainEmbed.setDescription(`Bonjour ${i.user}, décris ta demande ici, un membre du staff va te répondre.`);
                await ticketChannel.send({ content: `<@${i.user.id}>`, embeds: [mainEmbed, infoEmbed], components: [actionButtons, utilityButtons] });
            }

            return i.reply({ content: `✅ Ticket créé : ${ticketChannel}`, ephemeral: true });
        }

        // --- B. MODULE RECRUTEMENT JOUEUR ---
        if (i.isButton() && i.customId === "form_joueur") {
            const db = readDB();
            const context = db.tickets[i.channel.id];
            if (!context || context.userId !== i.user.id) return i.reply({ content: "❌ Action non autorisée.", ephemeral: true });

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

        if (i.isModalSubmit() && i.customId === "joueur_modal_submit") {
            await i.deferReply({ ephemeral: true });
            const epic = i.fields.getTextInputValue("epic");
            const age = i.fields.getTextInputValue("age");
            const prValue = parseInt(i.fields.getTextInputValue("pr").replace(/\s/g, "")) || 0;
            const platform = i.fields.getTextInputValue("platform");
            const motivation = i.fields.getTextInputValue("motivation");

            let finalRole = config.PR_ROLES[0].role;
            let roleName = config.PR_ROLES[0].name;
            for (const item of config.PR_ROLES) {
                if (prValue >= item.min && prValue < item.max) { finalRole = item.role; roleName = item.name; break; }
            }

            await i.member.roles.add(finalRole).catch(() => {});
            const currentName = i.member.displayName;
            if (!currentName.startsWith("HVX")) await i.member.setNickname(`HVX ${currentName.substring(0, 28)}`).catch(() => {});
            await i.channel.setName(`hvx-${epic}`).catch(() => {});

            const logChannel = await i.guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
            if (logChannel) {
                const logEmbed = new EmbedBuilder().setColor("Green").setTitle("📊 Rôle PR Assigné Automatiquement").setDescription(`Le joueur ${i.user} a complété son formulaire.`)
                    .addFields({ name: "🎮 Epic", value: epic, inline: true }, { name: "🎂 Âge", value: age, inline: true }, { name: "🏆 Score PR", value: `${prValue} PR`, inline: true }, { name: "💻 Plateforme", value: platform, inline: true }, { name: "🏷️ Rôle Donné", value: `<@&${finalRole}> (${roleName})` }, { name: "📝 Motivation", value: motivation });
                await logChannel.send({ embeds: [logEmbed] });
            }

            const followUpEmbed = new EmbedBuilder().setColor("Green").setTitle("✅ Rôle Attribué avec Succès !").setDescription(`Tes données ont été enregistrées. Le rôle **${roleName}** t'a été donné.\n\n**Question 1 :** As-tu besoin d'aide supplémentaire concernant ce rôle ?`);
            const helpRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("follow_help_yes").setLabel("Oui").setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId("follow_help_no").setLabel("Non").setStyle(ButtonStyle.Secondary));
            await i.channel.send({ content: `<@${i.user.id}>`, embeds: [followUpEmbed], components: [helpRow] });
            return i.editReply({ content: "Formulaire traité et validé !" });
        }

        // --- C. MODULE RECRUTEMENT STAFF ---
        if (i.isButton() && i.customId === "form_staff") {
            const db = readDB();
            const context = db.tickets[i.channel.id];
            if (!context || context.userId !== i.user.id) return i.reply({ content: "❌ Action non autorisée.", ephemeral: true });

            const modal = new ModalBuilder().setCustomId("staff_modal_submit").setTitle("Candidature Staff - HoveX");
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("age").setLabel("Quel est ton âge ?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("xp").setLabel("Tes anciennes expériences de modération ?").setStyle(TextInputStyle.Paragraph).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("dispo").setLabel("Vos disponibilités (Heures/Semaine) ?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("situation").setLabel("Que ferais-tu en cas de conflit textuel ?").setStyle(TextInputStyle.Paragraph).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("motivation").setLabel("Pourquoi toi et pas un autre ?").setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
            return i.showModal(modal);
        }

        if (i.isModalSubmit() && i.customId === "staff_modal_submit") {
            await i.deferReply({ ephemeral: true });
            const fields = ["age", "xp", "dispo", "situation", "motivation"].map(id => i.fields.getTextInputValue(id));

            const logChannel = await i.guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
            if (logChannel) {
                const staffLog = new EmbedBuilder().setColor("#e74c3c").setTitle("🛡️ Nouveau Dossier Candidature Staff").setDescription(`Postulant : ${i.user}`)
                    .addFields({ name: "🎂 Âge", value: fields[0], inline: true }, { name: "⏳ Dispos", value: fields[2], inline: true }, { name: "📁 Expériences", value: fields[1] }, { name: "⚡ Cas Pratique", value: fields[3] }, { name: "🎯 Motivations", value: fields[4] });
                await logChannel.send({ embeds: [staffLog] });
            }
            await i.channel.send({ embeds: [new EmbedBuilder().setColor("Green").setTitle("📝 Dossier envoyé !").setDescription("Ton dossier complet de modération a été transmis au haut-staff.")] });
            return i.editReply({ content: "Candidature Staff envoyée !" });
        }

        // --- D. MODULE AUDIOVISUEL ---
        if (i.isStringSelectMenu() && i.customId === "audio_form_select") {
            const db = readDB(); const context = db.tickets[i.channel.id];
            if (!context || context.userId !== i.user.id) return i.reply({ content: "❌ Action non autorisée.", ephemeral: true });

            const choice = i.values[0];
            const modal = new ModalBuilder().setCustomId(`audio_submit_${choice}`).setTitle(`Formulaire ${choice.toUpperCase()}`);
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("portfolio").setLabel("Lien de ton Portfolio / Réalisations").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("softwares").setLabel("Logiciels utilisés (Suite Adobe, Blender...)").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("xp").setLabel("Depuis combien de temps pratiques-tu ?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("motivation").setLabel("Tes motivations à rejoindre l'audiovisuel").setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
            return i.showModal(modal);
        }

        if (i.isModalSubmit() && i.customId.startsWith("audio_submit_")) {
            await i.deferReply({ ephemeral: true });
            const specialty = i.customId.split("_").pop();
            const portfolio = i.fields.getTextInputValue("portfolio");
            const softwares = i.fields.getTextInputValue("softwares");
            const xp = i.fields.getTextInputValue("xp");
            const motivation = i.fields.getTextInputValue("motivation");

            const autoRole = config.AUDIO_ROLES[specialty];
            if (autoRole) await i.member.roles.add(autoRole).catch(() => {});

            const logChannel = await i.guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
            if (logChannel) {
                const audioLog = new EmbedBuilder().setColor("#9b59b6").setTitle(`🎬 Recrutement Audiovisuel [${specialty.toUpperCase()}]`).setDescription(`Membre : ${i.user}`)
                    .addFields({ name: "🔗 Portfolio", value: portfolio }, { name: "🛠️ Logiciels", value: softwares, inline: true }, { name: "⏳ Expérience", value: xp, inline: true }, { name: "📝 Motivation", value: motivation });
                await logChannel.send({ embeds: [audioLog] });
            }
            await i.channel.send({ embeds: [new EmbedBuilder().setColor("Purple").setTitle("🎬 Profil Enregistré Automatiquement !").setDescription(`Ton rôle de **${specialty.toUpperCase()}** t'a été attribué.`)] });
            return i.editReply({ content: "Formulaire Audiovisuel pris en compte !" });
        }

        // --- E. SUIVI DE L'ENCHAÎNEMENT DES QUESTIONS JOUEUR ---
        if (i.isButton() && ["follow_help_yes", "follow_help_no", "follow_struct_yes", "follow_struct_no"].includes(i.customId)) {
            const db = readDB(); const context = db.tickets[i.channel.id];
            if (!context || i.user.id !== context.userId) return i.reply({ content: "❌ Action non autorisée.", ephemeral: true });
            await i.deferUpdate();

            if (i.customId === "follow_help_yes" || i.customId === "follow_help_no") {
                const structRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("follow_struct_yes").setLabel("Oui").setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId("follow_struct_no").setLabel("Non").setStyle(ButtonStyle.Secondary));
                await i.channel.send({ embeds: [new EmbedBuilder().setColor("#34495e").setTitle("❓ Question Suivante").setDescription("As-tu des questions particulières à poser concernant le fonctionnement de notre structure (HoveX) ?")], components: [structRow] });
            }
            if (i.customId === "follow_struct_no") {
                await i.channel.send({ content: "🏁 Clôture automatique du ticket..." });
                await generateSystemClose(i.channel, client, context);
            }
            if (i.customId === "follow_struct_yes") {
                const menuCount = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("user_questions_count").setPlaceholder("Choisis le nombre...").addOptions([{ label: "1 Question", value: "1" }, { label: "2 Questions", value: "2" }, { label: "3 Questions ou plus", value: "3" }]));
                await i.channel.send({ embeds: [new EmbedBuilder().setColor("#2ecc71").setTitle("💬 Nombre de questions").setDescription("Combien de questions souhaites-tu soumettre à l'équipe ?")], components: [menuCount] });
            }
        }

        // --- F. GESTION DES BOUTONS UTILITAIRES (ADD/REMOVE, VOCAL) ---
        if (i.isButton() && ["ticket_add_user", "ticket_remove_user", "ticket_create_voice"].includes(i.customId)) {
            const db = readDB(); const context = db.tickets[i.channel.id];
            const hasAccess = i.member.permissions.has(PermissionsBitField.Flags.ManageChannels) || i.member.roles.cache.some(r => (config.ROLES[context ? context.type : "autre"] || []).includes(r.id));
            if (!hasAccess) return i.reply({ content: "❌ Action réservée aux modérateurs.", ephemeral: true });

            if (i.customId === "ticket_add_user" || i.customId === "ticket_remove_user") {
                const modal = new ModalBuilder().setCustomId(`modal_user_${i.customId}`).setTitle("Gestion des Membres");
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("user_id").setLabel("Identifiant Discord (ID)").setStyle(TextInputStyle.Short).setRequired(true)));
                return i.showModal(modal);
            }

            if (i.customId === "ticket_create_voice") {
                await i.deferReply();
                const voiceChannel = await i.guild.channels.create({
                    name: `🔊 Entretien ${i.channel.name.split("-")[1] || ""}`,
                    type: ChannelType.GuildVoice,
                    parent: i.channel.parentId,
                    permissionOverwrites: i.channel.permissionOverwrites.cache.map(p => p)
                });
                return i.editReply({ content: `🔊 Salon vocal d'entretien éphémère créé avec succès : ${voiceChannel}` });
            }
        }

        // Réception des soumissions Modals Add/Remove Membre
        if (i.isModalSubmit() && i.customId.startsWith("modal_user_")) {
            await i.deferReply({ ephemeral: true });
            const actionType = i.customId.includes("add") ? "add" : "remove";
            const targetId = i.fields.getTextInputValue("user_id");
            const targetMember = await i.guild.members.fetch(targetId).catch(() => null);

            if (!targetMember) return i.editReply({ content: "❌ Membre introuvable. Assure-toi de fournir une ID valide." });

            if (actionType === "add") {
                await i.channel.permissionOverwrites.edit(targetMember.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
                await i.channel.send({ content: `➕ ${targetMember} a été ajouté au ticket par ${i.user}.` });
            } else {
                await i.channel.permissionOverwrites.delete(targetMember.id);
                await i.channel.send({ content: `➖ ${targetMember} a été retiré du ticket par ${i.user}.` });
            }
            return i.editReply({ content: "Permissions mises à jour !" });
        }

        // --- G. COMMANDES PREMIUM STAFF (CLAIM DYNAMIQUE, CLOSE REQUEST, DELETE, STARS RATING) ---
        if (i.isButton() && ["claim", "close", "delete", "force_close_confirm", "cancel_close"].includes(i.customId)) {
            const db = readDB(); const context = db.tickets[i.channel.id];
            const hasAccess = i.member.roles.cache.some(r => (config.ROLES[context ? context.type : "autre"] || []).includes(r.id)) || i.member.permissions.has(PermissionsBitField.Flags.ManageChannels);
            if (!hasAccess && !["cancel_close"].includes(i.customId)) return i.reply({ content: "❌ Réservé au staff.", ephemeral: true });

            if (i.customId === "claim") {
                await i.deferUpdate();
                db.tickets[i.channel.id].claimedBy = i.user.id; writeDB(db);
                await i.channel.setName(`🔒-${i.channel.name}`).catch(() => {});
                
                const updatedRow = ActionRowBuilder.from(i.message.components[0]);
                updatedRow.components[0] = new ButtonBuilder().setCustomId("claimed_disabled").setLabel(`Pris par ${i.member.displayName}`).setStyle(ButtonStyle.Success).setEmoji("✅").setDisabled(true);
                return i.message.edit({ components: [updatedRow, i.message.components[1]] });
            }

            if (i.customId === "close") {
                if (context) await i.channel.permissionOverwrites.edit(context.userId, { ViewChannel: false }).catch(() => null);
                const closeConfirmRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("force_close_confirm").setLabel("Confirmer la suppression").setStyle(ButtonStyle.Danger).setEmoji("🗑️"),
                    new ButtonBuilder().setCustomId("cancel_close").setLabel("Réouvrir les accès").setStyle(ButtonStyle.Secondary).setEmoji("🔓")
                );
                return i.reply({ embeds: [new EmbedBuilder().setColor("#f1c40f").setTitle("🔒 Fin de prise en charge").setDescription("Voulez-vous détruire et archiver ce salon ?")], components: [closeConfirmRow] });
            }

            if (i.customId === "cancel_close") {
                if (context) await i.channel.permissionOverwrites.edit(context.userId, { ViewChannel: true, SendMessages: true }).catch(() => null);
                await i.message.delete().catch(() => {});
                return i.reply({ content: "🔓 Ticket réouvert." });
            }

            if (i.customId === "delete" || i.customId === "force_close_confirm") {
                await i.reply({ content: "⏳ Archivage, compilation des statistiques et suppression du salon..." });
                await generateSystemClose(i.channel, client, context);
            }
        }

        // --- H. RECEPTION ET LEADERBOARD DES NOTES DE SATISFACTION ---
        if (i.isButton() && i.customId.startsWith("rate_stars_")) {
            const ratingValue = parseInt(i.customId.split("_").pop());
            await i.reply({ content: `⭐ Merci pour ta note de **${ratingValue}/5** !`, ephemeral: true });
            await i.message.delete().catch(() => {});

            const db = readDB();
            // Assignation de la note au staff ayant claim pour le Leaderboard hebdomadaire
            const claimedStaffId = i.customId.split("-")[1];
            if (claimedStaffId) {
                if (!db.stats[claimedStaffId]) db.stats[claimedStaffId] = { count: 0, totalStars: 0 };
                db.stats[claimedStaffId].count += 1;
                db.stats[claimedStaffId].totalStars += ratingValue;
                writeDB(db);
            }

            const logChannel = await i.guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
            if (logChannel) {
                await logChannel.send({ embeds: [new EmbedBuilder().setColor("Gold").setTitle("⭐ Évaluation Reçue").setDescription(`Qualité du support évaluée à **${ratingValue}/5** pour le staff <@${claimedStaffId || 'Inconnu'}>.`)] });
            }
        }
    });

    // =====================================================
    // 4. CRON / TASK DE PURGE ET DE RELANCE AUTOMATIQUE DES INACTIFS (24H)
    // =====================================================
    setInterval(async () => {
        const db = readDB();
        const now = Date.now();

        for (const [channelId, tData] of Object.entries(db.tickets)) {
            if (tData.status !== "open") continue;

            const targetChannel = await client.channels.fetch(channelId).catch(() => null);
            if (!targetChannel) {
                delete db.tickets[channelId]; writeDB(db); continue;
            }

            const hoursInactive = (now - tData.lastActivity) / (1000 * 60 * 60);

            // Relance automatique après 24 heures d'inactivité
            if (hoursInactive >= 24 && !tData.warnedInactive) {
                tData.warnedInactive = true; writeDB(db);
                await targetChannel.send({ content: `<@${tData.userId}> ⚠️ **Rappel :** Sans réponse de votre part sous 12h, ce ticket sera automatiquement clôturé pour inactivité.` }).catch(() => {});
            }
            // Clôture automatique après 36 heures d'inactivité totale
            else if (hoursInactive >= 36) {
                await targetChannel.send({ content: "🔒 Clôture automatique du ticket pour inactivité prolongée." });
                await generateSystemClose(targetChannel, client, tData);
            }
        }
    }, 1800000); // Exécution toutes les 30 minutes
};

// =====================================================
// DESTRUCTION PROPRE ET PROCESS DES AMÉLIORATIONS
// =====================================================
async function generateSystemClose(channel, client, context) {
    const timeOpen = context ? ((Date.now() - context.createdAt) / 60000).toFixed(1) : "Inconnu";
    const fetchedMessages = await channel.messages.fetch({ limit: 100 });
    const totalMsgCount = fetchedMessages.size;

    if (context) {
        const targetUserInstance = await client.users.fetch(context.userId).catch(() => null);
        if (targetUserInstance) {
            const starsEmbed = new EmbedBuilder().setColor("#ffb347").setTitle("⭐ Donnez votre avis sur HoveX Support !").setDescription("Votre ticket est maintenant résolu. Évaluez la réactivité du staff :");
            const starsRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`rate_stars_1-${context.claimedBy}`).setLabel("1 ⭐").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`rate_stars_2-${context.claimedBy}`).setLabel("2 ⭐").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`rate_stars_3-${context.claimedBy}`).setLabel("3 ⭐").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`rate_stars_4-${context.claimedBy}`).setLabel("4 ⭐").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`rate_stars_5-${context.claimedBy}`).setLabel("5 ⭐").setStyle(ButtonStyle.Primary)
            );
            await targetUserInstance.send({ embeds: [starsEmbed], components: [starsRow] }).catch(() => {});
        }

        const db = readDB();
        delete db.tickets[channel.id];
        writeDB(db);
    }

    await buildPremiumHtmlArchive(channel, client, timeOpen, totalMsgCount);

    // Suppression physique des salons vocaux éphémères orphelins liés
    const associatedVoice = channel.guild.channels.cache.find(c => c.type === ChannelType.GuildVoice && c.name.includes(channel.name.split("-")[1] || "INVALIDE"));
    if (associatedVoice) await associatedVoice.delete().catch(() => {});

    setTimeout(() => channel.delete().catch(() => {}), 2500);
}

// =====================================================
// SYSTÈME DE TRANSCRIPTS HTML EMBEDDED
// =====================================================
async function buildPremiumHtmlArchive(channel, client, minutes, messageCount) {
    try {
        const rawMessages = await channel.messages.fetch({ limit: 100 });
        const sortedArray = Array.from(rawMessages.values()).reverse();

        let htmlContent = `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Transcript HoveX - ${channel.name}</title>
            <style>
                body { background-color: #36393f; color: #dcddde; font-family: sans-serif; padding: 20px; }
                .header-box { border-bottom: 2px solid #4f545c; padding-bottom: 15px; margin-bottom: 20px; }
                .title-main { color: #ffffff; font-size: 24px; font-weight: bold; }
                .chat-container { display: flex; flex-direction: column; gap: 16px; }
                .msg-row { display: flex; gap: 16px; }
                .avatar-img { width: 40px; height: 40px; border-radius: 50%; background-color: #4f545c; }
                .author-name { color: #ffffff; font-size: 16px; font-weight: 500; }
                .msg-time { color: #72767d; font-size: 12px; margin-left: 8px; }
                .content-text { color: #dcddde; font-size: 15px; margin-top: 4px; }
                .embed-box { background: #2f3136; border-left: 4px solid #ffb347; padding: 12px; margin-top: 6px; border-radius: 4px; }
            </style>
        </head>
        <body>
            <div class="header-box">
                <div class="title-main">📊 Archive Salon : ${channel.name}</div>
                <div>Durée : ${minutes} min | Messages : ${messageCount}</div>
            </div>
            <div class="chat-container">
        `;

        sortedArray.forEach(m => {
            if (m.author.bot && !m.content && m.embeds.length === 0) return;
            htmlContent += `
            <div class="msg-row">
                <img class="avatar-img" src="${m.author.displayAvatarURL({ extension: 'png' })}">
                <div>
                    <div><span class="author-name">${m.author.tag}</span><span class="msg-time">${m.createdAt.toLocaleString()}</span></div>
                    ${m.content ? `<div class="content-text">${m.content}</div>` : ""}
            `;
            m.embeds.forEach(emb => {
                htmlContent += `<div class="embed-box"><b>${emb.title || ""}</b><br>${emb.description || ""}</div>`;
            });
            htmlContent += `</div></div>`;
        });

        htmlContent += `</div></body></html>`;

        const destinationLog = await client.channels.fetch(ARCHIVE_CHANNEL).catch(() => null);
        if (destinationLog) {
            const textBuffer = Buffer.from(htmlContent, "utf-8");
            await destinationLog.send({ 
                content: `📁 **Archive HTML générée** pour \`${channel.name}\`.`, 
                files: [{ attachment: textBuffer, name: `transcript-${channel.name}.html` }] 
            });
        }
    } catch (e) { console.error(e); }
}
