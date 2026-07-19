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

// SYSTEM ROUTING IDS
const LOGS_CHANNEL = "1528213677860458566";
const ARCHIVE_CHANNEL = "1528214540603359272";
const AVIS_CHANNEL = "1528214604428083330"; 

// LOCAL DB ENGINE (STABILITY & STATISTICS)
const DB_PATH = path.join(__dirname, "../data/ticket_database.json");

if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({ tickets: {}, blacklist: [], stats: {} }, null, 4));

function readDB() { return JSON.parse(fs.readFileSync(DB_PATH, "utf-8")); }
function writeDB(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 4), "utf-8"); }

const globalCooldowns = new Set();

module.exports = async (client) => {

    console.log("[🎫 TICKET SYSTEM] Chargement de la configuration Premium Aeroz Esports...");

    // =====================================================
    // 1. LIFECYCLE : MAIN PANEL SYNC
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
            .setDescription("Sélectionnez la catégorie adaptée à votre demande pour ouvrir un accès privé :\n\n🛡️ **Recrutement Staff**\n🎮 **Recrutement Joueur**\n🎬 **Recrutement Audiovisuel**\n🆘 **Assistance Générale**\n🤝 **Demande de Partenariat**")
            .setFooter({ text: "Aeroz Automations • Cliquez ci-dessous" });

        const menuSelection = new StringSelectMenuBuilder()
            .setCustomId("ticket_select")
            .setPlaceholder("Sélectionnez votre catégorie...")
            .addOptions([
                { label: "Recrutement Staff", value: "staff", emoji: "🛡️" },
                { label: "Recrutement Joueur", value: "joueur", emoji: "🎮" },
                { label: "Recrutement Audiovisuel", value: "audiovisuel", emoji: "🎬" },
                { label: "Assistance Générale", value: "aide", emoji: "🆘" },
                { label: "Demande de Partenariat", value: "partenariat", emoji: "🤝" }
            ]);

        await panelChannel.send({
            embeds: [panelEmbed],
            components: [new ActionRowBuilder().addComponents(menuSelection)]
        }).catch(() => {});
    }

    // =====================================================
    // 2. DISPATCHER : ACTIVITY TRACKING & TEST MODO
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
    // 3. CENTRAL INTERACTION MANAGER
    // =====================================================
    client.on("interactionCreate", async (i) => {
        
        // --- DM CHANNELS HANDLE (REVIEWS / FEEDBACKS) ---
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

        // --- GLOBAL ANTI-SPAM SYSTEM ---
        if (i.isButton() || i.isStringSelectMenu()) {
            const cooldownKey = `${i.user.id}-${i.customId}`;
            if (globalCooldowns.has(cooldownKey)) return i.reply({ content: "⏳ Action trop rapide, veuillez patienter.", ephemeral: true });
            globalCooldowns.add(cooldownKey);
            setTimeout(() => globalCooldowns.delete(cooldownKey), 1200);
        }

        const db = readDB();
        const context = db.tickets[i.channel.id];

        // --- A. TICKET GENERATION GATEWAY (MANUAL CONTEXT ONLY) ---
        if (i.isStringSelectMenu() && i.customId === "ticket_select") {
            // SÉCURITÉ DOUBLE CRÉATION TICKET
            if (i.replied || i.deferred) return;

            const type = i.values[0];
            if (db.blacklist.includes(i.user.id)) return i.reply({ content: "❌ Vous êtes banni du système de support.", ephemeral: true });

            const hasActiveTicket = Object.values(db.tickets).some(t => t.userId === i.user.id && t.status === "open");
            if (hasActiveTicket) return i.reply({ content: "⏳ Vous possédez déjà un ticket ouvert.", ephemeral: true });

            await i.deferReply({ ephemeral: true });

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

            // PRÉPARATION DE L'EMBED DU FORMULAIRE COMPLET ET STYLISÉ
            let formEmbed = new EmbedBuilder().setTimestamp();

            if (type === "joueur") {
                formEmbed.setColor("#3498db")
                    .setTitle("🎮・Recrutement Joueur Fortnite")
                    .setDescription("> Merci de répondre à toutes les questions avec sérieux. Chaque candidature est étudiée par notre staff.\n\n" +
                        "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                        "👤 **Informations générales**\n" +
                        "・Pseudo Epic Games :\n" +
                        "・Âge :\n" +
                        "・Pays :\n" +
                        "・Plateforme (PC / PS5 / Xbox / Switch / Mobile) :\n\n" +
                        "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                        "🏆 **Parcours compétitif**\n" +
                        "・Power Ranking (PR) :\n" +
                        "・As-tu déjà fait partie d'une structure ? Si oui, laquelle ?\n\n" +
                        "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                        "🎯 **Motivation**\n" +
                        "・Quelles sont tes ambitions sur Fortnite ?\n" +
                        "・Pourquoi souhaites-tu rejoindre notre structure ?\n" +
                        "・Que peux-tu apporter à l'équipe ?\n" +
                        "・Es-tu prêt à représenter la structure avec sérieux et professionnalisme ? (Oui / Non)\n\n" +
                        "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                        "📝 **Dernier mot**\n" +
                        "・As-tu un dernier message à adresser au staff ?\n\n" +
                        "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                        "✅ *Merci pour ta candidature ! Notre équipe examinera tes réponses sous peu.*");
            } 
            else if (type === "staff") {
                formEmbed.setColor("#e74c3c")
                    .setTitle("🛡️・Recrutement Staff")
                    .setDescription("> Merci de répondre à chaque question avec sérieux. Les réponses incomplètes pourront entraîner un refus.\n\n" +
                        "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                        "👤 **Informations générales**\n" +
                        "・Pseudo Discord :\n" +
                        "・Âge :\n" +
                        "・Pays :\n" +
                        "・Depuis combien de temps utilises-tu Discord ?\n\n" +
                        "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                        "📋 **Expérience**\n" +
                        "・As-tu déjà été membre du staff d'un serveur ? (Oui / Non)\n" +
                        "・Si oui, quel(s) poste(s) as-tu occupé ?\n" +
                        "・Pourquoi as-tu quitté ton ou tes anciens serveurs ?\n" +
                        "・Quelle est ton expérience en modération Discord ?\n\n" +
                        "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                        "🎯 **Motivation**\n" +
                        "・Pourquoi souhaites-tu rejoindre notre staff ?\n" +
                        "・Pourquoi devrions-nous te choisir ?\n" +
                        "・Que peux-tu apporter à la structure ?\n" +
                        "・Es-tu prêt à t'investir sur le long terme ? Pourquoi ?\n\n" +
                        "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                        "🛡️ **Connaissances & Sécurité**\n" +
                        "・Que ferais-tu en cas de raid sur le serveur ?\n" +
                        "・Comment réagirais-tu face à un spam massif ?\n" +
                        "・Que ferais-tu si un membre diffusait du contenu pornographique, gore ou illégal ?\n" +
                        "・Que ferais-tu si un membre contournait une sanction avec un autre compte ?\n" +
                        "・Que ferais-tu si un membre du staff abusait de ses permissions ?\n\n" +
                        "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                        "🧠 **Mises en situation** (Réponds en détail) :\n" +
                        "**1️⃣** Un raid de plusieurs dizaines de comptes commence à spammer.\n" +
                        "**2️⃣** Un membre publie plusieurs images pornographiques dans différents salons.\n" +
                        "**3️⃣** Tu surprends un autre staff qui favorise ses amis.\n\n" +
                        "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                        "⭐ **Engagement**\n" +
                        "・Es-tu capable de rester calme sous pression ?\n" +
                        "・Es-tu prêt à respecter les décisions de la direction ? (Oui / Non)\n" +
                        "・Es-tu prêt à appliquer le règlement, même à un ami ? (Oui / Non)\n\n" +
                        "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                        "📝 **Dernier mot**\n" +
                        "・As-tu un dernier message à adresser à la direction ?");
            } 
            else if (type === "audiovisuel") {
                formEmbed.setColor("#9b59b6")
                    .setTitle("🎨・Recrutement Audiovisuel")
                    .setDescription("> Merci de répondre à chaque question avec sérieux. Toutes les candidatures sont étudiées.\n\n" +
                        "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                        "👤 **Informations générales**\n" +
                        "・Pseudo Discord :\n" +
                        "・Âge :\n" +
                        "・Pays :\n\n" +
                        "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                        "🎬 **Spécialité**\n" +
                        "・Pour quel(s) poste(s) candidatures-tu ? (Graphiste, Monteur, Caster, Content Creator, Mapper) :\n" +
                        "・Depuis combien de temps pratiques-tu cette spécialité ?\n" +
                        "・Quel est ton niveau selon toi ? (Débutant / Intermédiaire / Avancé / Expert) :\n\n" +
                        "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                        "📂 **Expérience**\n" +
                        "・As-tu déjà travaillé pour une structure ou un projet ? Si oui, lequel ?\n" +
                        "・Décris rapidement ton expérience.\n" +
                        "・Peux-tu nous montrer quelques-unes de tes réalisations ? (Portfolio, chaîne, Behance, Drive, etc.) :\n\n" +
                        "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                        "🛠️ **Compétences**\n" +
                        "・Quels logiciels maîtrises-tu ?\n" +
                        "・Quelles sont tes principales qualités dans ton domaine ?\n" +
                        "・Quel est ton plus gros point faible ?\n\n" +
                        "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                        "🎯 **Motivation**\n" +
                        "・Pourquoi souhaites-tu rejoindre notre structure ?\n" +
                        "・Que peux-tu apporter à notre équipe ?\n" +
                        "・Quels sont tes objectifs en nous rejoignant ?\n\n" +
                        "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                        "⭐ **Engagement**\n" +
                        "・Combien de temps peux-tu consacrer au projet chaque semaine ?\n" +
                        "・Es-tu capable de respecter des délais ? (Oui / Non)\n" +
                        "・Acceptes-tu les retours et les demandes de modifications ? (Oui / Non)\n\n" +
                        "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                        "📝 **Dernier mot**\n" +
                        "・As-tu un dernier message à adresser à la direction ?");
            } 
            else if (type === "aide") {
                formEmbed.setColor("#f1c40f")
                    .setTitle("📩・Assistance Générale")
                    .setDescription("> Remplis ce formulaire afin que notre équipe puisse t'aider le plus rapidement possible.\n\n" +
                        "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                        "👤 **Informations**\n" +
                        "・Pseudo Discord :\n" +
                        "・Concerné par un autre membre ? Si oui, lequel ?\n\n" +
                        "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                        "📋 **Votre demande**\n" +
                        "・Quelle est la nature de votre problème ?\n" +
                        "・Depuis quand ce problème est-il présent ?\n" +
                        "・Décrivez précisément la situation.\n\n" +
                        "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                        "📎 **Preuves**\n" +
                        "・Disposez-vous de captures d'écran, vidéos ou autres preuves ? (Oui / Non) :\n" +
                        "・*Si oui, merci de les joindre directement dans ce ticket.*\n\n" +
                        "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                        "🛠️ **Informations complémentaires**\n" +
                        "・Avez-vous déjà essayé de résoudre le problème ? Si oui, comment ?\n" +
                        "・Y a-t-il des informations importantes que le staff doit connaître ?\n\n" +
                        "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                        "📝 **Dernier mot**\n" +
                        "・Souhaitez-vous ajouter quelque chose avant la prise en charge ?");
            } 
            else if (type === "partenariat") {
                formEmbed.setColor("#2ecc71")
                    .setTitle("🤝・Demande de Partenariat")
                    .setDescription("> Merci de compléter ce formulaire avec sérieux. Toute demande incomplète pourra être refusée.\n\n" +
                        "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                        "🏷️ **Informations**\n" +
                        "・Nom du serveur / de la structure :\n" +
                        "・Lien d'invitation Discord :\n" +
                        "・Nombre de membres :\n" +
                        "・Date de création du serveur :\n\n" +
                        "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                        "📈 **Présentation**\n" +
                        "・Présentez rapidement votre projet.\n" +
                        "・Quels sont les principaux thèmes de votre serveur ?\n" +
                        "・Pourquoi souhaitez-vous établir un partenariat avec nous ?\n\n" +
                        "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                        "🤝 **Le partenariat**\n" +
                        "• Quel type de partenariat recherchez-vous ? (Échange de pub, événement commun, sponsor...) :\n" +
                        "・Que pouvez-vous apporter à notre structure ?\n" +
                        "・Que souhaitez-vous obtenir en retour ?\n\n" +
                        "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                        "📜 **Engagement**\n" +
                        "・Acceptez-vous de respecter les conditions de notre partenariat ? (Oui / Non)\n" +
                        "・Votre serveur respecte-t-il les Conditions d'utilisation de Discord ? (Oui / Non)\n\n" +
                        "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                        "📝 **Dernier mot**\n" +
                        "・Avez-vous un dernier message à adresser à notre équipe ?");
            }

            // ENVOI DU TICKET AVEC LE PING @here ET LE FORMULAIRE À REMPLIR
            await ticketChannel.send({ 
                content: `👋 Bonjour ${i.user} | 🔔 @here un nouveau dossier vient d'être ouvert !`, 
                embeds: [formEmbed], 
                components: [actionButtons, utilityButtons] 
            });

            return i.editReply({ content: `✅ Votre salon privé a été initialisé : ${ticketChannel}` });
        }

        // --- B. SECURED MODERATION UTILITIES ---
        const isStaffUser = context ? (config.ROLES[context.type] || []).some(rId => i.member.roles.cache.has(rId)) || i.member.permissions.has(PermissionsBitField.Flags.ManageChannels) : i.member.permissions.has(PermissionsBitField.Flags.ManageChannels);

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

        // --- C. ACTION PANEL ROUTING (CLAIM / CLOSURE Pipeline) ---
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
                writeDB(db);

                await i.channel.setName(`📌-${i.channel.name}`).catch(() => {});
                
                const updatedRow = ActionRowBuilder.from(i.message.components[0]);
                updatedRow.components[0] = new ButtonBuilder()
                    .setCustomId("claimed")
                    .setLabel(`Pris en charge par ${i.user.username}`)
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true)
                    .setEmoji("✅");

                await i.message.edit({ components: [updatedRow, i.message.components[1]] }).catch(() => {});
                return i.channel.send({ embeds: [new EmbedBuilder().setColor("Green").setDescription(`🤝 **${i.user.username}** a pris en charge ce dossier et s'occupe de votre demande.`)] });
            }

            if (i.customId === "close") {
                await i.deferUpdate();
                const confirmEmbed = new EmbedBuilder().setColor("Red").setDescription("⚠️ **Êtes-vous sûr de vouloir fermer ce ticket définitivement ?**\nUn transcript complet de la conversation sera généré.");
                const confirmRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("force_close_confirm").setLabel("Confirmer la fermeture").setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId("cancel_close").setLabel("Annuler").setStyle(ButtonStyle.Secondary)
                );
                return i.channel.send({ embeds: [confirmEmbed], components: [confirmRow] });
            }

            if (i.customId === "cancel_close") {
                await i.deferUpdate();
                await i.message.delete().catch(() => {});
                return i.channel.send("❌ Clôture annulée par le Staff.");
            }

            if (i.customId === "force_close_confirm" || i.customId === "delete") {
                await i.reply("⏳ *Génération du transcript et traitement des archives en cours...*");
                return await generateSystemClose(i.channel, client, context, i.user);
            }
        }
    });
};

