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
const TRIGGER_CHANNEL = "1501626007562485910";
const TEMP_CATEGORY = "1501626005662597121";
const LOGS_CHANNEL = "1521931122043256892";

// Security Clearance & Bypass Matrix
const STAFF_ROLES = ["1501625944148934758", "1521928409268228096"]; 

// RAM Runtime Registry & Hardware Cooldown Tracker
const tempChannels = new Map();
const nameCooldowns = new Map(); // Discord API Limit Layer: Max 2 updates / 10 minutes

// Persistent Storage Routing
const DB_PATH = path.join(__dirname, "../data/voice_database.json");
if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({ savedConfigs: {} }, null, 4));

function readDB() { return JSON.parse(fs.readFileSync(DB_PATH, "utf-8")); }
function writeDB(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 4), "utf-8"); }

module.exports = (client) => {

    // =====================================================
    // 🛡️ GARBAGE COLLECTOR : PURGE DES SALONS GHOSTS
    // =====================================================
    client.once("ready", async () => {
        console.log("[VOICE ENGINE] Scan d'initialisation et nettoyage des salons résiduels...");
        const category = await client.channels.fetch(TEMP_CATEGORY).catch(() => null);
        
        if (category?.type === ChannelType.GuildCategory) {
            category.children.cache.forEach(async (channel) => {
                // Protection du point d'ancrage principal
                if (channel.id === TRIGGER_CHANNEL) return;
                
                // Isolation et destruction des salons abandonnés suite à un crash du process
                if (channel.type === ChannelType.GuildVoice && channel.members.size === 0) {
                    await channel.delete().catch(() => {});
                    console.log(`[GC PURGE] Nettoyage du salon orphelin : ${channel.name}`);
                }
            });
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
                            PermissionsBitField.Flags.Speak,
                            PermissionsBitField.Flags.ManageChannels,
                            PermissionsBitField.Flags.MuteMembers,
                            PermissionsBitField.Flags.DeafenMembers,
                            PermissionsBitField.Flags.MoveMembers
                        ]
                    }
                ];

                // Injection automatique des droits prioritaires pour le staff Aeroz
                STAFF_ROLES.forEach(roleId => {
                    contextPermissions.push({
                        id: roleId,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.MoveMembers]
                    });
                });

                // Reconstruction dynamique basée sur les archives du stockage local
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

                // Indexation instantanée dans la RAM
                tempChannels.set(targetChannel.id, {
                    owner: member.id,
                    createdAt: Date.now(),
                    isLocked: userTemplate?.isLocked || false,
                    isPrivate: userTemplate?.isPrivate || false,
                    userLimit: userTemplate?.userLimit || 0
                });

                // Audit Trail
                const logChan = await guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
                if (logChan) {
                    logChan.send({ 
                        embeds: [new EmbedBuilder().setColor("Green").setDescription(`🔊 **Nouveau Salon Éphémère**\n👤 **Auteur :** ${member} (\`${member.id}\`)\n🏷️ **Configuration :** \`${channelName}\``)] 
                    }).catch(() => {});
                }

                // Routage réseau de l'utilisateur vers sa nouvelle instance vocale
                await member.voice.setChannel(targetChannel).catch(() => {});

                // Rendering de l'interface d'administration
                const dashboardEmbed = new EmbedBuilder()
                    .setColor("#2b2d31")
                    .setTitle("🎧 Interface Vocale Éphémère — Aeroz Esports")
                    .setDescription(`Installe-toi confortablement, ${member} !\n\nGère les verrous, la confidentialité, les whitelists et la structure de ton salon de discussion en temps réel à l'aide des options ci-dessous.`)
                    .setFooter({ text: "Aeroz Automations • Système d'Instance Privée" });

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
                // Délai de courtoisie réseau pour parer aux déconnexions/reconnexions intempestives
                setTimeout(async () => {
                    const currentInstance = await expiredChannel.fetch().catch(() => null);
                    if (!currentInstance) return;

                    if (currentInstance.members.size === 0) {
                        tempChannels.delete(expiredChannel.id);
                        await currentInstance.delete().catch(() => {});

                        const logChan = await expiredChannel.guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
                        if (logChan) {
                            logChan.send({ 
                                embeds: [new EmbedBuilder().setColor("Red").setDescription(`🗑️ **Salon Éphémère Expiré**\n🏷️ **Nom :** \`${expiredChannel.name}\` (Instance nettoyée avec succès)`)] 
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

            // MIDDLEWARE DE SÉCURITÉ : Validation de la signature du propriétaire
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
                        return interaction.reply({ content: "🔓 **Statut mis à jour :** Les barrières réseau sont levées, le salon est public.", ephemeral: true });

                    case "vc_lock":
                        runtimeData.isLocked = true;
                        await activeVoice.permissionOverwrites.edit(interaction.guild.id, { Connect: false });
                        return interaction.reply({ content: "🔒 **Statut mis à jour :** Le verrou est tiré. Plus aucune connexion extérieure autorisée.", ephemeral: true });

                    case "vc_private":
                        runtimeData.isPrivate = true;
                        await activeVoice.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: false, Connect: false });
                        await activeVoice.permissionOverwrites.edit(interaction.user.id, { ViewChannel: true, Connect: true });
                        return interaction.reply({ content: "👁️ **Statut mis à jour :** Le salon est désormais camouflé pour le serveur.", ephemeral: true });

                    case "vc_clear":
                        await interaction.deferReply({ ephemeral: true });
                        const clusterTargets = activeVoice.members.filter(m => m.id !== runtimeData.owner && !m.roles.cache.some(r => STAFF_ROLES.includes(r.id)));
                        if (clusterTargets.size === 0) return interaction.editReply({ content: "🧹 Aucune cible détectée à l'intérieur de la cellule vocale." });
                        
                        for (const [_, target] of clusterTargets) {
                            await target.voice.setChannel(null).catch(() => {});
                        }
                        return interaction.editReply({ content: `🧹 **Purge achevée !** Isolement et expulsion de **${clusterTargets.size} utilisateur(s)**.` });

                    case "vc_whitelist":
                    case "vc_blacklist":
                    case "vc_transfer":
                        const userDropdown = new UserSelectMenuBuilder().setCustomId(`menu_${interaction.customId}`).setPlaceholder("Sélectionner la cible réseau...");
                        return interaction.reply({ content: `Veuillez désigner l'utilisateur cible :`, components: [new ActionRowBuilder().addComponents(userDropdown)], ephemeral: true });

                    case "vc_mic":
                        const isMuted = activeVoice.permissionOverwrites.cache.get(interaction.guild.id)?.deny.has(PermissionsBitField.Flags.Speak);
                        await activeVoice.permissionOverwrites.edit(interaction.guild.id, { Speak: isMuted ? true : false });
                        return interaction.reply({ content: isMuted ? "🎤 **Flux Audio :** Prise de parole libre." : "Static : 🔇 **Flux Audio :** Mode conférence activé (arrivants mutés).", ephemeral: true });

                    case "vc_video":
                        const isVideoBlocked = activeVoice.permissionOverwrites.cache.get(interaction.guild.id)?.deny.has(PermissionsBitField.Flags.Stream);
                        await activeVoice.permissionOverwrites.edit(interaction.guild.id, { Stream: isVideoBlocked ? true : false });
                        return interaction.reply({ content: isVideoBlocked ? "🎥 **Flux Vidéo :** Flux caméras et flux partages restaurés." : "🚫 **Flux Vidéo :** Transmission d'écrans restreinte.", ephemeral: true });

                    case "vc_soundboard":
                        const isSoundboardBlocked = activeVoice.permissionOverwrites.cache.get(interaction.guild.id)?.deny.has(PermissionsBitField.Flags.UseSoundboard);
                        await activeVoice.permissionOverwrites.edit(interaction.guild.id, { UseSoundboard: isSoundboardBlocked ? true : false });
                        return interaction.reply({ content: isSoundboardBlocked ? "📣 **Périphériques :** Soundboard global débloqué." : "🚫 **Périphériques :** Dispositifs Soundboard filtrés et interdits.", ephemeral: true });

                    case "vc_status":
                        // ANTI-RATELIMIT : Analyse de la table de congestion locale
                        const requestLogs = nameCooldowns.get(interaction.user.id) || [];
                        const actualTime = Date.now();
                        const trackingWindow = requestLogs.filter(timestamp => actualTime - timestamp < 600000); // 10 Min Window
                        
                        if (trackingWindow.length >= 2) {
                            return interaction.reply({ content: "⏳ **Alerte API Discord :** Les changements de noms de salons sont restreints à 2 itérations par tranche de 10 minutes par l'infrastructure de Discord. Veuillez temporiser.", ephemeral: true });
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
                        return interaction.reply({ content: "💾 **Data Synced :** Vos paramètres actuels de session ont été inscrits dans la base de données pour vos futurs lancements.", ephemeral: true });

                    case "vc_report_staff":
                        const staffDispatch = await interaction.guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
                        if (staffDispatch) {
                            const flashEmbed = new EmbedBuilder()
                                .setColor("Red")
                                .setTitle("🚨 DETECTED EMERGENCY CALL — VOICE INTERFACE")
                                .setDescription(`L'utilisateur ${interaction.user} requiert la présence immédiate de la modération dans son instance vocale privée.\n\n📍 **Liaison directe :** ${activeVoice}`)
                                .setTimestamp();
                            
                            await staffDispatch.send({ content: `@here ⚠️ SIGNALEMENT INTERNE ACTIONNÉ`, embeds: [flashEmbed] });
                            return interaction.reply({ content: "🛡️ **Alerte émise :** Un signalement flash vient d'être routé sur le terminal privé de l'équipe de modération.", ephemeral: true });
                        }
                        return interaction.reply({ content: "❌ Impossible de joindre l'infrastructure de secours.", ephemeral: true });
                }
            }

            // ---- INTERACTION CLUSTER : STRING SELECT MENUS ----
            if (interaction.isStringSelectMenu() && interaction.customId === "vc_limit_select") {
                const updatedLimit = parseInt(interaction.values[0]);
                runtimeData.userLimit = updatedLimit;
                tempChannels.set(activeVoice.id, runtimeData);

                await activeVoice.setUserLimit(updatedLimit).catch(() => {});
                return interaction.reply({ content: `👥 **Jauge configurée :** Capacités réseau ajustées à **${updatedLimit === 0 ? "Illimité" : updatedLimit + " slots"}**.`, ephemeral: true });
            }

            // ---- INTERACTION CLUSTER : USER DROPDOWNS MANAGEMENT ----
            if (interaction.isUserSelectMenu()) {
                await interaction.deferReply({ ephemeral: true });
                const selectedTarget = interaction.users.first();
                if (!selectedTarget) return interaction.editReply({ content: "❌ Impossible d'isoler l'empreinte utilisateur." });

                if (interaction.customId === "menu_vc_whitelist") {
                    await activeVoice.permissionOverwrites.edit(selectedTarget.id, { Connect: true, ViewChannel: true });
                    return interaction.editReply({ content: `➕ **Autorisation :** ${selectedTarget} est désormais inscrit sur la liste blanche d'accès.` });
                }

                if (interaction.customId === "menu_vc_blacklist") {
                    await activeVoice.permissionOverwrites.edit(selectedTarget.id, { Connect: false });
                    const memberInstance = await interaction.guild.members.fetch(selectedTarget.id).catch(() => null);
                    
                    // Expulsion physique immédiate de l'infrastructure en cas de présence active
                    if (memberInstance?.voice.channelId === activeVoice.id) {
                        await memberInstance.voice.setChannel(null).catch(() => {});
                    }
                    return interaction.editReply({ content: `🚫 **Bannissement :** ${selectedTarget} est banni du salon et sa connexion est rejetée.` });
                }

                if (interaction.customId === "menu_vc_transfer") {
                    const memberInstance = await interaction.guild.members.fetch(selectedTarget.id).catch(() => null);
                    if (memberInstance?.voice.channelId !== activeVoice.id) {
                        return interaction.editReply({ content: "❌ Procédure avortée : Le destinataire du transfert de propriété doit obligatoirement être connecté dans votre instance vocale." });
                    }
                    
                    runtimeData.owner = selectedTarget.id;
                    tempChannels.set(activeVoice.id, runtimeData);
                    
                    // Permutation asynchrone des privilèges administratifs Discord
                    await activeVoice.permissionOverwrites.edit(interaction.user.id, { ManageChannels: false });
                    await activeVoice.permissionOverwrites.edit(selectedTarget.id, { ManageChannels: true });

                    return interaction.editReply({ content: `🔁 **Passage de relais :** Propriété de la cellule transférée avec succès à ${selectedTarget}.` });
                }
            }

            // ---- INTERACTION CLUSTER : MODAL TRANSACTION TERMINAL ----
            if (interaction.isModalSubmit() && interaction.customId === "vc_modal_name") {
                const processedName = interaction.fields.getTextInputValue("new_name");
                await activeVoice.setName(processedName).catch(() => {});

                // Log de l'action dans le limiteur temporel local
                const currentCooldowns = nameCooldowns.get(interaction.user.id) || [];
                currentCooldowns.push(Date.now());
                nameCooldowns.set(interaction.user.id, currentCooldowns);

                return interaction.reply({ content: `📌 **Structure modifiée :** Votre salon porte désormais le titre : \`${processedName}\``, ephemeral: true });
            }

        } catch (runtimeError) {
            console.log("[CRITICAL COMPONENT INTERACTION ERROR]", runtimeError);
        }
    });
};
