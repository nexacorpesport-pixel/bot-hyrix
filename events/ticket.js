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

// Identifiants des salons de logs et d'archives
const LOGS_CHANNEL = "1508157026491175002";
const ARCHIVE_CHANNEL = "1510019228047114300";

// Structures de stockage en mémoire
const ticketCooldown = new Map();
const sessionContext = new Map();

module.exports = async (client) => {

    console.log("[TICKET] Initialisation du système complet HoveX (Tout-en-un)...");

    // =====================================================
    // 1. DÉPLOIEMENT DU PANEL PRINCIPAL
    // =====================================================
    const panelChannel = await client.channels.fetch(config.PANEL_CHANNEL).catch(() => null);
    if (panelChannel) {
        // Nettoyage des anciens messages du bot pour éviter les doublons au redémarrage
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

        // Commande textuelle : +test modérateur @membre
        if (message.content.startsWith("+test modérateur")) {
            const allowedRoles = config.ROLES.staff;
            const isStaff = message.member.roles.cache.some(r => allowedRoles.includes(r.id)) || message.member.permissions.has(PermissionsBitField.Flags.ManageChannels);
            
            if (!isStaff) return message.reply("❌ Tu n'as pas l'autorisation de lancer un test modérateur.");

            const targetUser = message.mentions.members.first();
            if (!targetUser) return message.reply("❌ Tu devez mentionner un membre. Exemple : `+test modérateur @Pseudo`_");

            // Attribution automatique du rôle Test Modérateur configuré
            await targetUser.roles.add(config.TEST_MODO_ROLE).catch(() => {});

            // Ouverture des accès au salon actuel pour le modérateur en test
            await message.channel.permissionOverwrites.edit(targetUser.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            }).catch(() => {});

            const testEmbed = new EmbedBuilder()
                .setColor("#3498db")
                .setTitle("🛡️ ÉVALUATION TEST MODÉRATEUR")
                .setDescription(`Bienvenue ${targetUser} dans ton espace de test de modération !

Le rôle <@&${config.TEST_MODO_ROLE}> t'a été attribué. C'est ici que tu vas devoir faire tes preuves face au Staff de la **HoveX**.

**Tes objectifs :**
* Répondre aux questions du staff avec pertinence.
* Prouver ton sérieux, ton calme et ton activité.
* Montrer ta maîtrise des règles de la structure.

Bonne chance à toi !`);

            return message.reply({ embeds: [testEmbed] });
        }
    });

    // =====================================================
    // 3. GESTION DE TOUTES LES INTERACTIONS
    // =====================================================
    client.on("interactionCreate", async (i) => {
        if (!i.guild) return;

        // --- A. OUVERTURE AUTOMATIQUE DES TICKETS ---
        if (i.isStringSelectMenu() && i.customId === "ticket_select") {
            const type = i.values[0];
            if (ticketCooldown.has(i.user.id)) return i.reply({ content: "⏳ Tu as déjà un ticket actif.", ephemeral: true });

            const categoryId = config.CATEGORIES[type];
            ticketCooldown.set(i.user.id, true);

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

            sessionContext.set(ticketChannel.id, { userId: i.user.id, type: type });

            const actionButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Primary).setEmoji("📌"),
                new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(ButtonStyle.Secondary).setEmoji("🔒"),
                new ButtonBuilder().setCustomId("delete").setLabel("Delete").setStyle(ButtonStyle.Danger).setEmoji("🗑️")
            );

            let mainEmbed = new EmbedBuilder().setColor("#ffb347").setTitle(`🎫 Ticket ${type.toUpperCase()} Ouvert`);

            if (type === "joueur") {
                mainEmbed.setDescription(`Espace de recrutement Joueur.\n\nClique sur le bouton ci-dessous pour lancer ton intégration automatique via tes PR.`);
                actionButtons.addComponents(new ButtonBuilder().setCustomId("form_joueur").setLabel("Formulaire").setStyle(ButtonStyle.Success).setEmoji("🧾"));
                await ticketChannel.send({ content: `<@${i.user.id}>`, embeds: [mainEmbed], components: [actionButtons] });
            } 
            else if (type === "staff") {
                mainEmbed.setDescription(`Espace de recrutement Staff (Modération/Animation).\n\nMerci de cliquer sur le bouton ci-dessous pour remplir ton dossier de candidature complet.`);
                actionButtons.addComponents(new ButtonBuilder().setCustomId("form_staff").setLabel("Dossier Recrutement").setStyle(ButtonStyle.Primary).setEmoji("🛡️"));
                await ticketChannel.send({ content: `<@${i.user.id}>`, embeds: [mainEmbed], components: [actionButtons] });
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
                await ticketChannel.send({ content: `<@${i.user.id}>`, embeds: [mainEmbed], components: [actionButtons] });
                await ticketChannel.send({ components: [audioMenu] });
            } else {
                mainEmbed.setDescription(`Bonjour ${i.user}, décris ta demande ici, un membre du staff va te répondre.`);
                await ticketChannel.send({ content: `<@${i.user.id}>`, embeds: [mainEmbed], components: [actionButtons] });
            }

            return i.reply({ content: `✅ Ticket créé : ${ticketChannel}`, ephemeral: true });
        }

        // --- B. MODULE RECRUTEMENT JOUEUR (100% INTACT ET AUTOMATIQUE) ---
        if (i.isButton() && i.customId === "form_joueur") {
            const context = sessionContext.get(i.channel.id);
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
                if (prValue >= item.min && prValue < item.max) {
                    finalRole = item.role; roleName = item.name; break;
                }
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

        // --- C. MODULE RECRUTEMENT STAFF (LONG FORMULAIRE) ---
        if (i.isButton() && i.customId === "form_staff") {
            const context = sessionContext.get(i.channel.id);
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
                    .addFields(
                        { name: "🎂 Âge", value: fields[0], inline: true }, { name: "⏳ Dispos", value: fields[2], inline: true },
                        { name: "📁 Expériences", value: fields[1] }, { name: "⚡ Cas Pratique", value: fields[3] }, { name: "🎯 Motivations", value: fields[4] }
                    );
                await logChannel.send({ embeds: [staffLog] });
            }
            await i.channel.send({ embeds: [new EmbedBuilder().setColor("Green").setTitle("📝 Dossier envoyé !").setDescription("Ton dossier complet de modération a été transmis au haut-staff. Reste attentif, ils viendront te poser des questions ici même.")] });
            return i.editReply({ content: "Candidature Staff envoyée !" });
        }

        // --- D. MODULE AUDIOVISUEL (FORMULAIRES PAR SPÉCIALITÉ ET AUTO-ROLE) ---
        if (i.isStringSelectMenu() && i.customId === "audio_form_select") {
            const context = sessionContext.get(i.channel.id);
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

            // Rôle attribué directement selon la configuration
            const autoRole = config.AUDIO_ROLES[specialty];
            if (autoRole) await i.member.roles.add(autoRole).catch(() => {});

            const logChannel = await i.guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
            if (logChannel) {
                const audioLog = new EmbedBuilder().setColor("#9b59b6").setTitle(`🎬 Recrutement Audiovisuel [${specialty.toUpperCase()}]`).setDescription(`Membre : ${i.user}`)
                    .addFields({ name: "🔗 Portfolio", value: portfolio }, { name: "🛠️ Logiciels", value: softwares, inline: true }, { name: "⏳ Expérience", value: xp, inline: true }, { name: "📝 Motivation", value: motivation });
                await logChannel.send({ embeds: [audioLog] });
            }

            await i.channel.send({ embeds: [new EmbedBuilder().setColor("Purple").setTitle("🎬 Profil Enregistré Automatiquement !").setDescription(`Ton rôle de **${specialty.toUpperCase()}** t'a été attribué. Le pôle média va jeter un œil à ton portfolio ici-même !`)] });
            return i.editReply({ content: "Formulaire Audiovisuel pris en compte et validé !" });
        }

        // --- E. SUIVI DE L'ENCHAÎNEMENT DES QUESTIONS JOUEUR ---
        if (i.isButton() && ["follow_help_yes", "follow_help_no", "follow_struct_yes", "follow_struct_no"].includes(i.customId)) {
            const context = sessionContext.get(i.channel.id); if (!context || i.user.id !== context.userId) return i.reply({ content: "❌ Action non autorisée.", ephemeral: true });
            await i.deferUpdate();

            if (i.customId === "follow_help_yes" || i.customId === "follow_help_no") {
                const structRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("follow_struct_yes").setLabel("Oui").setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId("follow_struct_no").setLabel("Non").setStyle(ButtonStyle.Secondary));
                await i.channel.send({ embeds: [new EmbedBuilder().setColor("#34495e").setTitle("❓ Question Suivante").setDescription("As-tu des questions particulières à poser concernant le fonctionnement de notre structure (HoveX) ?")], components: [structRow] });
            }
            if (i.customId === "follow_struct_no") {
                await i.channel.send({ content: "🏁 Parfait, aucune question restante. Clôture automatique du ticket..." });
                await createTextArchive(i.channel, client);
                setTimeout(() => { ticketCooldown.delete(context.userId); i.channel.delete().catch(() => {}); }, 4000);
            }
            if (i.customId === "follow_struct_yes") {
                const menuCount = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("user_questions_count").setPlaceholder("Choisis le nombre...").addOptions([{ label: "1 Question", value: "1" }, { label: "2 Questions", value: "2" }, { label: "3 Questions ou plus", value: "3" }]));
                await i.channel.send({ embeds: [new EmbedBuilder().setColor("#2ecc71").setTitle("💬 Nombre de questions").setDescription("Combien de questions souhaites-tu soumettre à l'équipe ?")], components: [menuCount] });
            }
        }

        if (i.isStringSelectMenu() && i.customId === "user_questions_count") {
            const context = sessionContext.get(i.channel.id); if (!context || i.user.id !== context.userId) return;
            await i.reply({ content: `✍️ Tu as indiqué avoir **${i.values[0]}** question(s). Pose-les directement dans le chat, le staff arrive.` });
            const logChannel = await i.guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
            if (logChannel) logChannel.send({ embeds: [new EmbedBuilder().setColor("Orange").setTitle("❓ Question en attente").setDescription(`Le joueur ${i.user} attend une réponse dans ${i.channel}.`)] });
        }

        // --- F. COMMANDES STANDARDS DU STAFF DANS LES TICKETS ---
        if (i.isButton() && ["claim", "close", "delete"].includes(i.customId)) {
            const context = sessionContext.get(i.channel.id);
            const hasAccess = i.member.roles.cache.some(r => (config.ROLES[context ? context.type : "autre"] || []).includes(r.id)) || i.member.permissions.has(PermissionsBitField.Flags.ManageChannels);
            if (!hasAccess) return i.reply({ content: "❌ Réservé au staff.", ephemeral: true });

            if (i.customId === "claim") return i.reply({ content: `📌 Ticket pris en charge par ${i.user}.` });
            if (i.customId === "close") { if (context) await i.channel.permissionOverwrites.edit(context.userId, { ViewChannel: false }).catch(() => null); return i.reply({ content: "🔒 Ticket fermé pour l'utilisateur." }); }
            if (i.customId === "delete") {
                await i.reply({ content: "🗑️ Archivage et suppression définitive du salon..." });
                await createTextArchive(i.channel, client);
                setTimeout(() => { if (context) ticketCooldown.delete(context.userId); i.channel.delete().catch(() => {}); }, 3000);
            }
        }
    });
};

// =====================================================
// 4. SYSTÈME DE COMPILATION DES ARCHIVES TEXTUELLES (1H)
// =====================================================
async function createTextArchive(channel, client) {
    try {
        const fetchedMessages = await channel.messages.fetch({ limit: 100 });
        let logFormat = `--- LOGS DU SALON SUPPORT : ${channel.name} ---\n\n`;
        fetchedMessages.reverse().forEach(msg => { logFormat += `[${msg.createdAt.toLocaleString()}] ${msg.author.tag}: ${msg.content}\n`; });

        const destinationLog = await client.channels.fetch(ARCHIVE_CHANNEL).catch(() => null);
        if (destinationLog) {
            const textBuffer = Buffer.from(logFormat, "utf-8");
            const archivePost = await destinationLog.send({ content: `📁 Archive pour \`${channel.name}\`. (Auto-suppression dans 1 heure)`, files: [{ attachment: textBuffer, name: `log-${channel.name}.txt` }] });
            setTimeout(() => { archivePost.delete().catch(() => {}); }, 3600000);
        }
    } catch (e) { console.error(e); }
}
