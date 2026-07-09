const {
    PermissionsBitField,
    EmbedBuilder,
    MessageFlags
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "fortress_security_db.json");

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
const WINDOW_TIME = 60000; // Fenêtre glissante de 1 minute (60000ms)
const actionTrackers = new Map(); // Permet de compter le nombre d'actions par utilisateur
const quarantineCache = new Map(); // Sauvegarde temporaire des rôles retirés en cas de fausse alerte

const RAID_WINDOW = 30000; 
const RAID_LIMIT = 5;          
let recentJoins = [];
let raidAlertOn = false;

const BUNKER_KEY = "AZ-99X-BUNK-7421-ZOR";
const BUNKER_CAT = "1522353418226896997"; 
const BUNKER_ROLE = "1522354308635689040";

module.exports = (client) => {

    console.log("[🛡️ AEROZ FORTRESS] Protocole de défense global activé.");

    const OWNER_ID = "1431661348218998948";
    const SUSPECT_ROLE = "1522353482252947508"; 
    
    const CHANNELS = {
        ANTI_RAID: "1522354528626802728",
        LOGS_CHANNELS: "1522354627633217597",
        LOGS_ROLES: "1522354480631517204",
        LOGS_MOD: "1522354679831461949"
    };

    // Envoi des logs réseau vers les salons dédiés
    const sendLog = async (chanId, embed) => {
        const chan = await client.channels.fetch(chanId).catch(() => null);
        if (chan) chan.send({ embeds: [embed.setTimestamp()] }).catch(() => {});
    };

    // Vérifie si un membre du staff est immunisé (Owner ou Whitelist)
    const isImmune = (userId, guild) => {
        if (userId === OWNER_ID || userId === guild.ownerId) return true;
        return db.whitelist.includes(userId);
    };

    // Sanction suprême : Ban du staff malveillant et alerte d'urgence
    const executeStaffSanction = async (guild, userId, reason) => {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return;

        // Si c'est un bot malveillant infiltré, on le ban direct
        if (member.user.bot) {
            await member.ban({ reason: `[ANTI-NUKE SYSTEM] ${reason}` }).catch(() => {});
            return;
        }

        // Sauvegarde des rôles pour la commande +unquarantine avant de lui retirer ses droits
        const rolesToStrip = member.roles.cache.filter(r => r.id !== guild.roles.everyone.id);
        quarantineCache.set(userId, rolesToStrip.map(r => r.id));

        // Ban ou destitution selon la gravité. Ici, dépassement de quotas = BAN IMMEDIAT
        await member.ban({ reason: `[ANTI-NUKE QUOTA DETECTED] ${reason}` }).catch(() => {});

        const criticalEmbed = new EmbedBuilder()
            .setColor("#b71c1c")
            .setTitle("🚨 EXÉCUTION STAFF COMPTE : EXCLUSION 🚨")
            .setDescription(`**Staff Détecté :** ${member.user} (\`${userId}\`)\n**Raison :** ${reason}\n\n⚠️ L'entité a été bannie définitivement du serveur réseau pour abus d'autorité.`);

        const alertChan = await guild.channels.fetch(CHANNELS.ANTI_RAID).catch(() => null);
        if (alertChan) alertChan.send({ content: `<@${OWNER_ID}>`, embeds: [criticalEmbed] }).catch(() => {});
    };

    // Système de gestion des quotas glissants sur 1 minute
    const trackActionQuota = async (guild, userId, type, limitValue, actionLabel) => {
        if (isImmune(userId, guild)) return false;

        const now = Date.now();
        const trackingKey = `${userId}_${type}`;

        if (!actionTrackers.has(trackingKey)) actionTrackers.set(trackingKey, []);
        
        // Filtrer les actions datant de plus d'une minute
        let timestamps = actionTrackers.get(trackingKey).filter(t => now - t < WINDOW_TIME);
        timestamps.push(now);
        actionTrackers.set(trackingKey, timestamps);

        // Si le nombre d'actions dépasse la limite stricte configurée
        if (timestamps.length > limitValue) {
            await executeStaffSanction(guild, userId, `Dépassement du quota autorisé pour : ${actionLabel} (${timestamps.length}/${limitValue} en moins d'1 min)`);
            return true;
        }
        return false;
    };

    // =====================================================
    // ⚙️ INTERCEPTIONS DES ACTIONS DE SÉCURITÉ CONTRE LE NUKE
    // =====================================================

    // Surveillance de l'intégrité des salons (Suppression)
    client.on("channelDelete", async (channel) => {
        if (!channel.guild) return;
        const server = channel.guild;
        const logs = await server.fetchAuditLogs({ limit: 1, type: 12 }).catch(() => null);
        const logEntry = logs?.entries.first();
        if (!logEntry) return;

        const executorId = logEntry.executor.id;

        // Sauvegarde de secours du salon supprimé
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

    // Surveillance de la création des salons
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

    // Surveillance de la suppression de rôles
    client.on("roleDelete", async (role) => {
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

    // Surveillance des vagues de bans massifs par le staff
    client.on("guildBanAdd", async (ban) => {
        const server = ban.guild;
        const logs = await server.fetchAuditLogs({ limit: 1, type: 22 }).catch(() => null);
        const logEntry = logs?.entries.first();
        if (!logEntry) return;

        const executorId = logEntry.executor.id;
        await trackActionQuota(server, executorId, "ban", db.limits.ban, "Bannissements de Membres");
    });

    // Interdiction stricte de l'injection de Bots malveillants
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

        // Algorithme Anti-Raid Joins successifs
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

    // Interdiction de création ou modification de Webhooks espions
    client.on("webhookUpdate", async (channel) => {
        if (!db.antiWebhook || !channel.guild) return;
        const server = channel.guild;
        const logs = await server.fetchAuditLogs({ limit: 1, type: 50 }).catch(() => null);
        const logEntry = logs?.entries.first();
        if (!logEntry) return;

        const executorId = logEntry.executor.id;
        if (!isImmune(executorId, server)) {
            // Suppression immédiate du webhook créé
            const webhooks = await channel.fetchWebhooks().catch(() => null);
            if (webhooks) webhooks.forEach(w => w.delete("Anti-Webhook actif").catch(() => {}));
            await executeStaffSanction(server, executorId, "Création non autorisée d'un Webhook système");
        }
    });

    // =====================================================
    // ⚙️ COMMANDES TERMINAL DE CONTRÔLE (OWNER UNIQUE)
    // =====================================================
    client.on("messageCreate", async (msg) => {
        if (!msg.guild || msg.author.bot) return;
        if (!msg.content.startsWith("+")) return;

        const args = msg.content.slice(1).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        // 📜 MENU PRIVÉ COMPLET CAS DE CRISE (+help-antinuke)
        if (command === "help-antinuke") {
            if (msg.author.id !== OWNER_ID) return;

            const helpEmbed = new EmbedBuilder()
                .setTitle("🛠️ Protocoles de Sécurité & Commandes d'Urgence")
                .setDescription("Index des commandes de crise prioritaires configurées sur le noyau réseau.")
                .setColor("#b71c1c")
                .addFields(
                    { name: "🚨 Actions Immédiates", value: "`+bunker-on <Clé>` - Confinement total du serveur réseau.\n`+bunker-off <Clé>` - Arrêt du protocole de confinement.\n`+panic` - Active toutes les barrières au maximum de force.", inline: false },
                    { name: "⚙️ Configuration des Modules", value: "`+security-status` - Tableau de bord de l'état des systèmes.\n`+toggle antibot` - Alterne la protection anti-bots.\n`+toggle antiwebhook` - Alterne la protection contre les webhooks.\n`+setlimit <channel/role/ban> [nombre]` - Ajuste les quotas de ban automatique.", inline: false },
                    { name: "👥 Gestion des Droits", value: "`+whitelist add/remove @membre` - Ajoute/Retire un adjoint de confiance.\n`+unquarantine @membre` - Restitue tous les rôles d'un staff purgé.", inline: false }
                )
                .setFooter({ text: "Aeroz Private Administration Terminal" });

            return msg.author.send({ embeds: [helpEmbed] })
                .then(() => msg.reply("📥 Le manuel de crise vous a été transmis en message privé."))
                .catch(() => msg.reply("❌ Impossible de vous envoyer le message privé. Vérifiez vos paramètres."));
        }

        // Sécurité sur le reste des commandes : OWNER ID REQUIS
        if (["security-status", "toggle", "setlimit", "whitelist", "unquarantine", "panic", "bunker-on", "bunker-off"].includes(command)) {
            if (msg.author.id !== OWNER_ID) return await msg.delete().catch(() => {});
        }

        // Affichage du tableau de bord de sécurité (+security-status)
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

        // Activation / Désactivation des interrupteurs (+toggle <module>)
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

        // Configuration dynamique des quotas (+setlimit <type> <nombre>)
        if (command === "setlimit") {
            const type = args[0]?.toLowerCase();
            const value = parseInt(args[1]);
            if (!["channel", "role", "ban"].includes(type) || isNaN(value)) {
                return msg.reply("❌ Syntaxe incorrecte. Exemple : `+setlimit channel 3`.");
            }
            db.limits[type] = value;
            saveDb();
            return msg.reply(`⚙️ Limite du quota pour **${type}** mise à jour à **${value} d'actions par minute** avant exclusion.`);
        }

        // Gestion de la liste blanche de confiance (+whitelist)
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

        // Sortie de quarantaine / Rétablissement rapide (+unquarantine)
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

        // Bouton d'urgence absolue (+panic)
        if (command === "panic") {
            db.bunkerActive = true;
            db.antiBot = true;
            db.antiWebhook = true;
            db.limits = { channel: 1, role: 1, ban: 1 }; // Quotas au minimum absolu
            saveDb();
            return msg.reply("🚨 **[PANIC PROTOCOL ENGAGED]** Toutes les barrières sont activées au maximum de force. Mode bunker engagé.");
        }
    });
};
