const {
    EmbedBuilder,
    PermissionsBitField
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "../data/moderationDB.json");
const STAFF_LOGS_CHANNEL = "1521931122043256892"; 

function loadDB() {
    if (!fs.existsSync(DB_PATH)) {
        const dir = path.dirname(DB_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(DB_PATH, JSON.stringify({ users: {} }, null, 4));
    }
    return JSON.parse(fs.readFileSync(DB_PATH));
}

function saveDB(db) {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 4));
}

module.exports = (client) => {

    console.log("[SECURITY MATRIX] Module de modération et verrouillage intelligent chargé.");

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

        const dispatchToAuditLogs = async (actionName, targetUser, reason) => {
            const auditChannel = await message.guild.channels.fetch(STAFF_LOGS_CHANNEL).catch(() => null);
            if (!auditChannel) return;

            const auditEmbed = new EmbedBuilder()
                .setColor("#ea4335")
                .setTitle(`🛡️ LOGS — ${actionName.toUpperCase()}`)
                .addFields(
                    { name: "👤 Modérateur", value: `${executioner}`, inline: true },
                    { name: "🎯 Cible", value: `${targetUser}`, inline: true },
                    { name: "📝 Raison", value: `\`${reason}\``, inline: false }
                )
                .setTimestamp();

            await auditChannel.send({ embeds: [auditEmbed] }).catch(() => {});
        };

        // =====================================================
        // 📜 [NOUVEAU] MENU D'AIDE MODÉRATION (+help)
        // =====================================================
        if (actionCmd === "help") {
            // Optionnel : restreindre le help aux permissions de modération pour que seuls les staffs le voient
            if (!executioner.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;

            const helpEmbed = new EmbedBuilder()
                .setTitle("🛡️ Panel d'Aide - Commandes de Modération")
                .setDescription("Voici la liste des commandes disponibles pour la gestion et la sécurité du serveur. Le préfixe est `+`.")
                .setColor("#4285f4")
                .addFields(
                    { name: "⚠️ Gestion des Warns", value: "`+warn @membre [raison]` - Met un avertissement\n`+unwarn @membre` - Retire le dernier warn\n`+clearwarn @membre` - Supprime tous les warns\n`+warnings [@membre]` - Voir la liste des infractions d'un joueur\n`+warnlist` - Voir les 10 derniers warns du serveur", inline: false },
                    { name: "🔨 Sanctions Élevées", value: "`+kick @membre [raison]` - Expulse le membre\n`+ban @membre [raison]` - Bannit le membre\n`+unban [ID]` - Débannit un utilisateur via son ID\n`+mute @membre [minutes] [raison]` - Timeout le membre\n`+unmute @membre` - Enlève le timeout", inline: false },
                    { name: "🔒 Gestion des Salons & Chat", value: "`+lock` - Verrouille le salon (bloque tous les rôles actifs)\n`+unlock` - Déverrouille et réinitialise le salon\n`+clear [1-100]` - Supprime les messages du salon", inline: false },
                    { name: "📊 Informations", value: "`+check [@membre]` ou `+infractions` - Analyse complète du profil et du compte", inline: false }
                )
                .setFooter({ text: "Aeroz Security System" })
                .setTimestamp();

            return message.channel.send({ embeds: [helpEmbed] });
        }

        // =====================================================
        // ⚠️ WARN / UNWARN / WARNINGS / CLEARWARN / WARNLIST / CHECK
        // =====================================================
        if (actionCmd === "warn") {
            if (!executioner.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;
            if (!networkTarget) return message.reply("❌ Veuillez mentionner un membre.");
            if (networkTarget.id === message.author.id) return message.reply("❌ Vous ne pouvez pas vous warn vous-même.");
            const textReason = packetArgs.slice(1).join(" ") || "Aucune raison spécifiée";
            const localRegistry = loadDB();
            if (!localRegistry.users[networkTarget.id]) localRegistry.users[networkTarget.id] = { warns: [] };
            localRegistry.users[networkTarget.id].warns.push({ reason: textReason, mod: executioner.id, date: Date.now() });
            saveDB(localRegistry);
            await dispatchToAuditLogs("Warn", networkTarget.user, textReason);
            return deployEmbed("⚠️ Avertissement Enregistré", `**Membre :** ${networkTarget}\n**Raison :** ${textReason}\n**Modérateur :** ${executioner}`, "#fbbc05");
        }

        if (actionCmd === "unwarn") {
            if (!executioner.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;
            if (!networkTarget) return message.reply("❌ Veuillez mentionner un membre.");
            const localRegistry = loadDB();
            if (!localRegistry.users[networkTarget.id] || !localRegistry.users[networkTarget.id].warns.length) return message.reply("❌ Cet utilisateur n'a aucun warn.");
            const poppedIncident = localRegistry.users[networkTarget.id].warns.pop();
            saveDB(localRegistry);
            await dispatchToAuditLogs("Unwarn", networkTarget.user, `Retrait automatique du dernier warn (${poppedIncident.reason})`);
            return deployEmbed("🧹 Warn Retiré", `Le dernier avertissement de ${networkTarget} a été supprimé.\n**Ancienne raison :** ${poppedIncident.reason}`, "#34a853");
        }

        if (actionCmd === "warnings") {
            const subject = networkTarget || executioner;
            const localRegistry = loadDB();
            const personalHistory = localRegistry.users[subject.id]?.warns || [];
            if (!personalHistory.length) return deployEmbed("📊 Historique des Warns", `${subject} n'a aucun avertissement.`, "#34a853");
            const structuredList = personalHistory.map((incident, index) => {
                return `**${index + 1}.** ${incident.reason} *(par <@${incident.mod}> le <t:${parseInt(incident.date / 1000)}:d>)*`;
            }).join("\n");
            return deployEmbed(`📊 Warns de ${subject.user?.tag || subject.tag}`, structuredList, "#4285f4");
        }

        if (actionCmd === "clearwarn") {
            if (!executioner.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;
            if (!networkTarget) return message.reply("❌ Veuillez mentionner un membre.");
            const localRegistry = loadDB();
            if (!localRegistry.users[networkTarget.id] || !localRegistry.users[networkTarget.id].warns.length) return message.reply("❌ Aucun historique à effacer.");
            localRegistry.users[networkTarget.id].warns = [];
            saveDB(localRegistry);
            await dispatchToAuditLogs("Clearwarn", networkTarget.user, "Réinitialisation complète du casier");
            return deployEmbed("🧼 Réinitialisation Terminée", `Tous les avertissements de ${networkTarget} ont été effacés.`, "#34a853");
        }

        if (actionCmd === "warnlist") {
            if (!executioner.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;
            const localRegistry = loadDB();
            const compiledIncidents = [];
            for (const [userId, record] of Object.entries(localRegistry.users)) {
                if (record.warns) record.warns.forEach(w => compiledIncidents.push({ userId, ...w }));
            }
            if (compiledIncidents.length === 0) return deployEmbed("📋 Liste des Warns", "Aucun avertissement sur le serveur.", "#34a853");
            compiledIncidents.sort((a, b) => b.date - a.date);
            const contentStream = compiledIncidents.slice(0, 10).map((inc, i) => `\`[${i + 1}]\` <@${inc.userId}> : ${inc.reason} *(par <@${inc.mod}>)*`).join("\n");
            return deployEmbed("📋 10 Derniers Avertissements du Serveur", contentStream, "#4285f4");
        }

        if (actionCmd === "check" || actionCmd === "infractions") {
            const diagnosticTarget = networkTarget || executioner;
            const localRegistry = loadDB();
            const historicalCount = localRegistry.users[diagnosticTarget.id]?.warns?.length || 0;
            const diagnosticEmbed = new EmbedBuilder()
                .setTitle(`📊 Casier Judiciaire - ${diagnosticTarget.user?.tag || diagnosticTarget.tag}`)
                .setColor("#4285f4")
                .setThumbnail(diagnosticTarget.user ? diagnosticTarget.user.displayAvatarURL() : diagnosticTarget.displayAvatarURL())
                .addFields(
                    { name: "🆔 Identifiant", value: `\`${diagnosticTarget.id}\``, inline: true },
                    { name: "⚠️ Nombre de Warns", value: `**${historicalCount}**`, inline: true },
                    { name: "📅 Création du Compte", value: `<t:${parseInt(diagnosticTarget.user?.createdTimestamp / 1000 || diagnosticTarget.createdTimestamp / 1000)}:R>`, inline: false },
                    { name: "📥 Arrivée sur le Serveur", value: `<t:${parseInt(diagnosticTarget.joinedTimestamp / 1000)}:R>`, inline: false }
                )
                .setTimestamp();
            return message.channel.send({ embeds: [diagnosticEmbed] });
        }

        // =====================================================
        // 🔒 [MODIFIÉ] VERROUILLAGE INTELLIGENT TOUS RÔLES (LOCK)
        // =====================================================
        if (actionCmd === "lock") {
            if (!executioner.permissions.has(PermissionsBitField.Flags.ManageChannels)) return;

            try {
                // On récupère toutes les permissions spécifiques (overwrites) déjà définies dans ce salon
                const currentOverwrites = message.channel.permissionOverwrites.cache;
                
                let rolesLockedCount = 0;

                for (const [id, overwrite] of currentOverwrites) {
                    // Type 0 = Rôle. On évite de bloquer les Admin/Modos qui ont la permission d'administrateur
                    if (overwrite.type === 0) {
                        const role = message.guild.roles.cache.get(id);
                        
                        // Sécurité : On ne bloque pas les rôles qui ont la permission de bannir ou d'exclure (le Staff)
                        if (role && !role.permissions.has(PermissionsBitField.Flags.ModerateMembers) && !role.permissions.has(PermissionsBitField.Flags.Administrator)) {
                            await message.channel.permissionOverwrites.edit(id, {
                                SendMessages: false
                            });
                            rolesLockedCount++;
                        }
                    }
                }

                // Bloquer également le rôle de base @everyone au cas où il n'était pas dans la liste des overwrites
                await message.channel.permissionOverwrites.edit(message.guild.id, {
                    SendMessages: false
                });

                return deployEmbed("🔒 Salon Verrouillé", `Le flux d'écriture a été coupé de force pour tous les rôles de membres réguliers détectés dans ce salon.`, "#ea4335");
            } catch (err) {
                console.error(err);
                return message.reply("❌ Échec lors du scan et du verrouillage des rôles.");
            }
        }

        // =====================================================
        // 🔓 [MODIFIÉ] DÉVERROUILLAGE INTELLIGENT (UNLOCK)
        // =====================================================
        if (actionCmd === "unlock") {
            if (!executioner.permissions.has(PermissionsBitField.Flags.ManageChannels)) return;

            try {
                const currentOverwrites = message.channel.permissionOverwrites.cache;

                for (const [id, overwrite] of currentOverwrites) {
                    if (overwrite.type === 0) {
                        const role = message.guild.roles.cache.get(id);
                        // On réinitialise les rôles non-staff sur les valeurs par défaut (null)
                        if (role && !role.permissions.has(PermissionsBitField.Flags.ModerateMembers) && !role.permissions.has(PermissionsBitField.Flags.Administrator)) {
                            await message.channel.permissionOverwrites.edit(id, {
                                SendMessages: null
                            });
                        }
                    }
                }

                // Réinitialiser également @everyone
                await message.channel.permissionOverwrites.edit(message.guild.id, {
                    SendMessages: null
                });

                return deployEmbed("🔓 Salon Déverrouillé", "Les restrictions spécifiques ont été levées, retour aux droits initiaux du salon.", "#34a853");
            } catch (err) {
                return message.reply("❌ Échec lors de la réinitialisation des rôles.");
            }
        }

        // =====================================================
        // KICK / BAN / UNBAN / MUTE / UNMUTE / CLEAR
        // =====================================================
        if (actionCmd === "kick") {
            if (!executioner.permissions.has(PermissionsBitField.Flags.KickMembers)) return;
            if (!networkTarget) return message.reply("❌ Mentionnez un membre.");
            if (!networkTarget.kickable) return message.reply("❌ Rôle supérieur ou égal au mien.");
            const textReason = packetArgs.slice(1).join(" ") || "Aucune raison spécifiée";
            try {
                await dispatchToAuditLogs("Kick", networkTarget.user, textReason);
                await networkTarget.kick(textReason);
                return deployEmbed("👢 Expulsion Confirmée", `**Membre :** ${networkTarget.user.tag}\n**Raison :** ${textReason}\n**Modérateur :** ${executioner}`, "#ea4335");
            } catch (err) { return message.reply("❌ Erreur lors du kick."); }
        }

        if (actionCmd === "ban") {
            if (!executioner.permissions.has(PermissionsBitField.Flags.BanMembers)) return;
            if (!networkTarget) return message.reply("❌ Mentionnez un membre.");
            if (!networkTarget.bannable) return message.reply("❌ Rôle supérieur ou égal au mien.");
            const textReason = packetArgs.slice(1).join(" ") || "Aucune raison spécifiée";
            try {
                await dispatchToAuditLogs("Ban", networkTarget.user, textReason);
                await networkTarget.ban({ reason: textReason });
                return deployEmbed("🔨 Bannissement Confirmé", `**Membre :** ${networkTarget.user.tag}\n**Raison :** ${textReason}\n**Modérateur :** ${executioner}`, "#ea4335");
            } catch (err) { return message.reply("❌ Erreur lors du ban."); }
        }

        if (actionCmd === "unban") {
            if (!executioner.permissions.has(PermissionsBitField.Flags.BanMembers)) return;
            const nativeId = packetArgs[0];
            if (!nativeId) return message.reply("❌ Indiquez l'ID.");
            try {
                await message.guild.members.unban(nativeId);
                return deployEmbed("♻️ Réhabilitation Confirmée", `L'ID \`${nativeId}\` a été débanni.`, "#34a853");
            } catch (err) { return message.reply("❌ ID invalide ou non banni."); }
        }

        if (actionCmd === "mute") {
            if (!executioner.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;
            if (!networkTarget) return message.reply("❌ Mentionnez un membre.");
            if (!networkTarget.moderatable) return message.reply("❌ Membre immunisé.");
            const timeModifier = parseInt(packetArgs[1]) || 5;
            const textReason = packetArgs.slice(2).join(" ") || "Aucune raison spécifiée";
            try {
                await networkTarget.timeout(timeModifier * 60 * 1000, textReason);
                await dispatchToAuditLogs("Mute", networkTarget.user, `Durée: ${timeModifier}m - ${textReason}`);
                return deployEmbed("🔇 Exclusion Temporelle", `**Membre :** ${networkTarget}\n**Durée :** ${timeModifier} minutes\n**Raison :** ${textReason}`, "#fbbc05");
            } catch (err) { return message.reply("❌ Erreur durant le mute."); }
        }

        if (actionCmd === "unmute") {
            if (!executioner.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;
            if (!networkTarget) return message.reply("❌ Mentionnez un membre.");
            try {
                await networkTarget.timeout(null);
                await dispatchToAuditLogs("Unmute", networkTarget.user, "Fin de sanction manuelle");
                return deployEmbed("🔊 Fin d'Exclusion", `${networkTarget} peut de nouveau parler.`, "#34a853");
            } catch (err) { return message.reply("❌ Impossible d'unmute."); }
        }

        if (actionCmd === "clear") {
            if (!executioner.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;
            const packetVolume = parseInt(packetArgs[0]);
            if (!packetVolume || packetVolume < 1 || packetVolume > 100) return message.reply("❌ Nombre entre 1 et 100 requis.");
            await message.delete().catch(() => {});
            try {
                const deletedStack = await message.channel.bulkDelete(packetVolume, true);
                const feedbackLog = await message.channel.send({
                    embeds: [new EmbedBuilder().setColor("#34a853").setDescription(`🧹 **${deletedStack.size}** messages nettoyés.`)]
                });
                setTimeout(() => feedbackLog.delete().catch(() => {}), 4000);
            } catch (err) { return message.channel.send("❌ Messages trop vieux (> 14 jours)."); }
        }

    });
};
