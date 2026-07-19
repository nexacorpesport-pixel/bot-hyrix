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

// =====================================================
// CORE INFRASTRUCTURE CONFIGURATION
// =====================================================
const TRIGGER_CHANNEL = "1528194701273075803";
const TEMP_CATEGORY = "1528194689222574100";
const LOGS_CHANNEL = "1528213718595539064";

const OWNER_ID = "1431661348218998948";
const STAFF_ROLES = ["1528184662478946535", "1528184660436455545"]; 

// RAM Runtime Registry
const tempChannels = new Map();
const nameCooldowns = new Map(); 

// Persistent Storage Routing (Dossier data/)
const DB_PATH = path.join(__dirname, "data", "voice_database.json");
if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({ savedConfigs: {} }, null, 4));

function readDB() { return JSON.parse(fs.readFileSync(DB_PATH, "utf-8")); }
function writeDB(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 4), "utf-8"); }

module.exports = (client) => {

    const isStaff = (member) => {
        if (!member) return false;
        if (member.id === OWNER_ID || member.guild.ownerId === member.id) return true;
        if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
        return STAFF_ROLES.some(roleId => member.roles.cache.has(roleId));
    };

    // =====================================================
    // 🛡️ GARBAGE COLLECTOR : PURGE DES SALONS GHOSTS
    // =====================================================
    const runGarbageCollector = async (guild) => {
        const category = await guild.channels.fetch(TEMP_CATEGORY).catch(() => null);
        let deletedCount = 0;
        if (category?.type === ChannelType.GuildCategory) {
            for (const [_, channel] of category.children.cache) {
                if (channel.id === TRIGGER_CHANNEL) continue;
                if (channel.type === ChannelType.GuildVoice && channel.members.size === 0) {
                    tempChannels.delete(channel.id);
                    await channel.delete().catch(() => {});
                    deletedCount++;
                }
            }
        }
        return deletedCount;
    };

    client.once("ready", async () => {
        console.log("[VOICE ENGINE] Scan d'initialisation et nettoyage des salons résiduels...");
        // Exécution globale sur le premier serveur disponible au démarrage
        const firstGuild = client.guilds.cache.first();
        if (firstGuild) await runGarbageCollector(firstGuild);
    });

    // =====================================================
    // ❌ FILTRE STRICT TEXTUEL : INTERDICTION D'ECRIRE (ARTICLE 9)
    // =====================================================
    client.on("messageCreate", async (msg) => {
        if (!msg.guild || msg.author.bot) return;

        // Si le message est écrit dans un salon éphémère actif
        if (tempChannels.has(msg.channel.id)) {
            const prefix = "+";
            if (msg.content.startsWith(prefix)) return; // Permet de laisser passer les commandes si nécessaire

            if (isStaff(msg.member)) return; // Le staff est immunisé

            // Suppression immédiate
            await msg.delete().catch(() => {});

            // Envoi de la sanction réglementaire
            return msg.channel.send(`⚠️ ${msg.author}, **il est strictement interdit d'écrire dans ce salon.**\n\n> **Article 9 du règlement :** *Il est strictement interdit d'écrire ou d'utiliser le chat textuel intégré des salons vocaux ainsi que les salons écrits ou vocaux temporaires pour y commettre des infractions ou contourner la surveillance du staff. Ces espaces sont archivés et surveillés de près.*`)
                .then(m => setTimeout(() => m.delete().catch(() => {}), 10000));
        }

        // =====================================================
        // ⌨️ MODULE DES COMMANDES TEXTUELLES (+) ADMIN / STAFF
        // =====================================================
        const prefix = "+";
        if (!msg.content.startsWith(prefix)) return;

        const args = msg.content.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        // Protection : Seul le staff Aeroz accède à ces commandes de gestion
        const voiceCommands = ["voice-status", "voice-cooldowns", "voice-cooldownreset", "setvoice-trigger", "setvoice-category", "setvoice-logs", "voice-purge", "voice-delete", "voice-resetdb", "voice-viewprofile", "voice-clearprofile", "help-voice"];
        if (voiceCommands.includes(command) && !isStaff(msg.member)) {
            await msg.delete().catch(() => {});
            return;
        }

        if (command === "help-voice") {
            const hEmbed = new EmbedBuilder()
                .setTitle("🛠️ Manuel d'Urgence Vocale — Hublot Aeroz")
                .setColor("#2b2d31")
                .addFields(
                    { name: "📊 Visualisation & Fixs", value: "`+voice-status` - État du trafic vocal.\n`+voice-cooldowns` - Voir les utilisateurs bloqués API.\n`+voice-cooldownreset [@membre]` - Forcer le reset du cooldown de nom." },
                    { name: "🧹 Nettoyage & Maintenance", value: "`+voice-purge` - Déclenche le Garbage Collector immédiat.\n`+voice-delete [ID_Salon]` - Supprime de force une instance.\n`+voice-resetdb` - Wipe toutes les configs sauvegardées (JSON)." },
                    { name: "👤 Profils Membres", value: "`+voice-viewprofile [@membre]` - Inspecter une jauge/nom sauvegardé.\n`+voice-clearprofile [@membre]` - Reset le profil d'un membre si hors-charte." }
                );
            return msg.author.send({ embeds: [hEmbed] }).then(() => msg.reply("📥 Le guide d'administration vocale a été envoyé en privé.")).catch(() => {});
        }

        if (command === "voice-status") {
            const db = readDB();
            const savedCount = Object.keys(db.savedConfigs).length;
            const statusEmbed = new EmbedBuilder()
                .setTitle("📊 Statut de l'Infrastructure Vocale Éphémère")
                .setColor("Blue")
                .setDescription(`• Salons Actifs en RAM : **${tempChannels.size}**\n• Profils uniques enregistrés en JSON : **${savedCount}**\n• Restriction API (Cooldowns actifs) : **${nameCooldowns.size}**`);
            return msg.channel.send({ embeds: [statusEmbed] });
        }

        if (command === "voice-cooldowns") {
            if (nameCooldowns.size === 0) return msg.reply("🟢 Aucun utilisateur n'est actuellement restreint par l'API Discord.");
            let list = "";
            nameCooldowns.forEach((times, userId) => {
                list += `• <@${userId}> (\`${userId}\`) : ${times.length} modification(s) récente(s)\n`;
            });
            return msg.channel.send(`⏳ **Liste des restrictions de renommage actives :**\n${list}`);
        }

        if (command === "voice-cooldownreset") {
            const target = msg.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
            if (!target) return msg.reply("❌ Précisez ou mentionnez l'utilisateur.");
            nameCooldowns.delete(target.id);
            return msg.reply(`✅ Restriction de renommage annulée pour ${target}.`);
        }

        if (command === "voice-purge") {
            const deleted = await runGarbageCollector(msg.guild);
            return msg.reply(`🧹 **Garbage Collector exécuté.** **${deleted}** salon(s) vide(s) ou orphelin(s) supprimé(s).`);
        }

        if (command === "voice-delete") {
            const channelId = args[0];
            if (!channelId) return msg.reply("❌ Fournissez l'ID du salon vocal à détruire.");
            const targetChan = await msg.guild.channels.fetch(channelId).catch(() => null);
            if (!targetChan) return msg.reply("❌ Salon introuvable sur Discord.");
            
            tempChannels.delete(channelId);
            await targetChan.delete().catch(() => {});
            return msg.reply(`🗑️ Le salon éphémère \`${channelId}\` a été détruit de force.`);
        }

        if (command === "voice-resetdb") {
            writeDB({ savedConfigs: {} });
            return msg.reply("♻️ **Base de données vocale réinitialisée.** Toutes les sauvegardes de salons des joueurs ont été effacées.");
        }

        if (command === "voice-viewprofile") {
            const target = msg.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
            if (!target) return msg.reply("❌ Précisez l'utilisateur.");
            const db = readDB();
            const config = db.savedConfigs[target.id];
            if (!config) return msg.reply("👤 Cet utilisateur n'a aucun profil enregistré.");
            
            return msg.reply(`👤 **Profil Vocal de ${target.username} :**\n• Nom : \`${config.name || "Par défaut"}\`\n• Verrouillé : \`${config.isLocked}\`\n• Masqué : \`${config.isPrivate}\`\n• Limite : \`${config.userLimit === 0 ? "Illimitée" : config.userLimit + " slots"}\``);
        }

        if (command === "voice-clearprofile") {
            const target = msg.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
            if (!target) return msg.reply("❌ Précisez l'utilisateur.");
            const db = readDB();
            if (db.savedConfigs[target.id]) {
                delete db.savedConfigs[target.id];
                writeDB(db);
                return msg.reply(`✅ Le profil sauvegardé de ${target.username} a été supprimé pour non-conformité.`);
            }
            return msg.reply("L'utilisateur n'avait pas de profil.");
        }
    });

    // =====================================================
    // 🎧 VOICE LIFECYCLE PIPELINE (Join / Leave Tracking)
    // =====================================================
    client.on("voiceStateUpdate", async (oldState, newState) => {
        try {
            const member = newState.member;
            if (!member || member.user.bot) return;

            // ---- PIPELINE 1 : ENTRÉE DANS LE SALON HUBLOT ----
            if (newState.channelId === TRIGGER_CHANNEL) {
                const guild = member.guild;
                const db = readDB();
                const userTemplate = db.savedConfigs[member.id];

                let channelName = `🎧｜${member.user.username}`;
                
                // ⚠️ SÉCURITÉ DRASTIQUE : RETRAIT DES DROITS NATIFS MUTE/DEAF/MANAGE DU PROPRIÉTAIRE
                // On lui donne ViewChannel et Connect pour entrer, mais AUCUNE permission d'administration Discord native
                let contextPermissions = [
                    {
                        id: guild.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect]
                    },
                    {
                        id: member.id,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.Connect,
                            PermissionsBitField.Flags.Speak
                        ],
                        deny: [
                            PermissionsBitField.Flags.ManageChannels,
                            PermissionsBitField.Flags.MuteMembers,
                            PermissionsBitField.Flags.DeafenMembers,
                            PermissionsBitField.Flags.MoveMembers
                        ]
                    }
                ];

                // Droits d'outrepassement pour le staff
                STAFF_ROLES.forEach(roleId => {
                    contextPermissions.push({
                        id: roleId,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.MoveMembers]
                    });
                });

                if (userTemplate) {
                    if (userTemplate.name) channelName = userTemplate.name;
                    if (userTemplate.isLocked) {
                        contextPermissions[0].allow = [PermissionsBitField.Flags.ViewChannel];
                        contextPermissions[0].deny = [PermissionsBitField.Flags.Connect];
                    }
                    if (userTemplate.isPrivate) {
                        contextPermissions[0].deny = [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect];
                    }
                }

                const targetChannel = await guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildVoice,
                    parent: TEMP_CATEGORY,
                    permissionOverwrites: contextPermissions,
                    userLimit: userTemplate?.userLimit || 0
                });

                tempChannels.set(targetChannel.id, {
                    owner: member.id,
                    createdAt: Date.now(),
                    isLocked: userTemplate?.isLocked || false,
                    isPrivate: userTemplate?.isPrivate || false,
                    userLimit: userTemplate?.userLimit || 0
                });

                const logChan = await guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
                if (logChan) {
                    logChan.send({ 
                        embeds: [new EmbedBuilder().setColor("Green").setDescription(`🔊 **Nouveau Salon Éphémère**\n👤 **Auteur :** ${member} (\`${member.id}\`)\n🏷️ **Configuration :** \`${channelName}\``)] 
                    }).catch(() => {});
                }

                await member.voice.setChannel(targetChannel).catch(() => {});

                // Panneau de contrôle interactif
                const dashboardEmbed = new EmbedBuilder()
                    .setColor("#2b2d31")
                    .setTitle("🎧 Interface Vocale Éphémère — Aeroz Esports")
                    .setDescription(`Installe-toi confortablement, ${member} !\n\nGère ton salon exclusivement via ce panneau.\n\n⚠️ *Conformément à l'**Article 9**, l'utilisation du chat écrit est interdite. Les droits de modération vocale natifs vous sont retirés pour éviter tout abus.*`)
                    .setFooter({ text: "Aeroz Automations • Commandes par Boutons Uniquement" });

                const controlRow1 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("vc_open").setLabel("Ouvrir").setEmoji("🔓").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId("vc_lock").setLabel("Fermer").setEmoji("🔒").setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId("vc_private").setLabel("Masquer").setEmoji("👁️").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("vc_clear").setLabel("Purger").setEmoji("🧹").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("vc_whitelist").setLabel("Autoriser").setEmoji("➕").setStyle(ButtonStyle.Primary)
                );

                const controlRow2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("vc_blacklist").setLabel("Bannir").setEmoji("🚫").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId("vc_transfer").setLabel("Transférer").setEmoji("🔁").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId("vc_mic").setLabel("Muet").setEmoji("🎤").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("vc_video").setLabel("Caméra").setEmoji("🎥").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("vc_soundboard").setLabel("Soundboard").setEmoji("📣").setStyle(ButtonStyle.Secondary)
                );

                const controlRow3 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("vc_status").setLabel("Renommer").setEmoji("📌").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("vc_save").setLabel("Sauvegarder").setEmoji("💾").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId("vc_report_staff").setLabel("Alerte Staff").setEmoji("🛡️").setStyle(ButtonStyle.Danger)
                );

                const slotSelector = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("vc_limit_select")
                        .setPlaceholder("👥 Ajuster la jauge d'utilisateurs...")
                        .addOptions([
                            { label: "Illimité", value: "0", emoji: "♾️" },
                            { label: "Duo (2 Joueurs)", value: "2", emoji: "👥" },
                            { label: "Trio (3 Joueurs)", value: "3", emoji: "☘️" },
                            { label: "Squad (4 Joueurs)", value: "4", emoji: "🔥" },
                            { label: "Full Line-up (5 Joueurs)", value: "5", emoji: "🎮" },
                            { label: "Réunion (10 Joueurs)", value: "10", emoji: "🏢" }
                        ])
                );

                await targetChannel.send({ embeds: [dashboardEmbed], components: [controlRow1, controlRow2, controlRow3, slotSelector] }).catch(() => {});
            }

            // ---- PIPELINE 2 : EVACUATION ET DESTRUCTION AUTOMATIQUE ----
            const expiredChannel = oldState.channel;
            if (expiredChannel && tempChannels.has(expiredChannel.id)) {
                setTimeout(async () => {
                    const currentInstance = await expiredChannel.fetch().catch(() => null);
                    if (!currentInstance) return;

                    if (currentInstance.members.size === 0) {
                        tempChannels.delete(expiredChannel.id);
                        await currentInstance.delete().catch(() => {});

                        const logChan = await expiredChannel.guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
                        if (logChan) {
                            logChan.send({ 
                                embeds: [new EmbedBuilder().setColor("Red").setDescription(`🗑️ **Salon Éphémère Expiré**\n🏷️ **Nom :** \`${expiredChannel.name}\` (Instance nettoyée)`)] 
                            }).catch(() => {});
                        }
                    }
                }, 3500);
            }

        } catch (error) {
            console.log("[CRITICAL RUNTIME VOICE ERROR]", error);
        }
    });

    // =====================================================
    // ⚙️ ROUTER INTERACTION INTERFACE (Panel Matrix)
    // =====================================================
    client.on("interactionCreate", async (interaction) => {
        try {
            const activeVoice = interaction.channel;
            if (!activeVoice || !tempChannels.has(activeVoice.id)) return;

            const runtimeData = tempChannels.get(activeVoice.id);

            // Validation de la signature du propriétaire
            if (interaction.isButton() || interaction.isUserSelectMenu() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {
                if (runtimeData.owner !== interaction.user.id) {
                    return interaction.reply({ content: "❌ Erreur : Vous n'êtes pas répertorié comme le gérant légal de cette instance vocale.", ephemeral: true });
                }
            }

            // ---- INTERACTION CLUSTER : BUTTON HANDLERS ----
            if (interaction.isButton()) {
                switch (interaction.customId) {
                    case "vc_open":
                        runtimeData.isLocked = false;
                        runtimeData.isPrivate = false;
                        await activeVoice.permissionOverwrites.edit(interaction.guild.id, { Connect: true, ViewChannel: true });
                        return interaction.reply({ content: "🔓 **Statut mis à jour :** Salon public.", ephemeral: true });

                    case "vc_lock":
                        runtimeData.isLocked = true;
                        await activeVoice.permissionOverwrites.edit(interaction.guild.id, { Connect: false });
                        return interaction.reply({ content: "🔒 **Statut mis à jour :** Le salon est fermé aux connexions.", ephemeral: true });

                    case "vc_private":
                        runtimeData.isPrivate = true;
                        await activeVoice.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: false, Connect: false });
                        await activeVoice.permissionOverwrites.edit(interaction.user.id, { ViewChannel: true, Connect: true });
                        return interaction.reply({ content: "👁️ **Statut mis à jour :** Salon camouflé.", ephemeral: true });

                    case "vc_clear":
                        await interaction.deferReply({ ephemeral: true });
                        const clusterTargets = activeVoice.members.filter(m => m.id !== runtimeData.owner && !isStaff(m));
                        if (clusterTargets.size === 0) return interaction.editReply({ content: "🧹 Aucun utilisateur à expulser." });
                        
                        for (const [_, target] of clusterTargets) {
                            await target.voice.setChannel(null).catch(() => {});
                        }
                        return interaction.editReply({ content: `🧹 **Purge achevée !** Expulsion de **${clusterTargets.size} utilisateur(s)**.` });

                    case "vc_whitelist":
                    case "vc_blacklist":
                    case "vc_transfer":
                        const userDropdown = new UserSelectMenuBuilder().setCustomId(`menu_${interaction.customId}`).setPlaceholder("Sélectionner la cible réseau...");
                        return interaction.reply({ content: `Veuillez désigner l'utilisateur cible :`, components: [new ActionRowBuilder().addComponents(userDropdown)], ephemeral: true });

                    case "vc_mic":
                        const isMuted = activeVoice.permissionOverwrites.cache.get(interaction.guild.id)?.deny.has(PermissionsBitField.Flags.Speak);
                        await activeVoice.permissionOverwrites.edit(interaction.guild.id, { Speak: isMuted ? true : false });
                        return interaction.reply({ content: isMuted ? "🎤 **Flux Audio :** Prise de parole libre." : "🔇 **Flux Audio :** Mode conférence activé (arrivants muets).", ephemeral: true });

                    case "vc_video":
                        const isVideoBlocked = activeVoice.permissionOverwrites.cache.get(interaction.guild.id)?.deny.has(PermissionsBitField.Flags.Stream);
                        await activeVoice.permissionOverwrites.edit(interaction.guild.id, { Stream: isVideoBlocked ? true : false });
                        return interaction.reply({ content: isVideoBlocked ? "🎥 **Flux Vidéo :** Caméras et partages débloqués." : "🚫 **Flux Vidéo :** Partages d'écrans restreints.", ephemeral: true });

                    case "vc_soundboard":
                        const isSoundboardBlocked = activeVoice.permissionOverwrites.cache.get(interaction.guild.id)?.deny.has(PermissionsBitField.Flags.UseSoundboard);
                        await activeVoice.permissionOverwrites.edit(interaction.guild.id, { UseSoundboard: isSoundboardBlocked ? true : false });
                        return interaction.reply({ content: isSoundboardBlocked ? "📣 **Périphériques :** Soundboard débloqué." : "🚫 **Périphériques :** Soundboard désactivé.", ephemeral: true });

                    case "vc_status":
                        const requestLogs = nameCooldowns.get(interaction.user.id) || [];
                        const actualTime = Date.now();
                        const trackingWindow = requestLogs.filter(timestamp => actualTime - timestamp < 600000);
                        
                        if (trackingWindow.length >= 2) {
                            return interaction.reply({ content: "⏳ **Discord Rate Limit :** Max 2 changements de nom par 10 minutes. Veuillez patienter.", ephemeral: true });
                        }

                        const modal = new ModalBuilder().setCustomId("vc_modal_name").setTitle("Aeroz Automations • Renommer");
                        const internalInput = new TextInputBuilder().setCustomId("new_name").setLabel("Définir l'identifiant du salon").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(30);
                        return interaction.showModal(modal.addComponents(new ActionRowBuilder().addComponents(internalInput)));

                    case "vc_save":
                        const db = readDB();
                        db.savedConfigs[interaction.user.id] = {
                            name: activeVoice.name,
                            isLocked: runtimeData.isLocked,
                            isPrivate: runtimeData.isPrivate,
                            userLimit: runtimeData.userLimit
                        };
                        writeDB(db);
                        return interaction.reply({ content: "💾 **Sauvegarde réussie :** Paramètres synchronisés pour tes futurs lancements !", ephemeral: true });

                    case "vc_report_staff":
                        const staffDispatch = await interaction.guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
                        if (staffDispatch) {
                            const flashEmbed = new EmbedBuilder()
                                .setColor("Red")
                                .setTitle("🚨 APPEL D'URGENCE SALON VOCAL")
                                .setDescription(`L'utilisateur ${interaction.user} demande une assistance immédiate de la modération dans son salon privé.\n\n📍 **Salon :** ${activeVoice}`)
                                .setTimestamp();
                            
                            await staffDispatch.send({ content: `@here ⚠️ SIGNALEMENT VOCAL`, embeds: [flashEmbed] });
                            return interaction.reply({ content: "🛡️ **Alerte émise :** Le staff a été notifié.", ephemeral: true });
                        }
                        return interaction.reply({ content: "❌ Impossible de joindre les logs.", ephemeral: true });
                }
            }

            // ---- INTERACTION CLUSTER : STRING SELECT MENUS ----
            if (interaction.isStringSelectMenu() && interaction.customId === "vc_limit_select") {
                const updatedLimit = parseInt(interaction.values[0]);
                runtimeData.userLimit = updatedLimit;
                tempChannels.set(activeVoice.id, runtimeData);

                await activeVoice.setUserLimit(updatedLimit).catch(() => {});
                return interaction.reply({ content: `👥 **Slots ajustés :** Limité à **${updatedLimit === 0 ? "Illimité" : updatedLimit + " joueurs"}**.`, ephemeral: true });
            }

            // ---- INTERACTION CLUSTER : USER DROPDOWNS MANAGEMENT ----
            if (interaction.isUserSelectMenu()) {
                await interaction.deferReply({ ephemeral: true });
                const selectedTarget = interaction.users.first();
                if (!selectedTarget) return interaction.editReply({ content: "❌ Utilisateur introuvable." });

                if (interaction.customId === "menu_vc_whitelist") {
                    await activeVoice.permissionOverwrites.edit(selectedTarget.id, { Connect: true, ViewChannel: true });
                    return interaction.editReply({ content: `➕ **Whitelist :** ${selectedTarget} est maintenant autorisé à entrer.` });
                }

                if (interaction.customId === "menu_vc_blacklist") {
                    await activeVoice.permissionOverwrites.edit(selectedTarget.id, { Connect: false });
                    const memberInstance = await interaction.guild.members.fetch(selectedTarget.id).catch(() => null);
                    
                    if (memberInstance?.voice.channelId === activeVoice.id) {
                        await memberInstance.voice.setChannel(null).catch(() => {});
                    }
                    return interaction.editReply({ content: `🚫 **Blacklist :** ${selectedTarget} a été banni du salon.` });
                }

                if (interaction.customId === "menu_vc_transfer") {
                    const memberInstance = await interaction.guild.members.fetch(selectedTarget.id).catch(() => null);
                    if (memberInstance?.voice.channelId !== activeVoice.id) {
                        return interaction.editReply({ content: "❌ Le nouveau propriétaire doit obligatoirement être connecté dans le salon pour le transfert." });
                    }
                    
                    runtimeData.owner = selectedTarget.id;
                    tempChannels.set(activeVoice.id, runtimeData);
                    
                    await activeVoice.permissionOverwrites.edit(interaction.user.id, { Connect: true });
                    await activeVoice.permissionOverwrites.edit(selectedTarget.id, { Connect: true });

                    return interaction.editReply({ content: `🔁 **Transfert effectué :** ${selectedTarget} est le nouveau gérant.` });
                }
            }

            // ---- INTERACTION CLUSTER : MODAL TRANSACTION TERMINAL ----
            if (interaction.isModalSubmit() && interaction.customId === "vc_modal_name") {
                const processedName = interaction.fields.getTextInputValue("new_name");
                await activeVoice.setName(processedName).catch(() => {});

                const currentCooldowns = nameCooldowns.get(interaction.user.id) || [];
                currentCooldowns.push(Date.now());
                nameCooldowns.set(interaction.user.id, currentCooldowns);

                return interaction.reply({ content: `📌 Salon renommé : \`${processedName}\``, ephemeral: true });
            }

        } catch (runtimeError) {
            console.log("[CRITICAL COMPONENT INTERACTION ERROR]", runtimeError);
        }
    });
};
