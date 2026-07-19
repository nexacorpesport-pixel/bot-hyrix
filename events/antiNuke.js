const {
    PermissionsBitField,
    EmbedBuilder
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "../data", "fortress_antispam_db.json"); // Correction du chemin vers le dossier data général

// Initialisation et chargement de la base de données sécurisée
let db = { 
    channels: {}, 
    roles: {}, 
    bunkerActive: false, 
    antiBot: true, 
    antiWebhook: true, 
    whitelist: [],
    limits: { channel: 3, role: 3, ban: 4 }
};

if (fs.existsSync(DB_PATH)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
        if (!db.whitelist) db.whitelist = [];
        if (!db.limits) db.limits = { channel: 3, role: 3, ban: 4 };
    } catch (e) {
        console.log("[Security] Base de données corrompue, réinitialisation...");
    }
}

const saveDb = () => {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
    } catch (e) {
        console.log("[Security] Erreur lors de la sauvegarde de la DB.");
    }
};

// Structures de surveillance temporaires (Mémoire vive)
const WINDOW_TIME = 60000; 
const actionTrackers = new Map(); 
const quarantineCache = new Map(); 

const RAID_WINDOW = 30000; 
const RAID_LIMIT = 5;          
let recentJoins = [];
let raidAlertOn = false;

// =====================================================
// ⚠️ CONFIGURATION DES IDENTIFIANTS (À MODIFIER AVEC TES NOUVEAUX IDs)
// =====================================================
const OWNER_ID = "1431661348218998948"; // Ton ID Discord personnel
const SUSPECT_ROLE = "1528212545758822536"; // ID du rôle "Muet" ou "Suspect" pour isoler les raids

const CHANNELS = {
    ANTI_RAID: "1528212628709703713",
    LOGS_CHANNELS: "1528212667930509462",
    LOGS_ROLES: "1528212709374562504",
    LOGS_MOD: "1528212748952142006"
};

