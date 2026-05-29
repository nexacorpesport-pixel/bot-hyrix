const {
    ChannelType,
    PermissionsBitField,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    UserSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder
} = require("discord.js");
const fs = require("fs");
const path = require("path");

// =========================================
// CONFIGURATION DES IDENTIFIANTS
// =========================================
const TRIGGER_CHANNEL = "1507467019715481731";
const TEMP_CATEGORY = "1505330761153380476";
const LOGS_CHANNEL = "1508157067461132510";

// Rôles Staff autorisés à bypasser les salons privés et recevoir les alertes
const STAFF_ROLES = ["1506019438820987061", "1505330696619688027"]; // Mets ici les IDs de tes rôles Staff (Modo, Admin, etc.)

// =========================================
// STOCKAGE LOCAL & BASES DE DONNÉES
// =========================================
const tempChannels = new Map();
const nameCooldowns = new Map(); // Anti-RateLimit Discord (2 renommages / 10 min)

const DB_PATH = path.join(__dirname, "../data/voice_database.json");
if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({ savedConfigs: {} }, null, 4));

function readDB() { return JSON.parse(fs.readFileSync(DB_PATH, "utf-8")); }
function writeDB(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 4), "utf-8"); }

module.exports = (client) => {

    // =====================================================
    // 🛡️ ANTI-BUG : NETTOYAGE DES SALONS FANTÔMES AU DÉMARRAGE
    // =====================================================
    client.once("ready", async () => {
        console.log("[VOICE] Recherche et nettoyage des salons vocaux fantômes...");
        const category = await client.channels.fetch(TEMP_CATEGORY).catch(() => null);
        if (category && category.type === ChannelType.GuildCategory) {
            category.children.cache.forEach(async (channel) => {
                // Éviter de supprimer le salon de création (+ Créer un salon)
                if (channel.id === TRIGGER_CHANNEL) return;
                
                if (channel.type === ChannelType.GuildVoice && channel.members.size === 0) {
                    await channel.delete().catch(() => {});
                    console.log(`[VOICE] Salon fantôme vidé et supprimé : ${channel.name}`);
                }
            });
        }
    });

    // =====================================================
    // 🎧 GESTION DU VOICE UPDATE (Création & Suppression auto)
    // =====================================================
    client.on("voiceStateUpdate", async (oldState, newState) => {
        try {
            const member = newState.member;
            if (!member || member.user.bot) return;

            // ---- 1. REJOINDRE LE SALON "CRÉER UN SALON" ----
            if (newState.channelId === TRIGGER_CHANNEL) {
                const guild = member.guild;
                const db = readDB();
                const savedUserConfig = db.savedConfigs[member.id];

                let channelName = `🎧｜${member.user.username}`;
                let basePermissions = [
                    {
                        id: guild.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect]
                    },
                    {
                        id: member.id,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.Connect,
                            PermissionsBitField.Flags.Speak,
                            PermissionsBitField.Flags.ManageChannels,
                            PermissionsBitField.Flags.MuteMembers,
                            PermissionsBitField.Flags.DeafenMembers,
                            PermissionsBitField.Flags.MoveMembers
                        ]
                    }
                ];

                // Permettre automatiquement au Staff de bypasser/voir les salons cachés
                STAFF_ROLES.forEach(roleId => {
                    basePermissions.push({
                        id: roleId,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.MoveMembers]
                    });
                });

                // Restauration automatique des sauvegardes utilisateur
                if (savedUserConfig) {
                    if (savedUserConfig.name) channelName = savedUserConfig.name;
                    if (savedUserConfig.isLocked) {
                        basePermissions[0].allow = [PermissionsBitField.Flags.ViewChannel];
                        basePermissions[0].deny = [PermissionsBitField.Flags.Connect];
                    }
                    if (savedUserConfig.isPrivate) {
                        basePermissions[0].deny = [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect];
                    }
                }

                const tempChannel = await guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildVoice,
                    parent: TEMP_CATEGORY,
                    permissionOverwrites: basePermissions,
                    userLimit: savedUserConfig?.userLimit || 0
                });

                // Enregistrement de l'état
                tempChannels.set(tempChannel.id, {
                    owner: member.id,
                    createdAt: Date.now(),
                    isLocked: savedUserConfig?.isLocked || false,
                    isPrivate: savedUserConfig?.isPrivate || false,
                    userLimit: savedUserConfig?.userLimit || 0
                });

                // Logs de création
                const logChan = await guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
                if (logChan) {
                    logChan.send({ embeds: [new EmbedBuilder().setColor("Green").setDescription(`🔊 **Salon Vocal Créé**\n👤 **Créateur :** ${member} (\`${member.id}\`)\n🏷️ **Nom :** \`${channelName}\``)] }).catch(() => {});
                }

                await member.voice.setChannel(tempChannel).catch(() => {});

                // Panneau d'administration complet
                const embed = new EmbedBuilder()
                    .setColor("#2b2d31")
                    .setTitle("🎧 Interface Salon Vocal Privé")
                    .setDescription(`Bienvenue dans ton salon éphémère, ${member} !\n\nUtilise les boutons et le menu déroulant ci-dessous pour gérer les accès et la capacité de ton salon en temps réel.`)
                    .setFooter({ text: "Pyxar Voice System" });

                const row1 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("vc_open").setLabel("Ouvrir").setEmoji("🔓").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId("vc_lock").setLabel("Fermer").setEmoji("🔒").setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId("vc_private").setLabel("Privé").setEmoji("👁️").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("vc_clear").setLabel("Purger").setEmoji("🧹").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("vc_whitelist").setLabel("Whitelist").setEmoji("➕").setStyle(ButtonStyle.Primary)
                );

                const row2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("vc_blacklist").setLabel("Blacklist").setEmoji("🚫").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId("vc_transfer").setLabel("Transférer").setEmoji("🔁").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId("vc_mic").setLabel("Micro").setEmoji("🎤").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("vc_video").setLabel("Vidéo").setEmoji("🎥").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("vc_soundboard").setLabel("Soundboard").setEmoji("📣").setStyle(ButtonStyle.Secondary)
                );

                const row3 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("vc_status").setLabel("Nom/Statut").setEmoji("📌").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("vc_save").setLabel("Sauvegarder").setEmoji("💾").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId("vc_report_staff").setLabel("Appeler Staff").setEmoji("🛡️").setStyle(ButtonStyle.Danger)
                );

                const limitMenu = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("vc_limit_select")
                        .setPlaceholder("👥 Limiter le nombre de places...")
                        .addOptions([
                            { label: "Illimité", value: "0", emoji: "♾️" },
                            { label: "Duo (2 places)", value: "2", emoji: "👥" },
                            { label: "Trio (3 places)", value: "3", emoji: "☘️" },
                            { label: "Squad (4 places)", value: "4", emoji: "🔥" },
                            { label: "Full Team (5 places)", value: "5", emoji: "🎮" },
                            { label: "10 places", value: "10", emoji: "🏢" }
                        ])
                );

                await tempChannel.send({ embeds: [embed], components: [row1, row2, row3, limitMenu] }).catch(() => {});
            }

            // ---- 2. SUPPRESSION AUTOMATIQUE QUAND LE SALON SE VIDE ----
            const oldChannel = oldState.channel;
            if (oldChannel && tempChannels.has(oldChannel.id)) {
                setTimeout(async () => {
                    const fetched = await oldChannel.fetch().catch(() => null);
                    if (!fetched) return;

                    if (fetched.members.size === 0) {
                        tempChannels.delete(oldChannel.id);
                        await fetched.delete().catch(() => {});

                        const logChan = await oldChannel.guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
                        if (logChan) {
                            logChan.send({ embeds: [new EmbedBuilder().setColor("Red").setDescription(`🗑️ **Salon Vocal Supprimé**\n🏷️ **Nom :** \`${oldChannel.name}\` (Plus aucun membre)`)] }).catch(() => {});
                        }
                    }
                }, 4000); // 4 secondes d'attente de sécurité
            }

        } catch (err) {
            console.log("[VOICE ERROR]", err);
        }
    });

    // =====================================================
    // ⚙️ INTERACTION GESTION PANEL (Boutons, Menus, Modaux)
    // =====================================================
    client.on("interactionCreate", async (interaction) => {
        try {
            const voiceChannel = interaction.channel;
            if (!voiceChannel || !tempChannels.has(voiceChannel.id)) return;

            const channelData = tempChannels.get(voiceChannel.id);

            // SÉCURITÉ MAXIMUM : Seul le propriétaire manipule ses options
            if (interaction.isButton() || interaction.isUserSelectMenu() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {
                if (channelData.owner !== interaction.user.id) {
                    return interaction.reply({ content: "❌ Seul le propriétaire attitré de ce salon vocal peut utiliser ces commandes.", ephemeral: true });
                }
            }

            // ---- A. TRAITEMENT DES BOUTONS ----
            if (interaction.isButton()) {
                switch (interaction.customId) {
                    case "vc_open":
                        channelData.isLocked = false;
                        channelData.isPrivate = false;
                        await voiceChannel.permissionOverwrites.edit(interaction.guild.id, { Connect: true, ViewChannel: true });
                        return interaction.reply({ content: "Avis : 🔓 Votre salon vocal est désormais ouvert à tout le serveur.", ephemeral: true });

                    case "vc_lock":
                        channelData.isLocked = true;
                        await voiceChannel.permissionOverwrites.edit(interaction.guild.id, { Connect: false });
                        return interaction.reply({ content: "Avis : 🔒 Salon verrouillé. Les nouveaux membres ne peuvent plus se connecter.", ephemeral: true });

                    case "vc_private":
                        channelData.isPrivate = true;
                        await voiceChannel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: false, Connect: false });
                        await voiceChannel.permissionOverwrites.edit(interaction.user.id, { ViewChannel: true, Connect: true });
                        return interaction.reply({ content: "Avis : 👁️ Mode privé activé. Le salon est invisible pour les membres ordinaires.", ephemeral: true });

                    case "vc_clear":
                        await interaction.deferReply({ ephemeral: true });
                        const targets = voiceChannel.members.filter(m => m.id !== channelData.owner && !m.roles.cache.some(r => STAFF_ROLES.includes(r.id)));
                        if (targets.size === 0) return interaction.editReply({ content: "🧹 Aucun membre éligible à l'expulsion actuellement dans le vocal." });
                        
                        for (const [_, target] of targets) {
                            await target.voice.setChannel(null).catch(() => {});
                        }
                        return interaction.editReply({ content: `🧹 Opération terminée ! **${targets.size} membre(s)** ont été éjectés.` });

                    case "vc_whitelist":
                    case "vc_blacklist":
                    case "vc_transfer":
                        const selectMenu = new UserSelectMenuBuilder().setCustomId(`menu_${interaction.customId}`).setPlaceholder("Choisis l'utilisateur...");
                        return interaction.reply({ content: `Sélectionne la cible :`, components: [new ActionRowBuilder().addComponents(selectMenu)], ephemeral: true });

                    case "vc_mic":
                        const currentSpeak = voiceChannel.permissionOverwrites.cache.get(interaction.guild.id)?.deny.has(PermissionsBitField.Flags.Speak);
                        await voiceChannel.permissionOverwrites.edit(interaction.guild.id, { Speak: currentSpeak ? true : false });
                        return interaction.reply({ content: currentSpeak ? "🎤 Paroles autorisées par défaut pour les arrivants." : "🔇 Salon muté. Les arrivants devront être autorisés individuellement.", ephemeral: true });

                    case "vc_video":
                        const currentVideo = voiceChannel.permissionOverwrites.cache.get(interaction.guild.id)?.deny.has(PermissionsBitField.Flags.Stream);
                        await voiceChannel.permissionOverwrites.edit(interaction.guild.id, { Stream: currentVideo ? true : false });
                        return interaction.reply({ content: currentVideo ? "🎥 Partages d'écrans et Caméras réactivés." : "🚫 Flux vidéos désactivés pour les membres ordinaires.", ephemeral: true });

                    case "vc_soundboard":
                        const currentSound = voiceChannel.permissionOverwrites.cache.get(interaction.guild.id)?.deny.has(PermissionsBitField.Flags.UseSoundboard);
                        await voiceChannel.permissionOverwrites.edit(interaction.guild.id, { UseSoundboard: currentSound ? true : false });
                        return interaction.reply({ content: currentSound ? "📣 Utilisation du soundboard ré-autorisée." : "🚫 Soundboard bloqué pour éviter les pollutions sonores.", ephemeral: true });

                    case "vc_status":
                        // 🛡️ ANTI-RATELIMIT DISCORD (Maximum 2 renommages par 10 minutes)
                        const userCooldown = nameCooldowns.get(interaction.user.id) || [];
                        const now = Date.now();
                        const validChanges = userCooldown.filter(timestamp => now - timestamp < 600000);
                        
                        if (validChanges.length >= 2) {
                            return interaction.reply({ content: "⏳ **Sécurité anti-spam :** Discord bloque les bots si un salon est renommé plus de 2 fois en 10 minutes. Patiente un instant.", ephemeral: true });
                        }

                        const modal = new ModalBuilder().setCustomId("vc_modal_name").setTitle("Renommer le salon");
                        const input = new TextInputBuilder().setCustomId("new_name").setLabel("Indique le nouveau titre du vocal").setStyle(TextInputStyle.Short).setRequired(true);
                        modal.addComponents(new ActionRowBuilder().addComponents(input));
                        return interaction.showModal(modal);

                    case "vc_save":
                        const db = readDB();
                        db.savedConfigs[interaction.user.id] = {
                            name: voiceChannel.name,
                            isLocked: channelData.isLocked,
                            isPrivate: channelData.isPrivate,
                            userLimit: channelData.userLimit
                        };
                        writeDB(db);
                        return interaction.reply({ content: "💾 **Sauvegarde réussie !** Vos préférences actuelles de salon ont été associées à votre compte pour vos prochaines sessions.", ephemeral: true });

                    case "vc_report_staff":
                        const staffLogChan = await interaction.guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
                        if (staffLogChan) {
                            const alertEmbed = new EmbedBuilder()
                                .setColor("Red")
                                .setTitle("🚨 ALERTE MODÉRATION - VOCAL")
                                .setDescription(`Le membre ${interaction.user} demande une assistance urgente dans son salon vocal éphémère.\n\n📍 **Lien vers le salon :** ${voiceChannel}`);
                            
                            await staffLogChan.send({ content: `@here ⚠️ Demande d'aide active !`, embeds: [alertEmbed] });
                            return interaction.reply({ content: "🛡️ **Demande transmise !** L'équipe de modération a reçu une notification flash pour venir intervenir.", ephemeral: true });
                        }
                        return interaction.reply({ content: "❌ Erreur lors de la liaison avec le canal de modération.", ephemeral: true });
                }
            }

            // ---- B. MENUS DÉROULANTS TEXTUELS (Limite de places) ----
            if (interaction.isStringSelectMenu() && interaction.customId === "vc_limit_select") {
                const limitValue = parseInt(interaction.values[0]);
                channelData.userLimit = limitValue;
                tempChannels.set(voiceChannel.id, channelData);

                await voiceChannel.setUserLimit(limitValue).catch(() => {});
                return interaction.reply({ content: `👥 Limite de capacité configurée avec succès sur **${limitValue === 0 ? "Illimité" : limitValue + " places"}**.`, ephemeral: true });
            }

            // ---- C. MENUS DE SÉLECTION D'UTILISATEURS (Whitelist / Blacklist / Transfert) ----
            if (interaction.isUserSelectMenu()) {
                await interaction.deferReply({ ephemeral: true });
                const targetUser = interaction.users.first();
                if (!targetUser) return interaction.editReply({ content: "❌ Utilisateur introuvable." });

                if (interaction.customId === "menu_vc_whitelist") {
                    await voiceChannel.permissionOverwrites.edit(targetUser.id, { Connect: true, ViewChannel: true });
                    return interaction.editReply({ content: `➕ ${targetUser} a été ajouté manuellement à la **whitelist** de votre salon.` });
                }

                if (interaction.customId === "menu_vc_blacklist") {
                    await voiceChannel.permissionOverwrites.edit(targetUser.id, { Connect: false });
                    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
                    // Expulsion immédiate s'il est déjà à l'intérieur
                    if (targetMember && targetMember.voice.channelId === voiceChannel.id) {
                        await targetMember.voice.setChannel(null).catch(() => {});
                    }
                    return interaction.editReply({ content: `🚫 ${targetUser} a été ajouté à votre **blacklist** et ne peut plus vous rejoindre.` });
                }

                if (interaction.customId === "menu_vc_transfer") {
                    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
                    if (!targetMember || targetMember.voice.channelId !== voiceChannel.id) {
                        return interaction.editReply({ content: "❌ Pour transférer le salon, le nouveau propriétaire doit déjà être présent avec vous dans le salon vocal." });
                    }
                    
                    channelData.owner = targetUser.id;
                    tempChannels.set(voiceChannel.id, channelData);
                    
                    // Inversion des rôles administratifs Discord
                    await voiceChannel.permissionOverwrites.edit(interaction.user.id, { ManageChannels: false });
                    await voiceChannel.permissionOverwrites.edit(targetUser.id, { ManageChannels: true });

                    return interaction.editReply({ content: `🔁 Propriété déléguée ! ${targetUser} hérite des pleins pouvoirs sur ce salon.` });
                }
            }

            // ---- D. EXÉCUTION DU CHANGEMENT DE NOM (Modal Submit) ----
            if (interaction.isModalSubmit() && interaction.customId === "vc_modal_name") {
                const newName = interaction.fields.getTextInputValue("new_name");
                await voiceChannel.setName(newName).catch(() => {});

                // Ajout au cooldown anti-spam
                const userCooldown = nameCooldowns.get(interaction.user.id) || [];
                userCooldown.push(Date.now());
                nameCooldowns.set(interaction.user.id, userCooldown);

                return interaction.reply({ content: `📌 Votre salon a été renommé en : \`${newName}\``, ephemeral: true });
            }

        } catch (err) {
            console.log("[INTERACTION ERROR]", err);
        }
    });
};
