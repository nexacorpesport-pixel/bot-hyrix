const {
    PermissionsBitField,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    MessageFlags
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "fortress_security_db.json");

let db = { channels: {}, roles: {}, bunkerActive: false };
if (fs.existsSync(DB_PATH)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    } catch (e) {
        console.log("[Security] Base de données corrompue, reset en cours...");
    }
}

const saveDb = () => {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
    } catch (e) {
        console.log("[Security] Erreur sauvegarde DB");
    }
};

// Configs anti-nuke & anti-raid
const WINDOW_TIME = 10000; 
const LIMIT_ACTIONS = 2;       
const MIN_AGE_ACCOUNT = 86400000; 

const RAID_WINDOW = 30000; 
const RAID_LIMIT = 5;          
let recentJoins = [];
let raidAlertOn = false;

const BUNKER_KEY = "AZ-99X-BUNK-7421-ZOR";
const BUNKER_CAT = "1522353418226896997"; 
const BUNKER_ROLE = "1522354308635689040";

const staffScores = new Map();
const staffCooldowns = new Map();

module.exports = (client) => {

    console.log("[Aeroz Security] Module activé et opérationnel.");

    const OWNER_ID = "1501625944148934758";
    const SUSPECT_ROLE = "1522353482252947508"; 
    
    const CHANNELS = {
        ANTI_RAID: "1522354528626802728",
        LOGS_CHANNELS: "1522354627633217597",
        LOGS_ROLES: "1522354480631517204",
        LOGS_MOD: "1522354679831461949"
    };

    const sendLog = async (chanId, embed) => {
        const chan = await client.channels.fetch(chanId).catch(() => null);
        if (chan) chan.send({ embeds: [embed.setTimestamp()] }).catch(() => {});
    };

    const removeStaffPermissions = async (guild, member, reason) => {
        if (member.id === OWNER_ID || member.id === guild.ownerId) return false;

        if (member.user.bot) {
            await member.ban({ reason: `[Anti-Nuke] Bot suspect détecté: ${reason}` }).catch(() => {});
            return true;
        }

        const rolesToStrip = member.roles.cache.filter(r => r.id !== guild.roles.everyone.id);
        await member.roles.remove(rolesToStrip, `[Security] ${reason}`).catch(() => {});

        const alertEmbed = new EmbedBuilder()
            .setColor("#b71c1c") 
            .setTitle("🚨 COMPTE STAFF SÉCURISÉ (QUARANTAINE) 🚨")
            .setDescription(`**Utilisateur :** ${member.user} (\`${member.id}\`)\n**Raison :** ${reason}\n\n⚠️ Par mesure de sécurité, tous ses rôles lui ont été retirés.`);

        const logChan = await guild.channels.fetch(CHANNELS.ANTI_RAID).catch(() => null);
        if (logChan) {
            logChan.send({ content: `<@${OWNER_ID}>`, embeds: [alertEmbed] }).catch(() => {});
        }
        return true;
    };

    const verifyStaffActivity = async (guild, userId, penalty, actionLabel) => {
        if (userId === OWNER_ID || userId === guild.ownerId) return false;

        const timeNow = Date.now();
        if (!staffCooldowns.has(userId)) staffCooldowns.set(userId, []);
        
        let history = staffCooldowns.get(userId).filter(t => timeNow - t < WINDOW_TIME);
        history.push(timeNow);
        staffCooldowns.set(userId, history);

        let userScore = (staffScores.get(userId) || 0) + penalty;
        staffScores.set(userId, userScore);

        setTimeout(() => {
            let current = staffScores.get(userId) || 0;
            if (current > 0) staffScores.set(userId, Math.max(0, current - penalty));
        }, WINDOW_TIME);

        if (history.length >= LIMIT_ACTIONS || userScore >= 10) {
            const staffUser = await guild.members.fetch(userId).catch(() => null);
            if (staffUser) {
                await removeStaffPermissions(guild, staffUser, `Abus d'actions admin rapides (${actionLabel})`);
                return true;
            }
        }
        return false;
    };

    // --- ECOUTEURS MESSAGES ---
    client.on("messageCreate", async (msg) => {
        if (!msg.guild || msg.author.bot) return;

        // Restriction de liens si bunker ON
        if (db.bunkerActive && msg.author.id !== OWNER_ID) {
            const hasLink = /(https?:\/\/[^\s]+)/g.test(msg.content);
            if (hasLink) {
                await msg.delete().catch(() => {});
                return msg.channel.send(`⚠️ ${msg.author}, les liens et médias sont interdits pendant que le mode Bunker est actif.`)
                    .then(m => setTimeout(() => m.delete().catch(() => {}), 3500));
            }
        }

        // Commande ON
        if (msg.content.startsWith("+bunker-on")) {
            if (msg.author.id !== OWNER_ID) {
                if (msg.member) await removeStaffPermissions(msg.guild, msg.member, "Tentative d'allumage forcée du Bunker");
                return await msg.delete().catch(() => {});
            }

            const checkKey = msg.content.split(" ")[1];
            if (checkKey === BUNKER_KEY) {
                db.bunkerActive = true;
                saveDb();
                await msg.delete().catch(() => {});
                
                const onEmbed = new EmbedBuilder()
                    .setColor("#b71c1c")
                    .setTitle("🛡️ MODE BUNKER ACTIVÉ — AEROZ")
                    .setDescription(`Le salon <#${BUNKER_CAT}> a été confiné.\n\n**Mesures prises immédiatement :**\n- Suppression de toutes les invitations valides.\n- Déconnexion forcée des salons vocaux.\n- Attribution automatique du rôle de restriction.\n- Blocage des liens externes.`);
                sendLog(CHANNELS.ANTI_RAID, onEmbed);

                const server = msg.guild;

                const currentInvites = await server.invites.fetch().catch(() => null);
                if (currentInvites) {
                    currentInvites.forEach(inv => inv.delete("Bunker ON").catch(() => {}));
                }

                const allMembers = await server.members.fetch();
                allMembers.forEach(m => {
                    if (m.voice.channelId) m.voice.disconnect("Alerte Confinement").catch(() => {});
                    if (!m.user.bot && m.id !== OWNER_ID) {
                        m.roles.add(BUNKER_ROLE, "Confinement Bunker").catch(() => {});
                    }
                });
            } else {
                return msg.reply("❌ Clé incorrecte.").then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
            }
        }

        // Commande OFF
        if (msg.content.startsWith("+bunker-off")) {
            if (msg.author.id !== OWNER_ID) return;
            
            const checkKey = msg.content.split(" ")[1];
            if (checkKey === BUNKER_KEY) {
                db.bunkerActive = false;
                saveDb();
                await msg.delete().catch(() => {});
                
                const offEmbed = new EmbedBuilder()
                    .setColor("#2e7d32")
                    .setTitle("🔓 MODE BUNKER DÉSACTIVÉ — AEROZ")
                    .setDescription("Le serveur retourne à la normale. Retrait progressif des restrictions.");
                sendLog(CHANNELS.ANTI_RAID, offEmbed);

                const allMembers = await msg.guild.members.fetch();
                allMembers.forEach(m => {
                    if (m.roles.cache.has(BUNKER_ROLE)) {
                        m.roles.remove(BUNKER_ROLE, "Fin de l'alerte").catch(() => {});
                    }
                });
            } else {
                return msg.reply("❌ Clé incorrecte.").then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
            }
        }
    });

    // Anti-Changement de pseudo sous bunker
    client.on("guildMemberUpdate", async (oldM, newM) => {
        if (!db.bunkerActive || newM.id === OWNER_ID) return;
        if (oldM.nickname !== newM.nickname) {
            await newM.setNickname(oldM.nickname, "Bunker: Pseudos verrouillés").catch(() => {});
        }
    });

    // Anti Guild Modification
    client.on("guildUpdate", async (oldG, newG) => {
        const logs = await newG.fetchAuditLogs({ limit: 1, type: 1 }).catch(() => null);
        const logEntry = logs?.entries.first();
        if (!logEntry) return;

        const user = logEntry.executor;
        if (user.id === OWNER_ID || user.id === newG.ownerId) return;

        if (oldG.name !== newG.name) await newG.setName(oldG.name).catch(() => {});
        if (oldG.icon !== newG.icon) await newG.setIcon(oldG.iconURL()).catch(() => {});

        const badStaff = await newG.members.fetch(user.id).catch(() => null);
        if (badStaff) await removeStaffPermissions(newG, badStaff, "Modification non autorisée des paramètres du serveur");
    });

    // Protection des salons
    client.on("channelDelete", async (channel) => {
        if (!channel.guild) return;
        const server = channel.guild;
        const logs = await server.fetchAuditLogs({ limit: 1, type: 12 }).catch(() => null);
        const logEntry = logs?.entries.first();
        if (!logEntry) return;

        const user = logEntry.executor;

        db.channels[channel.id] = {
            name: channel.name,
            type: channel.type,
            parent: channel.parentId,
            position: channel.position,
            permissionOverwrites: channel.permissionOverwrites.cache.map(o => ({ id: o.id, type: o.type, allow: o.allow.bitfield.toString(), deny: o.deny.bitfield.toString() }))
        };
        saveDb();

        if (db.bunkerActive && (channel.id === BUNKER_CAT || channel.parentId === BUNKER_CAT)) {
            const badStaff = await server.members.fetch(user.id).catch(() => null);
            if (badStaff) {
                await removeStaffPermissions(server, badStaff, "Tentative de suppression de la zone protégée");
                
                await server.channels.create({
                    name: channel.name,
                    type: channel.type,
                    parent: channel.parentId,
                    position: channel.position,
                    permissionOverwrites: channel.permissionOverwrites.cache.map(o => ({ id: o.id, type: o.type, allow: o.allow.bitfield, deny: o.deny.bitfield }))
                }).catch(() => {});
            }
            return;
        }

        const logEmbed = new EmbedBuilder()
            .setColor("#ef6c00")
            .setTitle("🗑️ Salon supprimé")
            .setDescription(`**Salon :** \`#${channel.name}\`\n**Par :** <@${user.id}>`);
        sendLog(CHANNELS.LOGS_CHANNELS, logEmbed);

        await verifyStaffActivity(server, user.id, 4, "Suppression Salon");
    });

    client.on("channelCreate", async (channel) => {
        if (!channel.guild) return;
        const server = channel.guild;
        const logs = await server.fetchAuditLogs({ limit: 1, type: 10 }).catch(() => null);
        const logEntry = logs?.entries.first();
        if (!logEntry) return;

        const user = logEntry.executor;

        if (db.bunkerActive && user.id !== OWNER_ID) {
            await channel.delete("Sécurité Bunker").catch(() => {});
            const badStaff = await server.members.fetch(user.id).catch(() => null);
            if (badStaff) await removeStaffPermissions(server, badStaff, "Création de salon interdite sous Bunker");
            return;
        }

        const logEmbed = new EmbedBuilder()
            .setColor("#2e7d32")
            .setTitle("➕ Salon créé")
            .setDescription(`**Salon :** ${channel}\n**Par :** <@${user.id}>`);
        sendLog(CHANNELS.LOGS_CHANNELS, logEmbed);

        await verifyStaffActivity(server, user.id, 3, "Création Salon");
    });

    // Anti-Raid Joins
    client.on("guildMemberAdd", async (member) => {
        const server = member.guild;
        const timeNow = Date.now();

        recentJoins = recentJoins.filter(t => timeNow - t < RAID_WINDOW);
        recentJoins.push(timeNow);

        if (recentJoins.length >= RAID_LIMIT && !raidAlertOn) {
            raidAlertOn = true;
            const alertEmbed = new EmbedBuilder()
                .setColor("#ef6c00")
                .setTitle("⚠️ RECONNAISSANCE DE RAID EN COURS")
                .setDescription(`Détection de \`${recentJoins.length}\` entrées trop rapides.\n\nTous les nouveaux comptes passent automatiquement en restriction.`);
            sendLog(CHANNELS.ANTI_RAID, alertEmbed);
        }

        if (member.user.bot) {
            const logs = await server.fetchAuditLogs({ limit: 1, type: 28 }).catch(() => null);
            const logEntry = logs?.entries.first();
            
            if (logEntry && logEntry.executor.id !== OWNER_ID) {
                await member.ban({ reason: "Bot non autorisé par l'admin principal" }).catch(() => {});
                const badStaff = await server.members.fetch(logEntry.executor.id).catch(() => null);
                if (badStaff) await removeStaffPermissions(server, badStaff, `Ajout d'un bot suspect : (${member.user.tag})`);
            } else if (!logEntry) {
                await member.kick("Bot suspect sans log d'invitation").catch(() => {});
            }
            return;
        }

        const age = timeNow - member.user.createdTimestamp;
        if (age < MIN_AGE_ACCOUNT || raidAlertOn || db.bunkerActive) {
            const role = server.roles.cache.get(SUSPECT_ROLE);
            if (role) await member.roles.add(role).catch(() => {});

            let lockReason = "Compte créé il y que quelques heures (<24h)";
            if (db.bunkerActive) lockReason = "Mode Bunker actuellement en cours";
            else if (raidAlertOn) lockReason = "Alerte Anti-Raid activée";

            const suspectEmbed = new EmbedBuilder()
                .setColor("#ef6c00")
                .setTitle("🔍 SÉCURISATION NOUVEAU MEMBRE")
                .setDescription(`**Membre :** ${member.user} (\`${member.id}\`)\n**Raison :** ${lockReason}`)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }));
            sendLog(CHANNELS.ANTI_RAID, suspectEmbed);
        }
    });

    // Protection des Rôles
    client.on("roleDelete", async (role) => {
        const server = role.guild;
        const logs = await server.fetchAuditLogs({ limit: 1, type: 32 }).catch(() => null);
        const logEntry = logs?.entries.first();
        if (!logEntry) return;

        const user = logEntry.executor;

        db.roles[role.id] = {
            name: role.name,
            color: role.color,
            hoist: role.hoist,
            permissions: role.permissions.bitfield.toString(),
            mentionable: role.mentionable
        };
        saveDb();

        const logEmbed = new EmbedBuilder()
            .setColor("#c62828")
            .setTitle("🗑️ Rôle supprimé")
            .setDescription(`**Rôle :** \`@${role.name}\`\n**Par :** <@${user.id}>`);
        sendLog(CHANNELS.LOGS_ROLES, logEmbed);

        await verifyStaffActivity(server, user.id, 5, "Suppression Rôle");
    });

    client.on("roleUpdate", async (oldR, newR) => {
        const server = newR.guild;
        const logs = await server.fetchAuditLogs({ limit: 1, type: 31 }).catch(() => null);
        const logEntry = logs?.entries.first();
        if (!logEntry) return;

        const user = logEntry.executor;
        if (user.id === OWNER_ID) return;

        const oldAdmin = oldR.permissions.has(PermissionsBitField.Flags.Administrator);
        const newAdmin = newR.permissions.has(PermissionsBitField.Flags.Administrator);

        if (!oldAdmin && newAdmin) {
            await newR.setPermissions(oldR.permissions.bitfield, "Anti-Nuke: Ajout Admin bloqué").catch(() => {});
            const badStaff = await server.members.fetch(user.id).catch(() => null);
            if (badStaff) await removeStaffPermissions(server, badStaff, `Tentative d'ajout de la permission Administrateur sur le rôle @${newR.name}`);
        }
    });

    // Interactions Boutons (Restauration)
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        
        if (interaction.customId === "nuke_clear_flux") {
            if (interaction.user.id !== OWNER_ID) return;
            raidAlertOn = false;
            return interaction.reply({ content: "L'alerte de flux a été reset.", flags: [MessageFlags.Ephemeral] });
        }

        if (interaction.customId !== "nuke_restore_all") return;
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: "Refusé.", flags: [MessageFlags.Ephemeral] });
        }

        await interaction.deferUpdate();
        const server = interaction.guild;

        for (const [id, ch] of Object.entries(db.channels)) {
            await server.channels.create({
                name: ch.name,
                type: ch.type,
                parent: ch.parentId,
                position: ch.position,
                permissionOverwrites: ch.permissionOverwrites.map(o => ({ id: o.id, type: o.type, allow: o.allow, deny: o.deny }))
            }).catch(() => {});
        }
        db.channels = {};

        for (const [id, rl] of Object.entries(db.roles)) {
            await server.roles.create({
                name: rl.name,
                color: rl.color,
                hoist: rl.hoist,
                permissions: BigInt(rl.permissions),
                mentionable: rl.mentionable
            }).catch(() => {});
        }
        db.roles = {};
        saveDb();

        const cleanEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor("#2e7d32")
            .setTitle("✅ RESTAURATION TERMINÉE")
            .setDescription("La structure des salons et des rôles enregistrée en DB locale a été reconstruite.");
        await interaction.editReply({ embeds: [cleanEmbed], components: [] }).catch(() => {});
    });
};
