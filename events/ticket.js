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

// Base de données locale ultra-légère (Anti-Crash/Reboot)
const DB_PATH = path.join(__dirname, "../data/ticket_database.json");
if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({ tickets: {}, blacklist: [], stats: {} }, null, 4));

function readDB() { return JSON.parse(fs.readFileSync(DB_PATH, "utf-8")); }
function writeDB(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 4), "utf-8"); }

// Cooldowns anti-double click
const globalCooldowns = new Set();

module.exports = async (client) => {

    console.log("[TICKET] Initialisation du système HoveX...");

    // =====================================================
    // 1. PANEL PRINCIPAL D'OUVERTURE
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

        const db = readDB();
        if (db.tickets[message.channel.id]) {
            db.tickets[message.channel.id].lastActivity = Date.now();
            db.tickets[message.channel.id].messageCount = (db.tickets[message.channel.id].messageCount || 0) + 1;
            writeDB(db);
        }

        if (message.content.startsWith("+test modérateur")) {
            const allowedRoles = config.ROLES.staff;
            const isStaff = message.member.roles.cache.some(r => allowedRoles.includes(r.id)) || message.member.permissions.has(PermissionsBitField.Flags.ManageChannels);
            if (!isStaff) return message.reply("❌ Tu n'as pas l'autorisation de lancer un test modérateur.");

            const targetUser = message.mentions.members.first();
            if (!targetUser) return message.reply("❌ Tu dois mentionner un membre.");

            await targetUser.roles.add(config.TEST_MODO_ROLE).catch(() => {});
            await message.channel.permissionOverwrites.edit(targetUser.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }).catch(() => {});

            return message.reply({ embeds: [new EmbedBuilder().setColor("#3498db").setTitle("🛡️ ÉVALUATION TEST MODÉRATEUR").setDescription(`Bienvenue ${targetUser} dans ton espace de test.`)] });
        }
    });

    // =====================================================
    // 3. GESTION DES INTERACTIONS (BOUTONS & MENUS)
    // =====================================================
    client.on("interactionCreate", async (i) => {
        if (!i.guild) return;

        // Anti-Spam / Double Click
        if (i.isButton() || i.isStringSelectMenu()) {
            const cooldownKey = `${i.user.id}-${i.customId}`;
            if (globalCooldowns.has(cooldownKey)) return i.reply({ content: "⏳ Un peu de patience, ne clique pas si vite.", ephemeral: true });
            globalCooldowns.add(cooldownKey);
            setTimeout(() => globalCooldowns.delete(cooldownKey), 1500);
        }

        // --- A. OUVERTURE DES TICKETS ---
        if (i.isStringSelectMenu() && i.customId === "ticket_select") {
            const type = i.values[0];
            const db = readDB();

            if (db.blacklist.includes(i.user.id)) return i.reply({ content: "❌ Tu es banni du système de tickets.", ephemeral: true });

            const hasActiveTicket = Object.values(db.tickets).some(t => t.userId === i.user.id && t.status === "open");
            if (hasActiveTicket) return i.reply({ content: "⏳ Tu as déjà un ticket ouvert.", ephemeral: true });

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
            const infoEmbed = new EmbedBuilder().setColor("#2f3136").setDescription(`👤 **Demandeur :** ${i.user} (${i.user.id})`);

            if (type === "joueur") {
                mainEmbed.setDescription(`Espace de recrutement Joueur.\n\nClique sur le bouton ci-dessous pour lancer ton intégration automatique via tes PR.`);
                actionButtons.addComponents(new ButtonBuilder().setCustomId("form_joueur").setLabel("Formulaire").setStyle(ButtonStyle.Success).setEmoji("🧾"));
                await ticketChannel.send({ content: `<@${i.user.id}>`, embeds: [mainEmbed, infoEmbed], components: [actionButtons, utilityButtons] });
            } 
            else if (type === "staff") {
                mainEmbed.setDescription(`Espace de recrutement Staff.\n\nMerci de cliquer sur le bouton ci-dessous pour remplir ton dossier.`);
                actionButtons.addComponents(new ButtonBuilder().setCustomId("form_staff").setLabel("Dossier Recrutement").setStyle(ButtonStyle.Primary).setEmoji("🛡️"));
                await ticketChannel.send({ content: `<@${i.user.id}>`, embeds: [mainEmbed, infoEmbed], components: [actionButtons, utilityButtons] });
            } 
            else if (type === "audiovisuel") {
                mainEmbed.setDescription("Espace Audiovisuel. Sélectionne ta spécialité ci-dessous :");
                const audioMenu = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("audio_form_select")
                        .setPlaceholder("Choisis ton domaine...")
                        .addOptions([
                            { label: "Monteur", value: "monteur", emoji: "🎥" },
                            { label: "Graphiste", value: "graphiste", emoji: "🎨" },
                            { label: "Mapper", value: "mapper", emoji: "🗺️" }
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

        // --- B. FORMULAIRE RECRUTEMENT JOUEUR (ACCESSIBLE À TOUS) ---
        if (i.isButton() && i.customId === "form_joueur") {
            const db = readDB();
            const context = db.tickets[i.channel.id];
            if (!context || context.userId !== i.user.id) return i.reply({ content: "❌ Seul le créateur du ticket peut remplir ce formulaire.", ephemeral: true });

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
                    .addFields({ name: "🎮 Epic", value: epic, inline: true }, { name: "🏆 Score PR", value: `${prValue} PR`, inline: true }, { name: "🏷️ Rôle Donné", value: `<@&${finalRole}> (${roleName})` });
                await logChannel.send({ embeds: [logEmbed] });
            }

            const followUpEmbed = new EmbedBuilder().setColor("Green").setTitle("✅ Rôle Attribué !").setDescription(`Tes données ont été enregistrées. Le rôle **${roleName}** t'a été donné.\n\n**Question 1 :** As-tu besoin d'aide supplémentaire concernant ce rôle ?`);
            const helpRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("follow_help_yes").setLabel("Oui").setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId("follow_help_no").setLabel("Non").setStyle(ButtonStyle.Secondary));
            await i.channel.send({ content: `<@${i.user.id}>`, embeds: [followUpEmbed], components: [helpRow] });
            return i.editReply({ content: "Formulaire traité avec succès !" });
        }

        // --- C. FORMULAIRE STAFF (ACCESSIBLE À TOUS) ---
        if (i.isButton() && i.customId === "form_staff") {
            const db = readDB(); const context = db.tickets[i.channel.id];
            if (!context || context.userId !== i.user.id) return i.reply({ content: "❌ Seul le créateur du ticket peut faire cela.", ephemeral: true });

            const modal = new ModalBuilder().setCustomId("staff_modal_submit").setTitle("Candidature Staff");
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("age").setLabel("Âge").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("xp").setLabel("Expériences").setStyle(TextInputStyle.Paragraph).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("motivation").setLabel("Motivations").setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
            return i.showModal(modal);
        }

        if (i.isModalSubmit() && i.customId === "staff_modal_submit") {
            await i.deferReply({ ephemeral: true });
            await i.channel.send({ embeds: [new EmbedBuilder().setColor("Green").setTitle("📝 Envoi réussi !").setDescription("Candidature transmise au Staff.")] });
            return i.editReply({ content: "Envoyé !" });
        }

        // --- D. FORMULAIRE AUDIOVISUEL (ACCESSIBLE À TOUS) ---
        if (i.isStringSelectMenu() && i.customId === "audio_form_select") {
            const db = readDB(); const context = db.tickets[i.channel.id];
            if (!context || context.userId !== i.user.id) return i.reply({ content: "❌ Non autorisé.", ephemeral: true });

            const choice = i.values[0];
            const modal = new ModalBuilder().setCustomId(`audio_submit_${choice}`).setTitle(`Formulaire ${choice.toUpperCase()}`);
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("portfolio").setLabel("Lien Portfolio").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("motivation").setLabel("Motivations").setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
            return i.showModal(modal);
        }

        if (i.isModalSubmit() && i.customId.startsWith("audio_submit_")) {
            await i.deferReply({ ephemeral: true });
            const specialty = i.customId.split("_").pop();
            const autoRole = config.AUDIO_ROLES[specialty];
            if (autoRole) await i.member.roles.add(autoRole).catch(() => {});

            await i.channel.send({ embeds: [new EmbedBuilder().setColor("Purple").setTitle("🎬 Rôle Attribué !").setDescription(`Ton rôle associé à la catégorie **${specialty.toUpperCase()}** a été configuré.`)] });
            return i.editReply({ content: "Validé !" });
        }

        // --- E. ENCHAÎNEMENT DES QUESTIONS SUIVANTES ---
        if (i.isButton() && ["follow_help_yes", "follow_help_no", "follow_struct_yes", "follow_struct_no"].includes(i.customId)) {
            const db = readDB(); const context = db.tickets[i.channel.id];
            if (!context || i.user.id !== context.userId) return i.reply({ content: "❌ Non autorisé.", ephemeral: true });
            await i.deferUpdate();

            if (i.customId === "follow_help_yes" || i.customId === "follow_help_no") {
                const structRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("follow_struct_yes").setLabel("Oui").setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId("follow_struct_no").setLabel("Non").setStyle(ButtonStyle.Secondary));
                await i.channel.send({ embeds: [new EmbedBuilder().setColor("#34495e").setTitle("❓ Structure").setDescription("As-tu des questions sur la HoveX ?")], components: [structRow] });
            }
            if (i.customId === "follow_struct_no") {
                await i.channel.send({ content: "🏁 Clôture et archivage automatique..." });
                await generateSystemClose(i.channel, client, context);
            }
        }

        // --- F. BOUTONS UTILITAIRES (MODÉRATEURS UNIQUEMENT) ---
        if (i.isButton() && ["ticket_add_user", "ticket_remove_user", "ticket_create_voice"].includes(i.customId)) {
            const db = readDB(); const context = db.tickets[i.channel.id];
            const hasAccess = i.member.permissions.has(PermissionsBitField.Flags.ManageChannels) || i.member.roles.cache.some(r => (config.ROLES[context ? context.type : "autre"] || []).includes(r.id));
            if (!hasAccess) return i.reply({ content: "❌ Action réservée aux modérateurs.", ephemeral: true });

            if (i.customId === "ticket_add_user" || i.customId === "ticket_remove_user") {
                const modal = new ModalBuilder().setCustomId(`modal_user_${i.customId}`).setTitle("Membres");
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("user_id").setLabel("ID Discord").setStyle(TextInputStyle.Short).setRequired(true)));
                return i.showModal(modal);
            }

            if (i.customId === "ticket_create_voice") {
                await i.deferReply();
                const voiceChannel = await i.guild.channels.create({ name: `🔊 Entretien-${i.channel.name.split("-")[1] || ""}`, type: ChannelType.GuildVoice, parent: i.channel.parentId, permissionOverwrites: i.channel.permissionOverwrites.cache.map(p => p) });
                return i.editReply({ content: `🔊 Salon vocal d'entretien éphémère actif : ${voiceChannel}` });
            }
        }

        // Soumissions Modals Add/Remove Membre
        if (i.isModalSubmit() && i.customId.startsWith("modal_user_")) {
            await i.deferReply({ ephemeral: true });
            const actionType = i.customId.includes("add") ? "add" : "remove";
            const targetId = i.fields.getTextInputValue("user_id");
            const targetMember = await i.guild.members.fetch(targetId).catch(() => null);

            if (!targetMember) return i.editReply({ content: "❌ ID introuvable." });

            if (actionType === "add") {
                await i.channel.permissionOverwrites.edit(targetMember.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
                await i.channel.send({ content: `➕ ${targetMember} a été ajouté au ticket.` });
            } else {
                await i.channel.permissionOverwrites.delete(targetMember.id);
                await i.channel.send({ content: `➖ ${targetMember} a été retiré du ticket.` });
            }
            return i.editReply({ content: "Permissions mises à jour." });
        }

        // --- G. ACTIONS EXCLUSIVES DU STAFF (CLAIM, CLOSE, SUPPRESSION) ---
        if (i.isButton() && ["claim", "close", "delete", "force_close_confirm", "cancel_close"].includes(i.customId)) {
            const db = readDB(); const context = db.tickets[i.channel.id];
            const hasAccess = i.member.roles.cache.some(r => (config.ROLES[context ? context.type : "autre"] || []).includes(r.id)) || i.member.permissions.has(PermissionsBitField.Flags.ManageChannels);
            
            if (!hasAccess && !["cancel_close"].includes(i.customId)) {
                return i.reply({ content: "❌ Action non autorisée. Rôles Staff requis.", ephemeral: true });
            }

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
                    new ButtonBuilder().setCustomId("force_close_confirm").setLabel("Supprimer le salon").setStyle(ButtonStyle.Danger).setEmoji("🗑️"),
                    new ButtonBuilder().setCustomId("cancel_close").setLabel("Réouvrir l'accès").setStyle(ButtonStyle.Secondary).setEmoji("🔓")
                );
                return i.reply({ embeds: [new EmbedBuilder().setColor("#f1c40f").setTitle("🔒 Options de fermeture").setDescription("Voulez-vous supprimer définitivement ce ticket ?")], components: [closeConfirmRow] });
            }

            if (i.customId === "cancel_close") {
                if (context) await i.channel.permissionOverwrites.edit(context.userId, { ViewChannel: true, SendMessages: true }).catch(() => null);
                await i.message.delete().catch(() => {});
                return i.reply({ content: "🔓 Accès rétablis pour l'utilisateur." });
            }

            if (i.customId === "delete" || i.customId === "force_close_confirm") {
                await i.reply({ content: "⏳ Compilation des logs et suppression en cours..." });
                await generateSystemClose(i.channel, client, context);
            }
        }
    });
};

// Fonction globale d'archivage et de suppression
async function generateSystemClose(channel, client, context) {
    try {
        const archiveChannel = await client.channels.fetch(ARCHIVE_CHANNEL).catch(() => null);
        if (archiveChannel && context) {
            const endEmbed = new EmbedBuilder()
                .setColor("Red")
                .setTitle(`📁 Archive - ${channel.name}`)
                .setDescription(`Demandeur : <@${context.userId}>\nType : ${context.type}\nMessages : ${context.messageCount}`);
            await archiveChannel.send({ embeds: [endEmbed] });
        }
        
        const db = readDB();
        delete db.tickets[channel.id];
        writeDB(db);
        
        setTimeout(() => channel.delete().catch(() => {}), 2000);
    } catch (e) {
        console.error(e);
    }
}
