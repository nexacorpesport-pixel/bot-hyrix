const {
    PermissionsBitField,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType
} = require("discord.js");

// Configurations des seuils Anti-Nuke (Compteurs à court terme)
const TIME_WINDOW = 10 * 1000; // 10 secondes
const ACTION_LIMIT = 3;        // Max 3 actions avant sanction
const ACCOUNT_AGE_LIMIT = 24 * 60 * 60 * 1000; // 24 heures

// Compteurs globaux pour le Flux de Raid Lent
const RAID_FLUX_WINDOW = 30 * 1000; 
const RAID_FLUX_LIMIT = 5;          
let globalJoinTimestamps = [];
let FLUX_RAID_ALERT_ACTIVE = false;

// 🔐 SÉCURITÉ DE CRISE : ARCHITECTURE BUNKER EXTRÊME
let BUNKER_MODE = false;
const BUNKER_SECRET_KEY = "PX-99X-BUNK-7421-ZOR";
const BUNKER_CATEGORY_ID = "1508090450102456360";
const BUNKER_ROLE_ID = "1508091050932043897";

// Mémoires tampons (RAM) de surveillance
const channelDeleteCounter = new Map();
const channelCreateCounter = new Map();
const roleDeleteCounter = new Map();
const roleCreateCounter = new Map();
const kickCounter = new Map();

const deletedChannelsBackup = new Map();
const deletedRolesBackup = new Map();