// =====================================================
// TRANSCRIPT GENERATOR & CLOSURE ENGINE
// =====================================================
async function generateSystemClose(channel, client, context, staffUser) {
    try {
        const messages = await channel.messages.fetch({ limit: 100 });
        let transcriptText = `TRANSCRIPT AEROZ ESPORTS — SALON : ${channel.name}\n`;
        transcriptText += `Créé par : ${context ? context.username : "Inconnu"} (ID: ${context ? context.userId : "N/A"})\n`;
        transcriptText += `Clôturé par : ${staffUser ? staffUser.tag : "Système"}\n`;
        transcriptText += `Date : ${new Date().toLocaleString()}\n`;
        transcriptText += `=========================================\n\n`;

        const sorted = Array.from(messages.values()).reverse();
        sorted.forEach(m => {
            transcriptText += `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}\n`;
        });

        const filename = `transcript-${channel.id}.txt`;
        const tempPath = path.join(__dirname, filename);
        fs.writeFileSync(tempPath, transcriptText, "utf-8");

        const attachment = new AttachmentBuilder(tempPath, { name: filename });

        const summaryEmbed = new EmbedBuilder()
            .setColor("Red")
            .setTitle("📁 Archive de Ticket Disponible")
            .setDescription(`• **Salon :** \`${channel.name}\`\n• **Demandeur :** <@${context ? context.userId : "1501625944148934758"}>\n• **Fermé par :** ${staffUser ? staffUser : "Automatique"}`)
            .setTimestamp();

        // 1. Envoi au salon d'archive global
        const archChan = await client.channels.fetch(ARCHIVE_CHANNEL).catch(() => null);
        if (archChan) await archChan.send({ embeds: [summaryEmbed], files: [attachment] });

        // 2. Envoi au salon des logs
        const logChan = await client.channels.fetch(LOGS_CHANNEL).catch(() => null);
        if (logChan) await logChan.send({ embeds: [summaryEmbed] });

        // 3. Envoi du questionnaire d'évaluation en DM au membre
        if (context && context.userId) {
            const targetMember = await channel.guild.members.fetch(context.userId).catch(() => null);
            if (targetMember) {
                const claimedStaff = context.claimedBy || client.user.id;
                const reviewRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`rate_5_${claimedStaff}`).setLabel("5 ⭐").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`rate_4_${claimedStaff}`).setLabel("4 ⭐").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`rate_3_${claimedStaff}`).setLabel("3 ⭐").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`rate_2_${claimedStaff}`).setLabel("2 ⭐").setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId(`rate_1_${claimedStaff}`).setLabel("1 ⭐").setStyle(ButtonStyle.Danger)
                );
                await targetMember.send({
                    embeds: [new EmbedBuilder().setColor("Gold").setTitle("✨ Votre avis compte — Aeroz Esports").setDescription("Votre ticket vient d'être pris en charge ou validé. Merci de noter l'efficacité et la réponse apportée par notre équipe à l'aide des boutons ci-dessous :")],
                    components: [reviewRow]
                }).catch(() => {});
            }
        }

        fs.unlinkSync(tempPath);

        const db = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/ticket_database.json"), "utf-8"));
        if (db.tickets[channel.id]) {
            if (context && context.claimedBy && db.stats[context.claimedBy]) {
                db.stats[context.claimedBy].closedTickets = (db.stats[context.claimedBy].closedTickets || 0) + 1;
            }
            delete db.tickets[channel.id];
            fs.writeFileSync(path.join(__dirname, "../data/ticket_database.json"), JSON.stringify(db, null, 4));
        }

        setTimeout(() => channel.delete().catch(() => {}), 2000);
    } catch (err) {
        console.error("Erreur lors de la fermeture du ticket :", err);
        channel.delete().catch(() => {});
    }
}
