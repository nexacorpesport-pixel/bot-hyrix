const {
    EmbedBuilder,
    PermissionsBitField
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "../data/moderationDB.json");
const STAFF_LOGS_CHANNEL = "1528213768818131077"; 

// =====================================================
// INTERFACE DE GESTION DE LA BASE DE DONNÉES
// =====================================================
function loadDB() {
    if (!fs.existsSync(DB_PATH)) {
        const dir = path.dirname(DB_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(DB_PATH, JSON.stringify({ users: {}, cases: [], tempbans: [] }, null, 4));
    }
    const db = JSON.parse(fs.readFileSync(DB_PATH));
    if (!db.cases) db.cases = [];
    if (!db.tempbans) db.tempbans = [];
    return db;
}

function saveDB(db) {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 4));
}

function parseDuration(str) {
    const match = str.match(/^(\d+)([smhd])$/);
    if (!match) return null;
    const value = parseInt(match[1]);
    const unit = match[2];
    switch (unit) {
        case 's': return value * 1000;
        case 'm': return value * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'd': return value * 24 * 60 * 60 * 1000;
        default: return null;
    }
}

module.exports = (client) => {

    console.log("[SECURITY MATRIX] Système d'administration global V2 initialisé.");

    // SYSTEME AUTO-UNBAN (Vérification des tempbans arrivés à expiration)
    const checkTempbans = async () => {
        const db = loadDB();
        const now = Date.now();
        let updated = false;

        for (let i = db.tempbans.length - 1; i >= 0; i--) {
            const ban = db.tempbans[i];
            if (now >= ban.endsAt) {
                const guild = client.guilds.cache.get(ban.guildId);
                if (guild) {
                    try {
                        await guild.members.unban(ban.userId, "Fin du bannissement temporaire");
                        const auditChannel = await guild.channels.fetch(STAFF_LOGS_CHANNEL).catch(() => null);
                        if (auditChannel) {
                            const unbanEmbed = new EmbedBuilder()
                                .setColor("#34a853")
                                .setTitle("⏳ LOGS — UNBAN AUTOMATIQUE")
                                .setDescription(`L'utilisateur <@${ban.userId}> (\`${ban.userId}\`) a été débanni automatiquement (expiration du tempban).`)
                                .setTimestamp();
                            await auditChannel.send({ embeds: [unbanEmbed] }).catch(() => {});
                        }
                    } catch (err) {
                        console.error(`Impossible de débannir auto l'ID ${ban.userId}`);
                    }
                }
                db.tempbans.splice(i, 1);
                updated = true;
            }
        }
        if (updated) saveDB(db);
    };

    client.once("ready", () => {
        checkTempbans();
        setInterval(checkTempbans, 60000);
    });

    client.on("messageCreate", async (message) => {

        if (!message.guild || message.author.bot) return;
        if (!message.content.startsWith("+")) return;

        const packetArgs = message.content.slice(1).trim().split(/ +/);
        const actionCmd = packetArgs.shift().toLowerCase();
        const executioner = message.member;
        const networkTarget = message.mentions.members.first();

        const deployEmbed = (title, description, color = "#2b2d31") => {
            const feedbackEmbed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .setColor(color)
                .setTimestamp();
            return message.channel.send({ embeds: [feedbackEmbed] });
        };

        const createCase = (type, targetId, targetTag, reason) => {
            const db = loadDB();
            const caseId = db.cases.length + 1;
            db.cases.push({
                id: caseId,
                type,
                targetId,
                targetTag,
                modId: executioner.id,
                reason,
                date: Date.now()
            });
            saveDB(db);
            return caseId;
        };

        const dispatchToAuditLogs = async (actionName, targetUser, reason, caseId = null) => {
            const auditChannel = await message.guild.channels.fetch(STAFF_LOGS_CHANNEL).catch(() => null);
            if (!auditChannel) return;

            const caseString = caseId ? `[CASE #${caseId}] ` : "";
            const auditEmbed = new EmbedBuilder()
                .setColor("#ea4335")
                .setTitle(`🛡️ LOGS — ${caseString}${actionName.toUpperCase()}`)
                .addFields(
                    { name: "👤 Modérateur", value: `${executioner}`, inline: true },
                    { name: "🎯 Cible", value: targetUser ? `${targetUser}` : "Aucune / Multiple", inline: true },
                    { name: "📝 Raison / Contexte", value: `\`${reason}\``, inline: false }
                )
                .setTimestamp();

            await auditChannel.send({ embeds: [auditEmbed] }).catch(() => {});
        };

        // =====================================================
        // 📜 MENU D'AIDE ET DOCUMENTATION (+help)
        // =====================================================
        if (actionCmd === "help") {
            if (!executioner.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;

            const helpEmbed = new EmbedBuilder()
                .setTitle("🛡️ Panel de Contrôle — Aeroz Staff Core")
                .setDescription("Index complet des privilèges d'administration et de modération.")
                .setColor("#4285f4")
                .addFields(
                    { name: "⚠️ Discipline & Warns", value: "`+warn @membre [raison]` - Indexe un avertissement\n`+unwarn @membre` - Retire le dernier avertissement\n`+warn deletion @membre [numéro]` - Purge une ligne précise\n`+clearwarn @membre` - Réinitialise entièrement le casier\n`+warnings [@membre]` - Affiche le listing d'un joueur\n`+warnlist` - Flux des 10 dernières infractions globales", inline: false },
                    { name: "🔨 Sanctions Lourdes", value: "`+kick @membre [raison]` - Expulse l'utilisateur\n`+ban @membre [raison]` - Exclut définitivement\n`+tempban @membre [durée] [raison]` - Ban à temps (ex: 3d, 2h)\n`+unban [ID]` - Révoque un bannissement\n`+mute @membre [min] [raison]` - Applique une exclusion de parole\n`+unmute @membre` - Met fin à l'exclusion temporelle", inline: false },
                    { name: "🧼 Nettoyage & Canaux (Clear)", value: "`+clear [1-100]` - Purge globale des messages\n`+clear bot [1-100]` - Élimine uniquement l'activité des bots\n`+clear user @membre [1-100]` - Purge les messages d'une cible précise\n`+slowmode [secondes/off]` - Gère la cadence d'écriture\n`+lock` - Verrouillage total de salon (Rôles non-staff)\n`+unlock` - Ouverture et réinitialisation des droits", inline: false },
                    { name: "📊 Suivi & Rapports", value: "`+check [@membre]` ou `+infractions` - Analyse avancée du compte\n`+cases [@membre]` - Historique des dossiers / sanctions de la cible\n`+notes @membre [texte]` - Écrit une annotation interne secrète", inline: false }
                )
                .setFooter({ text: "Aeroz Security Engine" })
                .setTimestamp();

            return message.channel.send({ embeds: [helpEmbed] });
        }

        // =====================================================
        // 🔍 INDEXATION ANALYTIQUE (+check / +infractions)
        // =====================================================
        if (actionCmd === "check" || actionCmd === "infractions") {
            const diagnosticTarget = networkTarget || executioner;
            const db = loadDB();
            const historicalCount = db.users[diagnosticTarget.id]?.warns?.length || 0;
            const notes = db.users[diagnosticTarget.id]?.notes || "Aucune annotation sur ce profil.";
            const displayTag = diagnosticTarget.user?.username || diagnosticTarget.username || "Utilisateur Inconnu";

            const diagnosticEmbed = new EmbedBuilder()
                .setTitle(`🔍 Analyse Profil Réseau — ${displayTag}`)
                .setColor("#4285f4")
                .setThumbnail(diagnosticTarget.user ? diagnosticTarget.user.displayAvatarURL({ forceStatic: false }) : diagnosticTarget.displayAvatarURL())
                .addFields(
                    { name: "🆔 UID Unique", value: `\`${diagnosticTarget.id}\``, inline: true },
                    { name: "⚠️ Index Infractions", value: `**${historicalCount} warn(s)**`, inline: true },
                    { name: "📅 Création du Compte", value: `<t:${parseInt((diagnosticTarget.user?.createdTimestamp || diagnosticTarget.createdTimestamp) / 1000)}:R>`, inline: false },
                    { name: "📥 Alignement Serveur", value: `<t:${parseInt(diagnosticTarget.joinedTimestamp / 1000)}:R>`, inline: false },
                    { name: "📝 Notes Internes du Staff", value: `*${notes}*`, inline: false }
                )
                .setTimestamp();

            return message.channel.send({ embeds: [diagnosticEmbed] });
        }

        // =====================================================
        // ⚠️ DISCIPLINE & COMPORTEMENT (WARNS ACTIONS)
        // =====================================================
        if (actionCmd === "warn") {
            if (!executioner.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;
            
            if (packetArgs[0] === "deletion") {
                const target = message.mentions.members.first();
                if (!target) return message.reply("❌ Usage : `+warn deletion @membre [numéro]`");
                const index = parseInt(packetArgs[2]) - 1;
                const db = loadDB();
                if (!db.users[target.id] || !db.users[target.id].warns || !db.users[target.id].warns[index]) {
                    return message.reply("❌ Index d'infraction introuvable pour ce compte.");
                }
                const deleted = db.users[target.id].warns.splice(index, 1)[0];
                saveDB(db);
                await dispatchToAuditLogs("Warn Deletion", target.user, `Suppression de la ligne indexée : ${deleted.reason}`);
                return deployEmbed("🧹 Purgation de Ligne", `L'infraction numéro **${index + 1}** (${deleted.reason}) de ${target} a été effacée.`, "#34a853");
            }

            if (!networkTarget) return message.reply("❌ Spécifiez le destinataire de la sanction.");
            if (networkTarget.id === message.author.id) return message.reply("❌ Auto-sanction non tolérée.");
            const textReason = packetArgs.slice(1).join(" ") || "Aucune raison spécifiée";
            
            const db = loadDB();
            if (!db.users[networkTarget.id]) db.users[networkTarget.id] = { warns: [], notes: "" };
            db.users[networkTarget.id].warns.push({ reason: textReason, mod: executioner.id, date: Date.now() });
            saveDB(db);

            const caseId = createCase("WARN", networkTarget.id, networkTarget.user.username, textReason);
            await dispatchToAuditLogs("Warn", networkTarget.user, textReason, caseId);
            return deployEmbed("⚠️ Discipline : Avertissement Ajouté", `**Membre :** ${networkTarget}\n**Motif :** ${textReason}\n**Dossier :** #${caseId}`, "#fbbc05");
        }

        if (actionCmd === "unwarn") {
            if (!executioner.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;
            if (!networkTarget) return message.reply("❌ Mention requise.");
            const db = loadDB();
            if (!db.users[networkTarget.id] || !db.users[networkTarget.id].warns.length) return message.reply("❌ Aucun incident enregistré.");
            const popped = db.users[networkTarget.id].warns.pop();
            saveDB(db);

            const caseId = createCase("UNWARN", networkTarget.id, networkTarget.user.username, `Révocation : ${popped.reason}`);
            await dispatchToAuditLogs("Unwarn", networkTarget.user, `Retrait automatique du dernier warn (${popped.reason})`, caseId);
            return deployEmbed("🧹 Amnistie Partielle", `Dernier avertissement de ${networkTarget} révoqué.\n**Motif annulé :** ${popped.reason}`, "#34a853");
        }

        if (actionCmd === "clearwarn") {
            if (!executioner.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;
            if (!networkTarget) return message.reply("❌ Cible manquante.");
            const db = loadDB();
            if (!db.users[networkTarget.id] || !db.users[networkTarget.id].warns.length) return message.reply("❌ Dossier déjà vierge.");
            db.users[networkTarget.id].warns = [];
            saveDB(db);

            const caseId = createCase("CLEARWARN", networkTarget.id, networkTarget.user.username, "Purge intégrale");
            await dispatchToAuditLogs("Clearwarn", networkTarget.user, "Destruction complète des antécédents", caseId);
            return deployEmbed("🧼 Réinitialisation d'Historique", `Le dossier d'infractions de ${networkTarget} a été purgé.`, "#34a853");
        }

        if (actionCmd === "warnings") {
            const subject = networkTarget || executioner;
            const db = loadDB();
            const history = db.users[subject.id]?.warns || [];
            if (!history.length) return deployEmbed("📊 Historique Réseau", `${subject} possède un casier vierge.`, "#34a853");
            const list = history.map((inc, i) => `**${i + 1}.** ${inc.reason} *(Auteur: <@${inc.mod}> le <t:${parseInt(inc.date / 1000)}:d>)*`).join("\n");
            const displayTag = subject.user?.username || subject.username || "Inconnu";
            return deployEmbed(`📊 Enregistrements de ${displayTag}`, list, "#4285f4");
        }

        if (actionCmd === "warnlist") {
            if (!executioner.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;
            const db = loadDB();
            const compiled = [];
            for (const [userId, record] of Object.entries(db.users)) {
                if (record.warns) record.warns.forEach(w => compiled.push({ userId, ...w }));
            }
            if (compiled.length === 0) return deployEmbed("📋 Journal Serveur", "Aucun avertissement actif.", "#34a853");
            compiled.sort((a, b) => b.date - a.date);
            const content = compiled.slice(0, 10).map((inc, i) => `\`[${i + 1}]\` <@${inc.userId}> : ${inc.reason} *(par <@${inc.mod}>)*`).join("\n");
            return deployEmbed("📋 10 Derniers Événements Disciplinaires", content, "#4285f4");
        }

        // =====================================================
        // 📝 SYSTEME D'ANNOTATION SECRÈTE (+notes)
        // =====================================================
        if (actionCmd === "notes") {
            if (!executioner.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;
            if (!networkTarget) return message.reply("❌ Usage : `+notes @membre [votre texte]`");
            const textNote = packetArgs.slice(1).join(" ");
            if (!textNote) return message.reply("❌ Contenu de la note absent.");

            const db = loadDB();
            if (!db.users[networkTarget.id]) db.users[networkTarget.id] = { warns: [], notes: "" };
            db.users[networkTarget.id].notes = textNote;
            saveDB(db);

            await dispatchToAuditLogs("Profile Note", networkTarget.user, `Nouvelle note : ${textNote}`);
            return message.reply(`✅ Note interne enregistrée avec succès sur le profil de **${networkTarget.user.username}**.`);
        }

        // =====================================================
        // 📊 CONSULTATION DES CASES GLOBALES (+cases)
        // =====================================================
        if (actionCmd === "cases") {
            const subject = networkTarget || executioner;
            const db = loadDB();
            const targetCases = db.cases.filter(c => c.targetId === subject.id);
            const displayTag = subject.user?.username || subject.username || "Inconnu";

            if (!targetCases.length) return deployEmbed("📊 Historique des Dossiers", `Aucun dossier d'action lourde pour ${subject}.`, "#34a853");
            const content = targetCases.slice(-10).map(c => `\`[CASE #${c.id}]\` **${c.type}** - Raison : ${c.reason} *(par <@${c.modId}>)*`).join("\n");
            return deployEmbed(`📊 Dossiers de Sanction — ${displayTag}`, content, "#4285f4");
        }

        // =====================================================
        // 🔨 BAN / TEMPBAN / KICK / MUTE / UNMUTE / UNBAN
        // =====================================================
        if (actionCmd === "kick") {
            if (!executioner.permissions.has(PermissionsBitField.Flags.KickMembers)) return;
            if (!networkTarget) return message.reply("❌ Cible introuvable.");
            if (!networkTarget.kickable) return message.reply("❌ Autorité hiérarchique insuffisante.");
            const textReason = packetArgs.slice(1).join(" ") || "Aucune raison spécifiée";
            
            try {
                await networkTarget.kick(textReason);
                const caseId = createCase("KICK", networkTarget.id, networkTarget.user.username, textReason);
                await dispatchToAuditLogs("Kick", networkTarget.user, textReason, caseId);
                return deployEmbed("👢 Expulsion Exécutée", `**Membre :** ${networkTarget.user.username}\n**Motif :** ${textReason}\n**Dossier :** #${caseId}`, "#ea4335");
            } catch (err) { return message.reply("❌ Erreur API lors de l'expulsion."); }
        }

        if (actionCmd === "ban") {
            if (!executioner.permissions.has(PermissionsBitField.Flags.BanMembers)) return;
            if (!networkTarget) return message.reply("❌ Cible introuvable.");
            if (!networkTarget.bannable) return message.reply("❌ Autorité hiérarchique insuffisante.");
            const textReason = packetArgs.slice(1).join(" ") || "Aucune raison spécifiée";
            
            try {
                await networkTarget.ban({ reason: textReason });
                const caseId = createCase("BAN", networkTarget.id, networkTarget.user.username, textReason);
                await dispatchToAuditLogs("Ban", networkTarget.user, textReason, caseId);
                return deployEmbed("🔨 Bannissement Définitif", `**Membre :** ${networkTarget.user.username}\n**Motif :** ${textReason}\n**Dossier :** #${caseId}`, "#ea4335");
            } catch (err) { return message.reply("❌ Erreur API lors de l'exclusion."); }
        }

        if (actionCmd === "tempban") {
            if (!executioner.permissions.has(PermissionsBitField.Flags.BanMembers)) return;
            if (!networkTarget) return message.reply("❌ Usage : `+tempban @membre [durée: 2h/3d] [raison]`");
            if (!networkTarget.bannable) return message.reply("❌ Autorité hiérarchique insuffisante.");
            
            const durationStr = packetArgs[1];
            if (!durationStr) return message.reply("❌ Précisez une durée valide (ex: 30m, 2h, 1d).");
            const durationMs = parseDuration(durationStr);
            if (!durationMs) return message.reply("❌ Format de durée non reconnu. Utilisez `m` (minutes), `h` (heures), `d` (jours).");

            const textReason = packetArgs.slice(2).join(" ") || "Aucune raison spécifiée";
            const endsAt = Date.now() + durationMs;

            try {
                await networkTarget.ban({ reason: `[Tempban ${durationStr}] ${textReason}` });
                
                const db = loadDB();
                db.tempbans.push({ userId: networkTarget.id, guildId: message.guild.id, endsAt });
                saveDB(db);

                const caseId = createCase("TEMPBAN", networkTarget.id, networkTarget.user.username, `Durée: ${durationStr} - ${textReason}`);
                await dispatchToAuditLogs("Tempban", networkTarget.user, `Durée: ${durationStr} | ${textReason}`, caseId);
                
                return deployEmbed("⏳ Bannissement Temporaire", `**Membre :** ${networkTarget.user.username}\n**Durée :** ${durationStr}\n**Expiration :** <t:${parseInt(endsAt / 1000)}:f>\n**Dossier :** #${caseId}`, "#ea4335");
            } catch (err) { return message.reply("❌ Erreur API lors du tempban."); }
        }

        if (actionCmd === "unban") {
            if (!executioner.permissions.has(PermissionsBitField.Flags.BanMembers)) return;
            const nativeId = packetArgs[0];
            if (!nativeId) return message.reply("❌ ID requis.");
            try {
                await message.guild.members.unban(nativeId);
                const caseId = createCase("UNBAN", nativeId, "Inconnu (ID)", "Réhabilitation");
                await dispatchToAuditLogs("Unban", null, `ID débanni : \`${nativeId}\``, caseId);
                return deployEmbed("♻️ Réhabilitation Confirmée", `L'entité \`${nativeId}\` a été extraite de la table d'exclusion.`, "#34a853");
            } catch (err) { return message.reply("❌ ID introuvable ou non banni."); }
        }

        if (actionCmd === "mute") {
            if (!executioner.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;
            if (!networkTarget) return message.reply("❌ Cible introuvable.");
            if (!networkTarget.moderatable) return message.reply("❌ Immunité détectée.");
            const timeModifier = parseInt(packetArgs[1]) || 5;
            const textReason = packetArgs.slice(2).join(" ") || "Aucune raison spécifiée";
            
            try {
                await networkTarget.timeout(timeModifier * 60 * 1000, textReason);
                const caseId = createCase("MUTE", networkTarget.id, networkTarget.user.username, `${timeModifier}m - ${textReason}`);
                await dispatchToAuditLogs("Mute", networkTarget.user, `Durée: ${timeModifier}m | ${textReason}`, caseId);
                return deployEmbed("🔇 Isolation Réseau", `**Membre :** ${networkTarget}\n**Durée :** ${timeModifier} minutes\n**Motif :** ${textReason}\n**Dossier :** #${caseId}`, "#fbbc05");
            } catch (err) { return message.reply("❌ Erreur lors de l'isolement."); }
        }

        if (actionCmd === "unmute") {
            if (!executioner.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;
            if (!networkTarget) return message.reply("❌ Cible manquante.");
            try {
                await networkTarget.timeout(null);
                const caseId = createCase("UNMUTE", networkTarget.id, networkTarget.user.username, "Rétablissement de parole");
                await dispatchToAuditLogs("Unmute", networkTarget.user, "Rétablissement anticipé", caseId);
                return deployEmbed("🔊 Fin d'Isolation", `${networkTarget} a été ré-autorisé à parler.`, "#34a853");
            } catch (err) { return message.reply("❌ Rétablissement impossible."); }
        }

        // =====================================================
        // 🧼 NETTOYAGE & CADENCE AVANCÉE (CLEAR TYPE / SLOWMODE)
        // =====================================================
        if (actionCmd === "clear") {
            if (!executioner.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

            // Correction ici : filtrage sécurisé
            if (packetArgs[0] === "bot") {
                const amount = parseInt(packetArgs[1]) || 50;
                await message.delete().catch(() => {});
                const fetched = await message.channel.messages.fetch({ limit: 100 });
                const botMessages = fetched.filter(m => m.author.bot).first(amount);
                
                const deleted = await message.channel.bulkDelete(botMessages, true);
                await dispatchToAuditLogs("Clear Bot", null, `${deleted.size} messages de bots purgés.`);
                const log = await message.channel.send(`🧹 **Purge Bots :** ${deleted.size} messages nettoyés.`);
                return setTimeout(() => log.delete().catch(() => {}), 4000);
            }

            if (packetArgs[0] === "user") {
                const target = message.mentions.members.first();
                if (!target) return message.reply("❌ Spécifiez le membre : `+clear user @membre [nombre]`");
                const amount = parseInt(packetArgs[2]) || 50;
                await message.delete().catch(() => {});
                const fetched = await message.channel.messages.fetch({ limit: 100 });
                const userMessages = fetched.filter(m => m.author.id === target.id).first(amount);
                
                const deleted = await message.channel.bulkDelete(userMessages, true);
                await dispatchToAuditLogs("Clear User", target.user, `${deleted.size} messages purgés de cet utilisateur.`);
                const log = await message.channel.send(`🧹 **Purge Ciblée :** ${deleted.size} messages de ${target.user.username} nettoyés.`);
                return setTimeout(() => log.delete().catch(() => {}), 4000);
            }

            const volume = parseInt(packetArgs[0]);
            if (!volume || volume < 1 || volume > 100) return message.reply("❌ Volume entre 1 et 100 requis.");
            await message.delete().catch(() => {});
            try {
                const stack = await message.channel.bulkDelete(volume, true);
                const log = await message.channel.send({ embeds: [new EmbedBuilder().setColor("#34a853").setDescription(`🧹 **Opération Purge :** ${stack.size} messages supprimés.`)] });
                setTimeout(() => log.delete().catch(() => {}), 4000);
            } catch (err) { return message.channel.send("❌ Limite API : Messages supérieurs à 14 jours."); }
        }

        if (actionCmd === "slowmode") {
            if (!executioner.permissions.has(PermissionsBitField.Flags.ManageChannels)) return;
            const input = packetArgs[0];
            if (!input) return message.reply("❌ Indiquez une valeur en secondes ou `off`.");

            if (input.toLowerCase() === "off") {
                await message.channel.setRateLimitPerUser(0);
                return deployEmbed("⏱️ Cadence Réinitialisée", "Le mode lent a été désactivé sur ce salon.", "#34a853");
            }

            const seconds = parseInt(input);
            if (isNaN(seconds) || seconds < 0 || seconds > 21600) return message.reply("❌ Spécifiez une valeur numérique valide (0 à 21600 secondes).");

            await message.channel.setRateLimitPerUser(seconds);
            await dispatchToAuditLogs("Slowmode", null, `Configuration établie sur ${seconds} secondes.`);
            return deployEmbed("⏱️ Mode Lent Activé", `La cadence d'écriture est restreinte à 1 message toutes les **${seconds}s** par utilisateur.`, "#fbbc05");
        }

        // =====================================================
        // 🔒 LOCK & UNLOCK INTELLIGENT
        // =====================================================
        if (actionCmd === "lock") {
            if (!executioner.permissions.has(PermissionsBitField.Flags.ManageChannels)) return;
            try {
                const currentOverwrites = message.channel.permissionOverwrites.cache;
                for (const [id, overwrite] of currentOverwrites) {
                    if (overwrite.type === 0) {
                        const role = message.guild.roles.cache.get(id);
                        if (role && !role.permissions.has(PermissionsBitField.Flags.ModerateMembers) && !role.permissions.has(PermissionsBitField.Flags.Administrator)) {
                            await message.channel.permissionOverwrites.edit(id, { SendMessages: false });
                        }
                    }
                }
                await message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: false });
                await dispatchToAuditLogs("Lockdown", null, "Verrouillage complet du canal.");
                return deployEmbed("🔒 Salon Verrouillé", "Le flux d'écriture global a été coupé pour l'ensemble des rôles réguliers.", "#ea4335");
            } catch (err) { return message.reply("❌ Échec lors du verrouillage."); }
        }

        if (actionCmd === "unlock") {
            if (!executioner.permissions.has(PermissionsBitField.Flags.ManageChannels)) return;
            try {
                const currentOverwrites = message.channel.permissionOverwrites.cache;
                for (const [id, overwrite] of currentOverwrites) {
                    if (overwrite.type === 0) {
                        const role = message.guild.roles.cache.get(id);
                        if (role && !role.permissions.has(PermissionsBitField.Flags.ModerateMembers) && !role.permissions.has(PermissionsBitField.Flags.Administrator)) {
                            await message.channel.permissionOverwrites.edit(id, { SendMessages: null });
                        }
                    }
                }
                await message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: null });
                await dispatchToAuditLogs("Unlockdown", null, "Réouverture du canal.");
                return deployEmbed("🔓 Salon Déverrouillé", "Les restrictions par rôles ont été levées. Accès standard rétabli.", "#34a853");
            } catch (err) { return message.reply("❌ Échec lors du déverrouillage."); }
        }
    });
};