module.exports = (client) => {

    console.log("[🛡️ AEROZ FORTRESS] Protocole de défense global activé.");

    // Envoi des logs réseau vers les salons dédiés avec sécurité intégrée
    const sendLog = async (chanId, embed) => {
        if (!chanId) return;
        const chan = await client.channels.fetch(chanId).catch(() => null);
        if (chan) chan.send({ embeds: [embed.setTimestamp()] }).catch(() => {});
    };

    // Vérifie si un membre du staff est immunisé
    const isImmune = (userId, guild) => {
        if (userId === OWNER_ID || userId === guild.ownerId) return true;
        return db.whitelist.includes(userId);
    };

    // Sanction suprême : Exclusion du staff abusif
    const executeStaffSanction = async (guild, userId, reason) => {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return;

        if (member.user.bot) {
            await member.ban({ reason: `[ANTI-NUKE SYSTEM] ${reason}` }).catch(() => {});
            return;
        }

        // Sauvegarde des rôles pour la commande de secours
        const rolesToStrip = member.roles.cache.filter(r => r.id !== guild.roles.everyone.id);
        quarantineCache.set(userId, rolesToStrip.map(r => r.id));

        // Bannissement immédiat suite à l'abus
        await member.ban({ reason: `[ANTI-NUKE QUOTA DETECTED] ${reason}` }).catch(() => {});

        const criticalEmbed = new EmbedBuilder()
            .setColor("#b71c1c")
            .setTitle("🚨 EXÉCUTION STAFF COMPTE : EXCLUSION 🚨")
            .setDescription(`**Staff Détecté :** ${member.user} (\`${userId}\`)\n**Raison :** ${reason}\n\n⚠️ L'entité a été bannie définitivement pour abus d'autorité.`);

        const alertChan = await guild.channels.fetch(CHANNELS.ANTI_RAID).catch(() => null);
        if (alertChan) alertChan.send({ content: `<@${OWNER_ID}>`, embeds: [criticalEmbed] }).catch(() => {});
    };

    // Gestion des quotas glissants
    const trackActionQuota = async (guild, userId, type, limitValue, actionLabel) => {
        if (isImmune(userId, guild)) return false;

        const now = Date.now();
        const trackingKey = `${userId}_${type}`;

        if (!actionTrackers.has(trackingKey)) actionTrackers.set(trackingKey, []);
        
        let timestamps = actionTrackers.get(trackingKey).filter(t => now - t < WINDOW_TIME);
        timestamps.push(now);
        actionTrackers.set(trackingKey, timestamps);

        if (timestamps.length > limitValue) {
            await executeStaffSanction(guild, userId, `Dépassement du quota pour : ${actionLabel} (${timestamps.length}/${limitValue} en moins d'1 min)`);
            return true;
        }
        return false;
    };

    // =====================================================
    // ⚙️ INTERCEPTIONS DES ACTIONS SÉCURITÉ
    // =====================================================

    // Surveillance Suppression Salons
    client.on("channelDelete", async (channel) => {
        if (!channel.guild) return;
        const server = channel.guild;
        const logs = await server.fetchAuditLogs({ limit: 1, type: 12 }).catch(() => null);
        const logEntry = logs?.entries.first();
        if (!logEntry) return;

        const executorId = logEntry.executor.id;

        db.channels[channel.id] = {
            name: channel.name,
            type: channel.type,
            parentId: channel.parentId,
            position: channel.position,
            permissionOverwrites: channel.permissionOverwrites.cache.map(o => ({ id: o.id, type: o.type, allow: o.allow.bitfield.toString(), deny: o.deny.bitfield.toString() }))
        };
        saveDb();

        const triggered = await trackActionQuota(server, executorId, "channel", db.limits.channel, "Suppression de Salons");
        if (triggered) return;

        const logEmbed = new EmbedBuilder()
            .setColor("#ef6c00")
            .setTitle("🗑️ Alerte : Salon Supprimé")
            .setDescription(`**Salon :** \`#${channel.name}\`\n**Exécuteur :** <@${executorId}>`);
        sendLog(CHANNELS.LOGS_CHANNELS, logEmbed);
    });

    // Surveillance Création Salons
    client.on("channelCreate", async (channel) => {
        if (!channel.guild) return;
        const server = channel.guild;
        const logs = await server.fetchAuditLogs({ limit: 1, type: 10 }).catch(() => null);
        const logEntry = logs?.entries.first();
        if (!logEntry) return;

        const executorId = logEntry.executor.id;

        if (db.bunkerActive && !isImmune(executorId, server)) {
            await channel.delete("Mode Bunker strict actif").catch(() => {});
            return;
        }

        await trackActionQuota(server, executorId, "channel", db.limits.channel, "Création de Salons");
    });

    // Surveillance Suppression Rôles
    client.on("roleDelete", async (role) => {
        if (!role.guild) return;
        const server = role.guild;
        const logs = await server.fetchAuditLogs({ limit: 1, type: 32 }).catch(() => null);
        const logEntry = logs?.entries.first();
        if (!logEntry) return;

        const executorId = logEntry.executor.id;

        db.roles[role.id] = {
            name: role.name,
            color: role.color,
            hoist: role.hoist,
            permissions: role.permissions.bitfield.toString(),
            mentionable: role.mentionable
        };
        saveDb();

        const triggered = await trackActionQuota(server, executorId, "role", db.limits.role, "Suppression de Rôles");
        if (triggered) return;

        const logEmbed = new EmbedBuilder()
            .setColor("#c62828")
            .setTitle("🗑️ Alerte : Rôle Supprimé")
            .setDescription(`**Rôle :** \`@${role.name}\`\n**Exécuteur :** <@${executorId}>`);
        sendLog(CHANNELS.LOGS_ROLES, logEmbed);
    });

    // Surveillance Bannissements Massifs
    client.on("guildBanAdd", async (ban) => {
        if (!ban.guild) return;
        const server = ban.guild;
        const logs = await server.fetchAuditLogs({ limit: 1, type: 22 }).catch(() => null);
        const logEntry = logs?.entries.first();
        if (!logEntry) return;

        const executorId = logEntry.executor.id;
        await trackActionQuota(server, executorId, "ban", db.limits.ban, "Bannissements de Membres");
    });

    // Anti-Bot et Anti-Raid Joins
    client.on("guildMemberAdd", async (member) => {
        const server = member.guild;
        const timeNow = Date.now();

        if (member.user.bot && db.antiBot) {
            const logs = await server.fetchAuditLogs({ limit: 1, type: 28 }).catch(() => null);
            const logEntry = logs?.entries.first();
            
            if (logEntry && !isImmune(logEntry.executor.id, server)) {
                await member.ban({ reason: "Anti-Bot Strict activé" }).catch(() => {});
                await executeStaffSanction(server, logEntry.executor.id, `Tentative d'ajout illicite du bot : ${member.user.tag}`);
            }
            return;
        }

        recentJoins = recentJoins.filter(t => timeNow - t < RAID_WINDOW);
        recentJoins.push(timeNow);

        if (recentJoins.length >= RAID_LIMIT && !raidAlertOn) {
            raidAlertOn = true;
            const alertEmbed = new EmbedBuilder()
                .setColor("#ef6c00")
                .setTitle("⚠️ ANALYSEUR RAID ENGAGÉ — FLUX CRITIQUE")
                .setDescription(`Détection de \`${recentJoins.length}\` entrées suspectes. Isolement immédiat.`);
            sendLog(CHANNELS.ANTI_RAID, alertEmbed);
        }

        if (raidAlertOn || db.bunkerActive) {
            const role = server.roles.cache.get(SUSPECT_ROLE);
            if (role) await member.roles.add(role).catch(() => {});
        }
    });

    // Anti-Webhook Modification / Création
    client.on("webhookUpdate", async (channel) => {
        if (!db.antiWebhook || !channel.guild) return;
        const server = channel.guild;
        const logs = await server.fetchAuditLogs({ limit: 1, type: 50 }).catch(() => null);
        const logEntry = logs?.entries.first();
        if (!logEntry) return;

        const executorId = logEntry.executor.id;
        if (!isImmune(executorId, server)) {
            const webhooks = await channel.fetchWebhooks().catch(() => null);
            if (webhooks) webhooks.forEach(w => w.delete("Anti-Webhook actif").catch(() => {}));
            await executeStaffSanction(server, executorId, "Création non autorisée d'un Webhook système");
        }
    });

    // =====================================================
    // COMMANDES TERMINAL DE CONTRÔLE
    // =====================================================
    client.on("messageCreate", async (msg) => {
        if (!msg.guild || msg.author.bot) return;
        if (!msg.content.startsWith("+")) return;

        const args = msg.content.slice(1).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        // Menu d'aide Privé
        if (command === "help-antinuke") {
            if (msg.author.id !== OWNER_ID) return;

            const helpEmbed = new EmbedBuilder()
                .setTitle("🛠️ Protocoles de Sécurité & Commandes d'Urgence")
                .setDescription("Index des commandes de crise prioritaires configurées sur le noyau réseau.")
                .setColor("#b71c1c")
                .addFields(
                    { name: "🚨 Actions Immédiates", value: "`+panic` - Active toutes les barrières au maximum de force.", inline: false },
                    { name: "⚙️ Configuration des Modules", value: "`+security-status` - Tableau de bord.\n`+toggle antibot` - Protection anti-bots.\n`+toggle antiwebhook` - Protection contre les webhooks.\n`+setlimit <channel/role/ban> [nombre]` - Ajuste les quotas.", inline: false },
                    { name: "👥 Gestion des Droits", value: "`+whitelist add/remove @membre` - Ajoute/Retire un adjoint.\n`+unquarantine @membre` - Restitue les rôles d'un membre purgé.", inline: false }
                )
                .setFooter({ text: "Aeroz Private Administration Terminal" });

            return msg.author.send({ embeds: [helpEmbed] })
                .then(() => msg.reply("📥 Le manuel de crise vous a été transmis en message privé."))
                .catch(() => msg.reply("❌ Impossible de vous envoyer le message privé. Vérifiez vos paramètres."));
        }

        // Sécurité stricte sur l'accès aux commandes
        if (["security-status", "toggle", "setlimit", "whitelist", "unquarantine", "panic"].includes(command)) {
            if (msg.author.id !== OWNER_ID) return await msg.delete().catch(() => {});
        }

        // Tableau de bord
        if (command === "security-status") {
            const statusEmbed = new EmbedBuilder()
                .setTitle("🛡️ Statut des Systèmes de Défense Aeroz")
                .setColor("#2b2d31")
                .addFields(
                    { name: "🔒 Mode Confinement (Bunker)", value: db.bunkerActive ? "🔴 **ACTIF**" : "🟢 INACTIF", inline: true },
                    { name: "🤖 Protection Anti-Bot", value: db.antiBot ? "🟢 ACTIVÉE" : "🔴 DÉSACTIVÉE", inline: true },
                    { name: "🌐 Protection Webhooks", value: db.antiWebhook ? "🟢 ACTIVÉE" : "🔴 DÉSACTIVÉE", inline: true },
                    { name: "📈 Limites Fixées (Ban auto)", value: `• Salons : **${db.limits.channel}/min**\n• Rôles : **${db.limits.role}/min**\n• Bans : **${db.limits.ban}/min**`, inline: false },
                    { name: "👥 Personnes de confiance (Whitelist)", value: db.whitelist.length ? db.whitelist.map(id => `<@${id}>`).join(", ") : "Aucun personnel enregistré.", inline: false }
                );
            return msg.channel.send({ embeds: [statusEmbed] });
        }

        // Switches de sécurité
        if (command === "toggle") {
            const moduleName = args[0]?.toLowerCase();
            if (moduleName === "antibot") {
                db.antiBot = !db.antiBot;
                saveDb();
                return msg.reply(`✅ Le module Anti-Bot est maintenant : **${db.antiBot ? "ACTIVÉ" : "DÉSACTIVÉ"}**.`);
            }
            if (moduleName === "antiwebhook") {
                db.antiWebhook = !db.antiWebhook;
                saveDb();
                return msg.reply(`✅ Le module Anti-Webhook est maintenant : **${db.antiWebhook ? "ACTIVÉ" : "DÉSACTIVÉ"}**.`);
            }
            return msg.reply("❌ Choix inconnu : `+toggle antibot` ou `+toggle antiwebhook`.");
        }

        // Changement de limites
        if (command === "setlimit") {
            const type = args[0]?.toLowerCase();
            const value = parseInt(args[1]);
            if (!["channel", "role", "ban"].includes(type) || isNaN(value)) {
                return msg.reply("❌ Syntaxe incorrecte. Exemple : `+setlimit channel 3`.");
            }
            db.limits[type] = value;
            saveDb();
            return msg.reply(`⚙️ Limite du quota pour **${type}** mise à jour à **${value} d'actions par minute**.`);
        }

        // Système de Whitelist
        if (command === "whitelist") {
            const sub = args[0]?.toLowerCase();
            const target = msg.mentions.users.first() || args[1];
            if (!sub || !target) return msg.reply("❌ Usage : `+whitelist add/remove @membre`.");
            const targetId = typeof target === "string" ? target : target.id;

            if (sub === "add") {
                if (db.whitelist.includes(targetId)) return msg.reply("⚠️ Cet utilisateur est déjà dans le registre.");
                db.whitelist.push(targetId);
                saveDb();
                return msg.reply(`✅ Approuvé : <@${targetId}> a été intégré à la liste blanche.`);
            }
            if (sub === "remove") {
                db.whitelist = db.whitelist.filter(id => id !== targetId);
                saveDb();
                return msg.reply(`❌ Révoqué : <@${targetId}> a été retiré de la liste blanche.`);
            }
        }

        // Récupération des rôles (Sortie de quarantaine)
        if (command === "unquarantine") {
            const target = msg.mentions.members.first();
            if (!target) return msg.reply("❌ Veuillez spécifier le membre.");
            const cachedRoles = quarantineCache.get(target.id);
            if (!cachedRoles) return msg.reply("❌ Aucun historique de quarantaine récent pour cette entité.");
            
            for (const roleId of cachedRoles) {
                await target.roles.add(roleId).catch(() => {});
            }
            quarantineCache.delete(target.id);
            return msg.reply(`✅ Restitution effectuée. L'accès réseau complet a été réatribué à ${target}.`);
        }

        // Commande Panic
        if (command === "panic") {
            db.bunkerActive = true;
            db.antiBot = true;
            db.antiWebhook = true;
            raidAlertOn = true;
            db.limits = { channel: 1, role: 1, ban: 1 }; 
            saveDb();
            return msg.reply("🚨 **[PANIC PROTOCOL ENGAGED]** Toutes les barrières sont activées au maximum de force. Mode bunker engagé.");
        }
    });
};
