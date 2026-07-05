const {
    EmbedBuilder,
    PermissionsBitField
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "../data/moderationDB.json");

// =========================
// GESTION BASE DE DONNÉES LOCALES
// =========================
function loadDB() {
    if (!fs.existsSync(DB_PATH)) {
        const dir = path.dirname(DB_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(DB_PATH, JSON.stringify({ users: {} }, null, 2));
    }
    return JSON.parse(fs.readFileSync(DB_PATH));
}

function saveDB(db) {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// =========================
// EXPORT SYSTEM
// =========================
module.exports = (client) => {

    console.log("[🛡️ MODERATION] Module d'administration chargé avec succès.");

    client.on("messageCreate", async (message) => {

        if (!message.guild || message.author.bot) return;
        if (!message.content.startsWith("+")) return;

        const args = message.content.slice(1).trim().split(/ +/);
        const cmd = args.shift().toLowerCase();
        const member = message.member;
        const target = message.mentions.members.first();

        // Fonction utilitaire pour générer des embeds de réponse rapidement
        const sendEmbedResponse = (title, description, color = "Orange") => {
            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .setColor(color)
                .setTimestamp();
            return message.channel.send({ embeds: [embed] });
        };

        // =========================================
        // WARN
        // =========================================
        if (cmd === "warn") {
            if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;
            if (!target) return message.reply("❌ Veuillez mentionner un membre à avertir.");
            if (target.id === message.author.id) return message.reply("❌ Vous ne pouvez pas vous warn vous-même.");

            const reason = args.slice(1).join(" ") || "Aucune raison spécifiée";

            const db = loadDB();
            if (!db.users[target.id]) db.users[target.id] = { warns: [] };

            db.users[target.id].warns.push({
                reason,
                mod: member.id,
                date: Date.now()
            });

            saveDB(db);
            return sendEmbedResponse("⚠️ Avertissement Enregistré", `**Membre :** ${target}\n**Raison :** ${reason}\n**Modérateur :** ${member}`, "Yellow");
        }

        // =========================================
        // UNWARN
        // =========================================
        if (cmd === "unwarn") {
            if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;
            if (!target) return message.reply("❌ Veuillez mentionner un membre.");

            const db = loadDB();
            if (!db.users[target.id] || !db.users[target.id].warns.length) {
                return message.reply("❌ Cet utilisateur ne possède aucun avertissement.");
            }

            const removedWarn = db.users[target.id].warns.pop();
            saveDB(db);

            return sendEmbedResponse("🧹 Warn Retiré", `Le dernier avertissement de ${target} a été supprimé.\n**Ancienne raison :** ${removedWarn.reason}`, "Green");
        }

        // =========================================
        // WARNINGS LIST
        // =========================================
        if (cmd === "warnings") {
            const user = target || member;
            const db = loadDB();
            const warns = db.users[user.id]?.warns || [];

            if (!warns.length) {
                return sendEmbedResponse("📊 Historique des Warns", `${user} ne possède aucun avertissement dans la base de données.`, "Green");
            }

            const list = warns.map((w, i) => {
                const date = w.date ? `<t:${parseInt(w.date / 1000)}:d>` : "Date inconnue";
                return `**${i + 1}.** ${w.reason} *(par <@${w.mod}> le ${date})*`;
            }).join("\n");

            return sendEmbedResponse(`📊 Warns de ${user.user ? user.user.tag : user.tag}`, list, "Orange");
        }

        // =========================================
        // CLEARWARN
        // =========================================
        if (cmd === "clearwarn") {
            if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;
            if (!target) return message.reply("❌ Veuillez mentionner un membre.");

            const db = loadDB();
            if (!db.users[target.id] || !db.users[target.id].warns.length) {
                return message.reply("❌ Cet utilisateur n'a aucun historique d'avertissement.");
            }

            db.users[target.id].warns = [];
            saveDB(db);

            return sendEmbedResponse("🧼 Réinitialisation Terminée", `Tous les avertissements de ${target} ont été effacés avec succès.`, "Green");
        }

        // =========================================
        // INFRACTIONS
        // =========================================
        if (cmd === "infractions") {
            const user = target || member;
            const db = loadDB();
            const warns = db.users[user.id]?.warns || [];

            const embed = new EmbedBuilder()
                .setTitle(`📊 Casier Judiciaire - ${user.user ? user.user.tag : user.tag}`)
                .setColor("Orange")
                .setThumbnail(user.user ? user.user.displayAvatarURL() : user.displayAvatarURL())
                .addFields(
                    { name: "🆔 Identifiant", value: `\`${user.id}\``, inline: true },
                    { name: "⚠️ Nombre de Warns", value: `**${warns.length}**`, inline: true }
                )
                .setTimestamp();

            return message.channel.send({ embeds: [embed] });
        }

        // =========================================
        // KICK
        // =========================================
        if (cmd === "kick") {
            if (!member.permissions.has(PermissionsBitField.Flags.KickMembers)) return;
            if (!target) return message.reply("❌ Veuillez mentionner un membre à kick.");
            if (!target.kickable) return message.reply("❌ Impossible de kick ce membre. Mon rôle est probablement inférieur au sien ou il possède des permissions d'immunité.");

            const reason = args.slice(1).join(" ") || "Aucune raison spécifiée";

            try {
                await target.kick(reason);
                return sendEmbedResponse("👢 Expulsion Confirmée", `**Membre :** ${target.user.tag} (\`${target.id}\`)\n**Raison :** ${reason}\n**Modérateur :** ${member}`, "Red");
            } catch (err) {
                return message.reply("❌ Une erreur est survenue lors de la tentative d'expulsion.");
            }
        }

        // =========================================
        // BAN
        // =========================================
        if (cmd === "ban") {
            if (!member.permissions.has(PermissionsBitField.Flags.BanMembers)) return;
            if (!target) return message.reply("❌ Veuillez mentionner un membre à bannir.");
            if (!target.bannable) return message.reply("❌ Impossible de bannir ce membre. Mon rôle est inférieur au sien.");

            const reason = args.slice(1).join(" ") || "Aucune raison spécifiée";

            try {
                await target.ban({ reason });
                return sendEmbedResponse("🔨 Bannissement Confirmé", `**Membre :** ${target.user.tag} (\`${target.id}\`)\n**Raison :** ${reason}\n**Modérateur :** ${member}`, "DarkRed");
            } catch (err) {
                return message.reply("❌ Une erreur est survenue lors de la tentative de bannissement.");
            }
        }

        // =========================================
        // UNBAN
        // =========================================
        if (cmd === "unban") {
            if (!member.permissions.has(PermissionsBitField.Flags.BanMembers)) return;
            
            const userId = args[0];
            if (!userId) return message.reply("❌ Indiquez l'ID complet de l'utilisateur à débannir.");

            try {
                await message.guild.members.unban(userId);
                return sendEmbedResponse("♻️ Réhabilitation Confirmée", `L'utilisateur avec l'ID \`${userId}\` a été débanni du serveur.`, "Green");
            } catch (err) {
                return message.reply("❌ Identifiant invalide ou utilisateur non banni.");
            }
        }

        // =========================================
        // MUTE (timeout)
        // =========================================
        if (cmd === "mute") {
            if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;
            if (!target) return message.reply("❌ Veuillez mentionner un membre à mute.");
            if (!target.moderatable) return message.reply("❌ Je ne dispose pas des privilèges nécessaires pour exclure temporairement ce membre.");

            const time = parseInt(args[1]) || 5;
            const reason = args.slice(2).join(" ") || "Aucune raison spécifiée";

            try {
                await target.timeout(time * 60 * 1000, reason);
                return sendEmbedResponse("🔇 Exclusion Temporelle (Mute)", `**Membre :** ${target}\n**Durée :** ${time} minutes\n**Raison :** ${reason}\n**Modérateur :** ${member}`, "Orange");
            } catch (err) {
                return message.reply("❌ Erreur lors de l'application de l'exclusion temporelle.");
            }
        }

        // =========================================
        // UNMUTE
        // =========================================
        if (cmd === "unmute") {
            if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;
            if (!target) return message.reply("❌ Veuillez mentionner un membre à unmute.");

            try {
                await target.timeout(null);
                return sendEmbedResponse("🔊 Fin d'Exclusion", `${target} a récupéré la permission de parler.\n**Modérateur :** ${member}`, "Green");
            } catch (err) {
                return message.reply("❌ Impossible de retirer le mute de ce membre.");
            }
        }

        // =========================================
        // CLEAR
        // =========================================
        if (cmd === "clear") {
            if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

            const amount = parseInt(args[0]);
            if (!amount || amount < 1 || amount > 100) {
                return message.reply("❌ Spécifiez un nombre de messages à supprimer entre 1 et 100.");
            }

            // Suppression du message de commande en amont pour éviter les conflits de compte
            await message.delete().catch(() => {});

            try {
                const deleted = await message.channel.bulkDelete(amount, true);
                const reply = await message.channel.send({
                    embeds: [new EmbedBuilder().setColor("Green").setDescription(`🧹 **${deleted.size}** messages nettoyés avec succès.`)]
                });
                setTimeout(() => reply.delete().catch(() => {}), 4000);
            } catch (err) {
                return message.channel.send("❌ Impossible de supprimer des messages datant de plus de 14 jours en raison des limites imposées par l'API Discord.");
            }
        }

        // =========================================
        // LOCK
        // =========================================
        if (cmd === "lock") {
            if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return;

            try {
                await message.channel.permissionOverwrites.edit(message.guild.id, {
                    SendMessages: false
                });
                return sendEmbedResponse("🔒 Salon Verrouillé", "Les membres sans permissions administratives spécifiques ne peuvent plus envoyer de messages ici.", "Red");
            } catch (err) {
                return message.reply("❌ Échec lors de la modification des permissions du salon.");
            }
        }

        // =========================================
        // UNLOCK
        // =========================================
        if (cmd === "unlock") {
            if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return;

            try {
                await message.channel.permissionOverwrites.edit(message.guild.id, {
                    SendMessages: null // Réinitialise sur les valeurs par défaut du rôle @everyone
                });
                return sendEmbedResponse("🔓 Salon Déverrouillé", "Les membres réguliers ont de nouveau l'autorisation d'écrire dans ce salon.", "Green");
            } catch (err) {
                return message.reply("❌ Échec lors du déverrouillage du salon.");
            }
        }

    });
};
