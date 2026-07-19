const {
    PermissionsBitField,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "../data", "fortress_antispam_db.json"); // Alignement du chemin d'accès au stockage de données

// Structure de la base de données persistante pour l'anti-spam
let db = { 
    globalLockdown: false,
    lockedChannels: [],
    spamWhitelistChans: [],
    spamIgnoreRoles: [],
    spamConfig: { 
        msgLimit: 5, 
        msgInterval: 6000, 
        maxLines: 4, 
        maxEmojis: 8, 
        capsRatio: 0.75 
    }
};

if (fs.existsSync(DB_PATH)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
        if (!db.spamWhitelistChans) db.spamWhitelistChans = [];
        if (!db.spamIgnoreRoles) db.spamIgnoreRoles = [];
        if (!db.lockedChannels) db.lockedChannels = [];
    } catch (e) {
        console.log("[🛡️ ANTISPAM] Erreur de chargement JSON, réinitialisation.");
    }
}

const saveDb = () => {
    try { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8"); } catch (e) {}
};

// Trackers volatils stockés en mémoire vive (RAM)
const msgTracker = new Map();
const warnTracker = new Map();
const spamTracker = new Map();
const reactTracker = new Map();
const editTracker = new Map(); 
const bypassTracker = new Set();
const blockedChans = new Set(db.lockedChannels);

// Algorithme de Levenshtein pour bloquer le copier-coller inter-salons
function getSimilarity(s1, s2) {
    if (!s1 || !s2) return 0;
    if (Math.abs(s1.length - s2.length) > 10) return 0;
    const arr = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
    for (let i = 0; i <= s1.length; i++) arr[0][i] = i;
    for (let j = 0; j <= s2.length; j++) arr[j][0] = j;
    for (let j = 1; j <= s2.length; j++) {
        for (let i = 1; i <= s1.length; i++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            arr[j][i] = Math.min(arr[j - 1][i] + 1, arr[j][i - 1] + 1, arr[j - 1][i - 1] + cost);
        }
    }
    return (Math.max(s1.length, s2.length) - arr[s2.length][s1.length]) / Math.max(s1.length, s2.length);
}

module.exports = (client) => {
    console.log("[🛡️ AEROZ ANTISPAM V3] Module de protection textuelle actif.");

    // =====================================================
    // ⚠️ CONFIGURATION DES IDENTIFIANTS (À MODIFIER AVEC TES NOUVEAUX IDs)
    // =====================================================
    const OWNER_ID = "1431661348218998948"; // Ton ID personnel
    const CEO_ROLE = "1528184662478946535";  // ID du rôle d'administration/modération supérieur
    const LOGS_CHAN = "1528212667930509462"; // ID du salon où envoyer les alertes de crise

    // Vérifie si un membre contourne les règles de l'anti-spam
    const isImmune = (userId, guild, member = null, channelId = null) => {
        if (userId === OWNER_ID || userId === guild.ownerId) return true;
        if (bypassTracker.has(userId)) return true;
        if (channelId && db.spamWhitelistChans.includes(channelId)) return true;
        if (member) {
            if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
            if (member.roles.cache.has(CEO_ROLE)) return true;
            if (db.spamIgnoreRoles.some(roleId => member.roles.cache.has(roleId))) return true;
        }
        return false;
    };

    // Alerte critique avec boutons interactifs de crise envoyée dans les logs
    const sendCrisisAlert = async (guild, channel, user, reason) => {
        const logChan = await guild.channels.fetch(LOGS_CHAN).catch(() => null);
        if (!logChan) return;

        const alertEmbed = new EmbedBuilder()
            .setColor("Red")
            .setTitle("🚨 ALERTE ATTACK / SPAM INTENSIF DÉTECTÉ 🚨")
            .setDescription(`Le salon ${channel} a été automatiquement verrouillé.\n\n**Auteur :** ${user} (\`${user.id}\`)\n**Motif :** ${reason}\n\nPilotez la crise avec les boutons ci-dessous.`);

        const b1 = new ButtonBuilder()
            .setCustomId(`sec_unlock_${channel.id}`)
            .setLabel("Déverrouiller le salon")
            .setStyle(ButtonStyle.Success)
            .setEmoji("🔓");

        const b2 = new ButtonBuilder()
            .setCustomId("sec_global_lock")
            .setLabel("Lockdown Global")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("🛑");

        const row = new ActionRowBuilder().addComponents(b1, b2);
        
        // Sécurité si le rôle CEO n'existe pas encore pour éviter un ping invalide
        const roleMention = guild.roles.cache.has(CEO_ROLE) ? `<@&${CEO_ROLE}>` : "";
        logChan.send({ content: roleMention, embeds: [alertEmbed], components: [row] }).catch(() => {});
    };

    // Analyseur de conformité de structure de message
    const isBadMessage = async (msg) => {
        if (isImmune(msg.author.id, msg.guild, msg.member, msg.channel.id)) return false;
        
        const lines = (msg.content.match(/\n/g) || []).length;
        if (lines > db.spamConfig.maxLines) {
            await msg.delete().catch(() => {});
            msg.channel.send(`⚠️ ${msg.author}, merci d'éviter les sauts de ligne excessifs.`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
            return true;
        }
        const badChars = /[\u0300-\u036f\u1dc0-\u1de6\u20d0-\u20f0\u200b-\u200d\u200e\u200f\ufeff]/g;
        if (badChars.test(msg.content)) {
            await msg.delete().catch(() => {});
            msg.channel.send(`⚠️ ${msg.author}, les caractères invisibles ou glitchs sont interdits.`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
            return true;
        }
        if (msg.content.length > 15) {
            const caps = msg.content.replace(/[^A-Z]/g, "").length;
            const total = msg.content.replace(/[^a-zA-Z]/g, "").length;
            if (total > 0 && (caps / total) > db.spamConfig.capsRatio) {
                await msg.delete().catch(() => {});
                msg.channel.send(`⚠️ ${msg.author}, merci de ne pas écrire en majuscules.`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
                return true;
            }
        }
        const emojis = /<(a)?:[a-zA-Z0-9_]+:[0-9]+>|[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}]/gu;
        if ((msg.content.match(emojis) || []).length > db.spamConfig.maxEmojis) {
            await msg.delete().catch(() => {});
            msg.channel.send(`⚠️ ${msg.author}, trop d'émojis détectés.`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
            return true;
        }
        return false;
    };

    // --- SECTIONS DES EVENEMENTS ANTI-SPAM ---
    client.on("messageCreate", async (msg) => {
        if (!msg.guild || msg.author.bot) return;

        const prefix = "+";
        const isCmd = msg.content.startsWith(prefix);

        // Si confinement global actif ou salon bloqué
        if (db.globalLockdown || blockedChans.has(msg.channel.id)) {
            if (!isImmune(msg.author.id, msg.guild, msg.member) && msg.content !== `${prefix}emergency-off`) {
                await msg.delete().catch(() => {});
                return;
            }
        }

        // --- SECTION EXÉCUTION DES COMMANDES ---
        if (isCmd) {
            const args = msg.content.slice(prefix.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();

            // Restriction absolue sur les commandes d'administration anti-spam
            const allowedCmds = ["help-antispam", "antispam-status", "lock", "unlock", "lockdown-global", "emergency-off", "unwarn", "setspammsg", "setspamtime", "setmaxlines", "setmaxemojis", "setcapsratio", "spamwhitelist", "spamignore", "spam-bypass", "spam-clean", "spam-resetdb"];
            if (allowedCmds.includes(command) && msg.author.id !== OWNER_ID) {
                await msg.delete().catch(() => {});
                return;
            }

            // Manuel d'aide
            if (command === "help-antispam") {
                const hEmbed = new EmbedBuilder()
                    .setTitle("🛠️ Manuel d'Urgence Système — Anti-Spam Aeroz")
                    .setColor("#ef6c00")
                    .addFields(
                        { name: "🛑 Commandes de Crise & Verrous", value: "`+lock` - Ferme le salon actuel.\n`+unlock` - Réouvre le salon actuel.\n`+lockdown-global` - Confinement total de tous les salons.\n`+emergency-off` - Arrêt global des verrous et retour à la normale." },
                        { name: "⚙️ Réglage Manuel des Seuils", value: "`+setspammsg [nb]` - Nb de messages autorisés.\n`+setspamtime [ms]` - Fenêtre d'envoi en ms.\n`+setmaxlines [nb]` - Limite de retours à la ligne.\n`+setmaxemojis [nb]` - Limite d'émojis.\n`+setcapsratio [0.0-1.0]` - Sensibilité des majuscules." },
                        { name: "👥 Exceptions, Listes & Whitelist", value: "`+antispam-status` - État global des filtres.\n`+spamwhitelist add/remove` - Exclure un salon.\n`+spamignore add/remove` - Immuniser un rôle.\n`+spam-bypass [ID]` - Immunité temporaire sur un membre.\n`+unwarn [@membre]` - Reset les avertissements d'un membre." },
                        { name: "🧹 Maintenance Réseau", value: "`+spam-clean` - Purge la mémoire vive (RAM) en cas de lag.\n`+spam-resetdb` - Re-génère proprement le stockage JSON." }
                    );
                return msg.author.send({ embeds: [hEmbed] })
                    .then(() => msg.reply("📥 Le catalogue complet anti-spam vous a été transmis en privé."))
                    .catch(() => msg.reply("❌ Impossible de vous envoyer les DM."));
            }

            if (command === "antispam-status") {
                const stEmbed = new EmbedBuilder()
                    .setTitle("📊 Statut Actuel des Filtres Anti-Spam")
                    .setColor("Blue")
                    .setDescription(`• Lockdown Global : ${db.globalLockdown ? "🔴 **ACTIF**" : "🟢 INACTIF"}\n• Seuil : **${db.spamConfig.msgLimit} msgs** par **${db.spamConfig.msgInterval}ms**\n• Sauts de lignes : **${db.spamConfig.maxLines}**\n• Émojis : **${db.spamConfig.maxEmojis}**\n• Caps-Ratio : **${db.spamConfig.capsRatio * 100}%**\n• Salons Exclus : ${db.spamWhitelistChans.length ? db.spamWhitelistChans.map(id => `<#${id}>`).join(", ") : "Aucun"}`);
                return msg.channel.send({ embeds: [stEmbed] });
            }

            if (command === "lock") {
                blockedChans.add(msg.channel.id);
                db.lockedChannels = Array.from(blockedChans);
                saveDb();
                return msg.reply("🔒 **Salon verrouillé avec succès.** Les discussions sont gelées.");
            }

            if (command === "unlock") {
                blockedChans.delete(msg.channel.id);
                db.lockedChannels = Array.from(blockedChans);
                saveDb();
                return msg.reply("🔓 **Salon réouvert.** Les membres peuvent de nouveau écrire.");
            }

            if (command === "lockdown-global") {
                db.globalLockdown = true;
                saveDb();
                return msg.reply("🛑 **[LOCKDOWN GLOBAL ENGAGÉ]** Tous les salons du serveur sont figés jusqu'à nouvel ordre.");
            }

            if (command === "emergency-off") {
                db.globalLockdown = false;
                db.lockedChannels = [];
                blockedChans.clear();
                saveDb();
                return msg.reply("🔓 **Protocole de crise désactivé.** Tout le serveur est déverrouillé.");
            }

            if (command === "setspammsg") {
                const val = parseInt(args[0]);
                if (isNaN(val)) return msg.reply("❌ Précisez un nombre valide.");
                db.spamConfig.msgLimit = val;
                saveDb();
                return msg.reply(`⚙️ Limite fixée à **${val} messages**.`);
            }

            if (command === "setspamtime") {
                const val = parseInt(args[0]);
                if (isNaN(val)) return msg.reply("❌ Précisez un temps en millisecondes (ex: 6000).");
                db.spamConfig.msgInterval = val;
                saveDb();
                return msg.reply(`⚙️ Fenêtre de surveillance fixée à **${val}ms**.`);
            }

            if (command === "setmaxlines") {
                const val = parseInt(args[0]);
                if (isNaN(val)) return msg.reply("❌ Précisez un chiffre.");
                db.spamConfig.maxLines = val;
                saveDb();
                return msg.reply(`⚙️ Maximum de lignes fixé à **${val}**.`);
            }

            if (command === "setmaxemojis") {
                const val = parseInt(args[0]);
                if (isNaN(val)) return msg.reply("❌ Précisez un chiffre.");
                db.spamConfig.maxEmojis = val;
                saveDb();
                return msg.reply(`⚙️ Maximum d'émojis fixé à **${val}**.`);
            }

            if (command === "setcapsratio") {
                const val = parseFloat(args[0]);
                if (isNaN(val) || val < 0.1 || val > 1.0) return msg.reply("❌ Ratio requis entre 0.1 et 1.0.");
                db.spamConfig.capsRatio = val;
                saveDb();
                return msg.reply(`⚙️ Ratio de majuscules fixé à **${val * 100}%**.`);
            }

            if (command === "spamwhitelist") {
                const action = args[0]?.toLowerCase();
                const chan = msg.mentions.channels.first() || msg.channel;
                if (action === "add") {
                    if (!db.spamWhitelistChans.includes(chan.id)) db.spamWhitelistChans.push(chan.id);
                    saveDb();
                    return msg.reply(`✅ Le salon ${chan} est maintenant exclu de l'anti-spam.`);
                }
                if (action === "remove") {
                    db.spamWhitelistChans = db.spamWhitelistChans.filter(id => id !== chan.id);
                    saveDb();
                    return msg.reply(`❌ Le salon ${chan} est de nouveau surveillé.`);
                }
                return msg.reply("❌ Usage : `+spamwhitelist add/remove`.");
            }

            if (command === "spamignore") {
                const action = args[0]?.toLowerCase();
                const role = msg.mentions.roles.first();
                if (!role) return msg.reply("❌ Mentionnez un rôle.");
                if (action === "add") {
                    if (!db.spamIgnoreRoles.includes(role.id)) db.spamIgnoreRoles.push(role.id);
                    saveDb();
                    return msg.reply(`✅ Le rôle \`@${role.name}\` est immunisé.`);
                }
                if (action === "remove") {
                    db.spamIgnoreRoles = db.spamIgnoreRoles.filter(id => id !== role.id);
                    saveDb();
                    return msg.reply(`❌ Le rôle \`@${role.name}\` n'est plus immunisé.`);
                }
            }

            if (command === "spam-bypass") {
                const target = msg.mentions.users.first() || args[0];
                if (!target) return msg.reply("❌ Spécifiez le membre.");
                const id = typeof target === "string" ? target : target.id;
                if (bypassTracker.has(id)) {
                    bypassTracker.delete(id);
                    return msg.reply(`❌ Exception retirée pour l'ID \`${id}\`.`);
                } else {
                    bypassTracker.add(id);
                    return msg.reply(`✅ Exception temporaire accordée pour l'ID \`${id}\`.`);
                }
            }

            if (command === "unwarn") {
                const target = msg.mentions.users.first();
                if (!target) return msg.reply("❌ Spécifiez le membre.");
                warnTracker.set(target.id, 0);
                return msg.reply(`✅ Compteur d'infractions de ${target} remis à zéro.`);
            }

            if (command === "spam-clean") {
                msgTracker.clear();
                warnTracker.clear();
                spamTracker.clear();
                reactTracker.clear();
                editTracker.clear();
                return msg.reply("🧹 **Mémoire vive (RAM) purgée.** Tous les compteurs temporaires ont été vidés.");
            }

            if (command === "spam-resetdb") {
                db = { globalLockdown: false, lockedChannels: [], spamWhitelistChans: [], spamIgnoreRoles: [], spamConfig: { msgLimit: 5, msgInterval: 6000, maxLines: 4, maxEmojis: 8, capsRatio: 0.75 } };
                saveDb();
                blockedChans.clear();
                return msg.reply("♻️ **Base de données réinitialisée aux valeurs d'usine.**");
            }

            return;
        }

        // --- SURVEILLANCE ACTIVE DU TEXTE ---
        if (isImmune(msg.author.id, msg.guild, msg.member, msg.channel.id)) return;

        const now = Date.now();
        const userId = msg.author.id;

        const broken = await isBadMessage(msg);
        if (broken) return;

        // Anti Copier-Coller inter-salons
        const lastMsg = spamTracker.get(userId);
        if (lastMsg) {
            const identical = lastMsg.content === msg.content;
            const similar = getSimilarity(lastMsg.content, msg.content);
            if ((identical || similar > 0.82) && (now - lastMsg.time < 12000) && lastMsg.channel !== msg.channel.id) {
                await msg.delete().catch(() => {});
                return;
            }
        }
        spamTracker.set(userId, { content: msg.content, time: now, channel: msg.channel.id });

        // Algorithme de quotas de messages
        if (!msgTracker.has(userId)) msgTracker.set(userId, []);
        let times = msgTracker.get(userId).filter(t => now - t < db.spamConfig.msgInterval);
        times.push(now);
        msgTracker.set(userId, times);

        if (times.length >= db.spamConfig.msgLimit) {
            let warns = (warnTracker.get(userId) || 0) + 1;
            warnTracker.set(userId, warns);

            const canBulkDelete = msg.channel.isTextBased() && typeof msg.channel.bulkDelete === "function";

            if (warns === 1) {
                if (canBulkDelete) await msg.channel.bulkDelete(6).catch(() => {});
                return msg.channel.send(`⚠️ ${msg.author}, baissez le rythme de vos messages.`).then(m => setTimeout(() => m.delete().catch(() => {}), 4000));
            }
            if (warns === 2) {
                if (canBulkDelete) await msg.channel.bulkDelete(10).catch(() => {});
                await msg.member.timeout(900000, "Spam continu (Niv 2)").catch(() => {});
                return msg.channel.send(`🔒 ${msg.author} a été réduit au silence pendant 15 minutes.`);
            }
            if (warns === 3) {
                if (canBulkDelete) await msg.channel.bulkDelete(12).catch(() => {});
                await msg.member.timeout(1800000, "Récidive de spam (Niv 3)").catch(() => {});
                return msg.channel.send(`🔒 ${msg.author} a été réduit au silence pendant 30 minutes.`);
            }
            if (warns >= 4) {
                warnTracker.set(userId, 0); 
                if (canBulkDelete) await msg.channel.bulkDelete(40).catch(() => {});
                await msg.member.timeout(86400000, "Attaque / Spam extrême (24h)").catch(() => {});
                
                blockedChans.add(msg.channel.id);
                db.lockedChannels = Array.from(blockedChans);
                saveDb();

                msg.channel.send(`🚨 **Salon automatiquement verrouillé.** Détection d'un flux de spam de niveau critique.`);
                await sendCrisisAlert(msg.guild, msg.channel, msg.author, "Spam répétitif et malveillant persistant");
            }
        }
    });

    // --- DETECTION DU SPAM PAR EDITIONS ---
    client.on("messageUpdate", async (oldMsg, newMsg) => {
        if (!newMsg.guild || newMsg.author.bot) return;
        if (isImmune(newMsg.author.id, newMsg.guild, newMsg.member, newMsg.channel.id)) return;
        if (oldMsg.content === newMsg.content) return;

        const now = Date.now();
        const userId = newMsg.author.id;

        if (!editTracker.has(userId)) editTracker.set(userId, []);
        let edits = editTracker.get(userId).filter(t => now - t < 4000);
        edits.push(now);
        editTracker.set(userId, edits);

        if (edits.length >= 3) {
            editTracker.set(userId, []);
            await newMsg.delete().catch(() => {});
            await newMsg.member.timeout(1200000, "Spam par modification rapide").catch(() => {});
            return newMsg.channel.send(`🔒 ${newMsg.author} a été exclu 20 minutes pour spam de modifications.`);
        }
        await isBadMessage(newMsg);
    });

    // --- TRACEUR DE GHOST PINGS ---
    client.on("messageDelete", async (msg) => {
        if (!msg.guild || msg.author.bot) return;
        if (isImmune(msg.author.id, msg.guild, msg.member, msg.channel.id)) return;

        const life = Date.now() - msg.createdTimestamp;
        const containsMention = msg.mentions.users.size > 0 || msg.mentions.roles.size > 0 || msg.content.includes("@everyone") || msg.content.includes("@here");

        if (containsMention && life < 5000) {
            msg.channel.send(`👻 **Ghost Ping dénoncé !** ${msg.author} a supprimé une mention en moins de 5 secondes.`).then(m => setTimeout(() => m.delete().catch(() => {}), 6000));
            
            const logChan = await msg.guild.channels.fetch(LOGS_CHAN).catch(() => null);
            if (logChan) {
                const gEmbed = new EmbedBuilder()
                    .setColor("Yellow")
                    .setTitle("👻 ALERTE GHOST PING TRACÉ")
                    .setDescription(`**Utilisateur :** ${msg.author} (\`${msg.author.id}\`)\n**Salon :** ${msg.channel}\n**Contenu effacé :**\n\`\`\`${msg.content || "[Contenu Vide/Média]"}\`\`\``);
                logChan.send({ embeds: [gEmbed] }).catch(() => {});
            }
        }
    });

    // --- PROTECTION CONTRE LE SPAM DE REACTIONS ---
    client.on("messageReactionAdd", async (reaction, user) => {
        if (user.bot) return;
        const guild = reaction.message.guild;
        if (!guild) return;
        if (isImmune(user.id, guild, null, reaction.message.channel.id)) return;

        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member) return;

        const now = Date.now();
        if (!reactTracker.has(user.id)) reactTracker.set(user.id, []);
        let reacts = reactTracker.get(user.id).filter(t => now - t < 3000);
        reacts.push(now);
        reactTracker.set(user.id, reacts);

        if (reacts.length >= 5) {
            reactTracker.set(user.id, []);
            reaction.message.reactions.cache.forEach(r => r.users.remove(user.id).catch(() => {}));
            await member.timeout(600000, "Spam intensif de réactions").catch(() => {});
            reaction.message.channel.send(`⚠️ ${user} a été mute 10 minutes pour spam d'émojis sous les messages.`).then(m => setTimeout(() => m.delete().catch(() => {}), 4000));
        }
    });

    // --- ACTIONS DES BOUTONS INTERACTIFS ---
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("sec_unlock_") && interaction.customId !== "sec_global_lock") return;

        if (interaction.user.id !== OWNER_ID && !interaction.member.roles.cache.has(CEO_ROLE)) {
            return interaction.reply({ content: "❌ Terminal sécurisé : Accès refusé.", ephemeral: true });
        }

        if (interaction.customId.startsWith("sec_unlock_")) {
            const chanId = interaction.customId.replace("sec_unlock_", "");
            blockedChans.delete(chanId);
            db.lockedChannels = Array.from(blockedChans);
            saveDb();

            const updEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setColor("Green")
                .setTitle("🔓 SALON RÉOUVERT PAR LE STAFF")
                .setDescription(`Le salon <#${chanId}> a été ré-ouvert manuellement par ${interaction.user}.`);

            await interaction.update({ embeds: [updEmbed], components: [] }).catch(() => {});
            const targetChan = await interaction.guild.channels.fetch(chanId).catch(() => null);
            if (targetChan) targetChan.send("🔓 **Ce salon a été déverrouillé par l'administration. Les discussions peuvent reprendre.**");
        }

        if (interaction.customId === "sec_global_lock") {
            db.globalLockdown = true;
            saveDb();

            const updEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setColor("DarkRed")
                .setTitle("🛑 LOCKDOWN APPLIQUÉ DEPUIS LE DASHBOARD")
                .setDescription(`Le serveur global a été complètement confiné par ${interaction.user}.`);

            await interaction.update({ embeds: [updEmbed], components: [] }).catch(() => {});
        }
    });
};