module.exports = (client) => {

    console.log("[👑 FORTERESSE DIVINE] Le module Anti-Nuke, Anti-Raid et Bunker Tactique est armé au maximum.");

    const WHITELIST_CEO_ID = "1492655850483875901";
    const SUSPECT_ROLE_ID = "1510271558453690438";
    
    const CHANNELS = {
        ANTI_RAID: "1508156735213404170",
        LOGS_SALONS: "1510270460569321603",
        LOGS_ROLES: "1508156974015975497",
        LOGS_MODERATION: "1508157099153297568"
    };

    const sendLog = async (channelId, embed) => {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (channel) channel.send({ embeds: [embed.setTimestamp()] }).catch(() => {});
    };

    // Fonction d'isolation d'un membre du staff ou bannissement immédiat de bot
    const isolateStaff = async (guild, member, reason) => {
        if (member.id === WHITELIST_CEO_ID || member.id === guild.ownerId) return false;

        if (member.user.bot) {
            await member.ban({ reason: `🚨 BLACKLIST BOT EXTRÊME : ${reason}` }).catch(() => {});
            return true;
        }

        const rolesToRemove = member.roles.cache.filter(r => r.id !== guild.roles.everyone.id);
        await member.roles.remove(rolesToRemove, `Sécurité Anti-Nuke : ${reason}`).catch(() => {});

        const emergencyEmbed = new EmbedBuilder()
            .setColor("DarkRed")
            .setTitle("🚨 COMPTE STAFF DESTITUÉ & MIS EN QUARANTAINE 🚨")
            .setDescription(`**Auteur de l'infraction :** ${member.user} (\`${member.id}\`)\n**Raison :** ${reason}\n\n🔒 **Mesure :** Rôles révoqués immédiatement. Sabotage avorté.`);

        const logChannel = await guild.channels.fetch(CHANNELS.ANTI_RAID).catch(() => null);
        if (logChannel) {
            logChannel.send({ content: `<@${WHITELIST_CEO_ID}>`, embeds: [emergencyEmbed] }).catch(() => {});
        }
        return true;
    };

    // =====================================================
    // 📨 ACTIVATION MANUELLE ET CONFINEMENT MILITAIRE (+)
    // =====================================================
    client.on("messageCreate", async (message) => {
        if (!message.guild || message.author.bot) return;

        // 1. BLOCAGE STRICT DE TOUS LES LIENS INTERNET SI LE BUNKER EST ACTIF
        if (BUNKER_MODE && message.author.id !== WHITELIST_CEO_ID) {
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            if (urlRegex.test(message.content)) {
                await message.delete().catch(() => {});
                return message.channel.send(`⚠️ ${message.author}, le partage de liens est verrouillé pendant l'état de siège.`)
                    .then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
            }
        }

        // 🔒 ORDONNER LE MODE BUNKER (Seul ton ID Whitelist a la clé)
        if (message.content.startsWith("+bunker-on")) {
            if (message.author.id !== WHITELIST_CEO_ID) {
                const intruder = message.member;
                if (intruder) await isolateStaff(message.guild, intruder, "Tentative d'accès illégale à l'armement du Bunker");
                return await message.delete().catch(() => {});
            }

            const args = message.content.split(" ");
            if (args[1] === BUNKER_SECRET_KEY) {
                BUNKER_MODE = true;
                await message.delete().catch(() => {});
                
                const bunkerEmbed = new EmbedBuilder()
                    .setColor("DarkRed")
                    .setTitle("🛡️ ÉTAT DE SIÈGE CYBERNÉTIQUE : MURAILLES ARMÉES")
                    .setDescription(`🔒 **La catégorie <#${BUNKER_CATEGORY_ID}> est désormais blindée électroniquement.**\n\n⚡ **Protocoles appliqués instantanément :**\n• Suppression immédiate de toutes les invitations.\n• Expulsion automatique de tous les salons vocaux.\n• Injection du rôle de confinement à tous les membres.\n• Blocage hermétique de tous les liens internet (\`http/https\`).`);
                sendLog(CHANNELS.ANTI_RAID, bunkerEmbed);

                const guild = message.guild;

                // A. GEL ET SUPPRESSION DES INVITATIONS DU SERVEUR
                const invites = await guild.invites.fetch().catch(() => null);
                if (invites) {
                    invites.forEach(invite => invite.delete("Urgence Mode Bunker Actif").catch(() => {}));
                }

                // B. REQUÊTE COMPLÈTE DE TOUS LES MEMBRES POUR CONFINEMENT INTERNE
                const members = await guild.members.fetch();
                members.forEach(member => {
                    // Isolation Vocale : On les déconnecte des salons vocaux s'ils y sont
                    if (member.voice.channelId) {
                        member.voice.disconnect("Urgence : Confinement Bunker Global").catch(() => {});
                    }

                    // Attribution du Rôle de Crise
                    if (!member.user.bot && member.id !== WHITELIST_CEO_ID) {
                        member.roles.add(BUNKER_ROLE_ID, "Alerte Raid : Confinement Bunker").catch(() => {});
                    }
                });
                return;
            } else {
                return message.reply("❌ Clé maîtresse invalide.").then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
            }
        }

        // 🔓 LEVER LE MODE BUNKER (Fin de crise)
        if (message.content.startsWith("+bunker-off")) {
            if (message.author.id !== WHITELIST_CEO_ID) return;
            
            const args = message.content.split(" ");
            if (args[1] === BUNKER_SECRET_KEY) {
                BUNKER_MODE = false;
                await message.delete().catch(() => {});
                
                const bunkerOffEmbed = new EmbedBuilder()
                    .setColor("Green")
                    .setTitle("🔓 LE SIÈGE EST LEVÉ : RETOUR AU STATUT NORMAL")
                    .setDescription("♻️ **Désarmement :** Nettoyage et retrait du rôle de confinement sur l'ensemble du serveur en cours...");
                sendLog(CHANNELS.ANTI_RAID, bunkerOffEmbed);

                const members = await message.guild.members.fetch();
                members.forEach(member => {
                    if (member.roles.cache.has(BUNKER_ROLE_ID)) {
                        member.roles.remove(BUNKER_ROLE_ID, "Fin d'alerte : Bunker désarmé").catch(() => {});
                    }
                });
                return;
            } else {
                return message.reply("❌ Clé maîtresse invalide.").then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
            }
        }
    });

    // =====================================================
    // 👤 ANTI-CHANGEMENT DE PSEUDO (BUNKER MODE ACTIF)
    // =====================================================
    client.on("guildMemberUpdate", async (oldMember, newMember) => {
        if (!BUNKER_MODE) return;
        if (newMember.id === WHITELIST_CEO_ID) return;

        // Si l'utilisateur change son pseudo sur le serveur pour tricher ou s'infiltrer
        if (oldMember.nickname !== newMember.nickname) {
            await newMember.setNickname(oldMember.nickname, "Sécurité Bunker : Interdiction de modifier son identité pendant le raid").catch(() => {});
        }
    });

    // =====================================================
    // ⚙️ PROTECTION DE STRUCTURE COMPORTEMENTALE (ANTI-NUKE)
    // =====================================================
    client.on("channelDelete", async (channel) => {
        if (!channel.guild) return;
        const guild = channel.guild;
        const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: 12 }).catch(() => null);
        const entry = auditLogs?.entries.first();
        if (!entry) return;

        const executor = entry.executor;

        // 🔥 PROTECTION SANS FAILLE DE LA CATÉGORIE BUNKER
        if (BUNKER_MODE && (channel.id === BUNKER_CATEGORY_ID || channel.parentId === BUNKER_CATEGORY_ID)) {
            const staffMember = await guild.members.fetch(executor.id).catch(() => null);
            if (staffMember) {
                await isolateStaff(guild, staffMember, "Tentative critique de destruction de la zone Bunkerisée");
                
                // Reconstruction instantanée à la volée informatique
                await guild.channels.create({
                    name: channel.name,
                    type: channel.type,
                    parent: channel.parentId === BUNKER_CATEGORY_ID ? BUNKER_CATEGORY_ID : null,
                    permissionOverwrites: channel.permissionOverwrites.cache.map(o => ({ id: o.id, type: o.type, allow: o.allow.bitfield, deny: o.deny.bitfield }))
                }).catch(() => {});
            }
            return;
        }

        if (!deletedChannelsBackup.has(guild.id)) deletedChannelsBackup.set(guild.id, []);
        deletedChannelsBackup.get(guild.id).push({
            name: channel.name,
            type: channel.type,
            parentID: channel.parentId,
            permissionOverwrites: channel.permissionOverwrites.cache.map(o => ({ id: o.id, type: o.type, allow: o.allow.bitfield, deny: o.deny.bitfield }))
        });

        const logEmbed = new EmbedBuilder()
            .setColor("Orange")
            .setTitle("🗑️ Salon Supprimé")
            .setDescription(`**Salon :** \`#${channel.name}\`\n**Auteur :** <@${executor.id}>`);
        sendLog(CHANNELS.LOGS_SALONS, logEmbed);

        if (executor.id === WHITELIST_CEO_ID) return;

        const now = Date.now();
        if (!channelDeleteCounter.has(executor.id)) channelDeleteCounter.set(executor.id, []);
        const timestamps = channelDeleteCounter.get(executor.id).filter(t => now - t < TIME_WINDOW);
        timestamps.push(now);
        channelDeleteCounter.set(executor.id, timestamps);

        if (timestamps.length >= ACTION_LIMIT) {
            const staffMember = await guild.members.fetch(executor.id).catch(() => null);
            if (staffMember) await isolateStaff(guild, staffMember, "Suppression massive de salons");
        }
    });

    client.on("channelUpdate", async (oldChannel, newChannel) => {
        if (!newChannel.guild) return;
        const guild = newChannel.guild;

        if (BUNKER_MODE && (newChannel.id === BUNKER_CATEGORY_ID || newChannel.parentId === BUNKER_CATEGORY_ID)) {
            const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: 11 }).catch(() => null);
            const entry = auditLogs?.entries.first();
            if (!entry || entry.executor.id === WHITELIST_CEO_ID) return;

            const staffMember = await guild.members.fetch(entry.executor.id).catch(() => null);
            if (staffMember) {
                await isolateStaff(guild, staffMember, "Altération structurelle non autorisée de la zone Bunker");
                await newChannel.edit({ name: oldChannel.name, parent: oldChannel.parentId }).catch(() => {});
            }
        }
    });

    client.on("channelCreate", async (channel) => {
        if (!channel.guild) return;
        const guild = channel.guild;
        const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: 10 }).catch(() => null);
        const entry = auditLogs?.entries.first();
        if (!entry) return;

        const executor = entry.executor;

        if (BUNKER_MODE && channel.parentId === BUNKER_CATEGORY_ID && executor.id !== WHITELIST_CEO_ID) {
            await channel.delete("Protection Bunker active").catch(() => {});
            const staffMember = await guild.members.fetch(executor.id).catch(() => null);
            if (staffMember) await isolateStaff(guild, staffMember, "Tentative de modification spatiale du Bunker");
            return;
        }

        const logEmbed = new EmbedBuilder()
            .setColor("Green")
            .setTitle("➕ Salon Créé")
            .setDescription(`**Salon :** ${channel}\n**Auteur :** <@${executor.id}>`);
        sendLog(CHANNELS.LOGS_SALONS, logEmbed);

        if (executor.id === WHITELIST_CEO_ID) return;

        const now = Date.now();
        if (!channelCreateCounter.has(executor.id)) channelCreateCounter.set(executor.id, []);
        const timestamps = channelCreateCounter.get(executor.id).filter(t => now - t < TIME_WINDOW);
        timestamps.push(now);
        channelCreateCounter.set(executor.id, timestamps);

        if (timestamps.length >= ACTION_LIMIT) {
            const staffMember = await guild.members.fetch(executor.id).catch(() => null);
            if (staffMember) {
                await channel.delete("Sécurité Anti-Nuke").catch(() => {});
                await isolateStaff(guild, staffMember, "Création abusive et en chaîne de salons");
            }
        }
    });

    // =====================================================
    // 🚪 FLUX ENTRÉES : FILTRAGE DES COMPTES RÉCENTS
    // =====================================================
    client.on("guildMemberAdd", async (member) => {
        const guild = member.guild;
        const now = Date.now();

        globalJoinTimestamps = globalJoinTimestamps.filter(t => now - t < RAID_FLUX_WINDOW);
        globalJoinTimestamps.push(now);

        if (globalJoinTimestamps.length >= RAID_FLUX_LIMIT && !FLUX_RAID_ALERT_ACTIVE) {
            FLUX_RAID_ALERT_ACTIVE = true;
            const alertFluxEmbed = new EmbedBuilder()
                .setColor("Orange")
                .setTitle("⚠️ ALERTE FLUX D'ARRIVÉE RECONNU")
                .setDescription(`Une grappe d'utilisateurs rapprochement configurée (\`${globalJoinTimestamps.length}\` comptes) pénètre sur le serveur.\n\n🛡️ Activation du filtrage automatique par étiquette **Suspect**.`);
            sendLog(CHANNELS.ANTI_RAID, alertFluxEmbed);
        }

        if (member.user.bot) {
            const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: 28 }).catch(() => null);
            const entry = auditLogs?.entries.first();
            
            if (entry && entry.executor.id !== WHITELIST_CEO_ID) {
                await member.ban({ reason: "Anti-Bot Raid." }).catch(() => {});
                const staffMember = await guild.members.fetch(entry.executor.id).catch(() => null);
                if (staffMember) await isolateStaff(guild, staffMember, `A injecté un robot sans clé d'autorisation (${member.user.tag})`);
            } else if (!entry) {
                await member.kick("Anti-Bot.").catch(() => {});
            }
            return;
        }

        const accountAge = now - member.user.createdTimestamp;
        if (accountAge < ACCOUNT_AGE_LIMIT || FLUX_RAID_ALERT_ACTIVE) {
            const suspectRole = guild.roles.cache.get(SUSPECT_ROLE_ID);
            if (suspectRole) await member.roles.add(suspectRole).catch(() => {});

            const reasonStr = accountAge < ACCOUNT_AGE_LIMIT ? "Compte trop récent (<24h)" : "Protection de Flux Actif";
            const suspectEmbed = new EmbedBuilder()
                .setColor("Orange")
                .setTitle("🔍 COMPTE FANTÔME ISOLÉ")
                .setDescription(`**Membre :** ${member.user} (\`${member.id}\`)\n**Motif de quarantaine :** ${reasonStr}`)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }));
            sendLog(CHANNELS.ANTI_RAID, suspectEmbed);
        }
    });

    // =====================================================
    // 👑 INTERCEPTION DES PRIVILÈGES (ANTI-NUKE RÔLES)
    // =====================================================
    client.on("roleDelete", async (role) => {
        const guild = role.guild;
        const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: 32 }).catch(() => null);
        const entry = auditLogs?.entries.first();
        if (!entry) return;

        const executor = entry.executor;

        if (!deletedRolesBackup.has(guild.id)) deletedRolesBackup.set(guild.id, []);
        deletedRolesBackup.get(guild.id).push({
            name: role.name,
            color: role.color,
            hoist: role.hoist,
            permissions: role.permissions.bitfield,
            mentionable: role.mentionable
        });

        const logEmbed = new EmbedBuilder()
            .setColor("Red")
            .setTitle("🗑️ Rôle Supprimé")
            .setDescription(`**Rôle :** \`@${role.name}\`\n**Auteur :** <@${executor.id}>`);
        sendLog(CHANNELS.LOGS_ROLES, logEmbed);

        if (executor.id === WHITELIST_CEO_ID) return;

        const now = Date.now();
        if (!roleDeleteCounter.has(executor.id)) roleDeleteCounter.set(executor.id, []);
        const timestamps = roleDeleteCounter.get(executor.id).filter(t => now - t < TIME_WINDOW);
        timestamps.push(now);
        roleDeleteCounter.set(executor.id, timestamps);

        if (timestamps.length >= ACTION_LIMIT) {
            const staffMember = await guild.members.fetch(executor.id).catch(() => null);
            if (staffMember) await isolateStaff(guild, staffMember, "Suppression compulsive de rôles importants");
        }
    });

    client.on("roleUpdate", async (oldRole, newRole) => {
        const guild = newRole.guild;
        const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: 31 }).catch(() => null);
        const entry = auditLogs?.entries.first();
        if (!entry) return;

        const executor = entry.executor;
        if (executor.id === WHITELIST_CEO_ID) return;

        const hadAdmin = oldRole.permissions.has(PermissionsBitField.Flags.Administrator);
        const hasAdmin = newRole.permissions.has(PermissionsBitField.Flags.Administrator);

        if (!hadAdmin && hasAdmin) {
            await newRole.setPermissions(oldRole.permissions.bitfield, "Anti-Nuke : Tentative d'élévation illégale").catch(() => {});
            const staffMember = await guild.members.fetch(executor.id).catch(() => null);
            if (staffMember) await isolateStaff(guild, staffMember, `A tenté d'offrir les droits Administrateur au rôle @${newRole.name}`);
        }
    });

    client.on("roleCreate", async (role) => {
        const guild = role.guild;
        const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: 30 }).catch(() => null);
        const entry = auditLogs?.entries.first();
        if (!entry) return;

        const executor = entry.executor;

        const logEmbed = new EmbedBuilder()
            .setColor("Green")
            .setTitle("➕ Rôle Créé")
            .setDescription(`**Rôle :** ${role}\n**Auteur :** <@${executor.id}>`);
        sendLog(CHANNELS.LOGS_ROLES, logEmbed);

        if (executor.id === WHITELIST_CEO_ID) return;

        const now = Date.now();
        if (!roleCreateCounter.has(executor.id)) roleCreateCounter.set(executor.id, []);
        const timestamps = roleCreateCounter.get(executor.id).filter(t => now - t < TIME_WINDOW);
        timestamps.push(now);
        roleCreateCounter.set(executor.id, timestamps);

        if (timestamps.length >= ACTION_LIMIT) {
            const staffMember = await guild.members.fetch(executor.id).catch(() => null);
            if (staffMember) {
                await role.delete("Sécurité Anti-Nuke").catch(() => {});
                await isolateStaff(guild, staffMember, "Inondation et génération anormale de rôles");
            }
        }
    });

    // =====================================================
    // 🔨 EXPULSIONS EN SÉRIE ET MONITORING (MASS KICK/BAN)
    // =====================================================
    client.on("guildBanAdd", async (ban) => {
        const guild = ban.guild;
        const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: 22 }).catch(() => null);
        const entry = auditLogs?.entries.first();
        if (!entry) return;
        const executor = entry.executor;

        const logEmbed = new EmbedBuilder()
            .setColor("DarkRed")
            .setTitle("🔨 Membre Banni")
            .setDescription(`**Utilisateur :** ${ban.user.tag}\n**Modérateur :** <@${executor.id}>`);
        sendLog(CHANNELS.LOGS_MODERATION, logEmbed);
    });

    client.on("guildAuditLogEntryCreate", async (auditLogEntry, guild) => {
        if (auditLogEntry.actionType !== 24) return; // 24 = MEMBER_KICK
        const executorId = auditLogEntry.executorId;
        if (executorId === WHITELIST_CEO_ID) return;

        const logEmbed = new EmbedBuilder()
            .setColor("Orange")
            .setTitle("👢 Membre Exclu (Kick)")
            .setDescription(`**Cible :** <@${auditLogEntry.targetId}>\n**Modérateur :** <@${executorId}>`);
        sendLog(CHANNELS.LOGS_MODERATION, logEmbed);

        const now = Date.now();
        if (!kickCounter.has(executorId)) kickCounter.set(executorId, []);
        const timestamps = kickCounter.get(executorId).filter(t => now - t < TIME_WINDOW);
        timestamps.push(now);
        kickCounter.set(executorId, timestamps);

        if (timestamps.length >= ACTION_LIMIT) {
            const staffMember = await guild.members.fetch(executorId).catch(() => null);
            if (staffMember) await isolateStaff(guild, staffMember, "Destruction par expulsions massives (Mass Kick)");
        }
    });

    // =====================================================
    // 🎛️ COLLECTEUR GLOBAL DE RESTAURATION
    // =====================================================
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        
        if (interaction.customId === "nuke_clear_flux") {
            if (interaction.user.id !== WHITELIST_CEO_ID) return;
            FLUX_RAID_ALERT_ACTIVE = false;
            return interaction.reply({ content: "🔓 Statut de Flux réinitialisé.", ephemeral: true });
        }

        if (interaction.customId !== "nuke_restore_all") return;
        if (interaction.user.id !== WHITELIST_CEO_ID) return interaction.reply({ content: "❌ Accès nié.", ephemeral: true });

        await interaction.deferUpdate();
        const guild = interaction.guild;

        const channelsToRestore = deletedChannelsBackup.get(guild.id) || [];
        for (const ch of channelsToRestore) {
            await guild.channels.create({
                name: ch.name,
                type: ch.type,
                parent: ch.parentID,
                permissionOverwrites: ch.permissionOverwrites
            }).catch(() => {});
        }
        deletedChannelsBackup.delete(guild.id);

        const rolesToRestore = deletedRolesBackup.get(guild.id) || [];
        for (const rl of rolesToRestore) {
            await guild.roles.create({
                name: rl.name,
                color: rl.color,
                hoist: rl.hoist,
                permissions: rl.permissions,
                mentionable: rl.mentionable
            }).catch(() => {});
        }
        deletedRolesBackup.delete(guild.id);

        const successEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor("Green")
            .setTitle("✅ SYNC MIROIR OPÉRATIONNELLE")
            .setDescription("Les structures détruites ont été recréées à l'identique.");
        await interaction.editReply({ embeds: [successEmbed], components: [] }).catch(() => {});
    };
};
