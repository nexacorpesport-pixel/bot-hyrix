const {
    EmbedBuilder,
    PermissionsBitField
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "../data/moderationDB.json");

// =========================
// DB
// =========================
function loadDB() {
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify({ users: {} }, null, 2));
    }
    return JSON.parse(fs.readFileSync(DB_PATH));
}

function saveDB(db) {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// =========================
// EXPORT
// =========================
module.exports = (client) => {

    console.log("[MODERATION] chargé");

    client.on("messageCreate", async (message) => {

        if (!message.guild || message.author.bot) return;
        if (!message.content.startsWith("+")) return;

        const args = message.content.slice(1).trim().split(/ +/);
        const cmd = args.shift().toLowerCase();
        const member = message.member;

        const target = message.mentions.members.first();

        // =========================================
        // WARN
        // =========================================
        if (cmd === "warn") {

            if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
                return;

            if (!target) return message.reply("Mentionne un membre.");

            const reason = args.slice(1).join(" ") || "Aucune raison";

            const db = loadDB();
            if (!db.users[target.id]) db.users[target.id] = { warns: [] };

            db.users[target.id].warns.push({
                reason,
                mod: member.id,
                date: Date.now()
            });

            saveDB(db);

            return message.channel.send(`⚠️ ${target} warn : ${reason}`);
        }

        // =========================================
        // UNWARN
        // =========================================
        if (cmd === "unwarn") {

            if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
                return;

            if (!target) return;

            const db = loadDB();
            if (!db.users[target.id]) return;

            db.users[target.id].warns.pop();
            saveDB(db);

            return message.channel.send(`🧹 Un warn retiré à ${target}`);
        }

        // =========================================
        // WARNINGS LIST
        // =========================================
        if (cmd === "warnings") {

            const user = target || member;

            const db = loadDB();
            const warns = db.users[user.id]?.warns || [];

            if (!warns.length)
                return message.channel.send(`${user} n'a aucun warn.`);

            const list = warns.map((w, i) =>
                `**${i + 1}.** ${w.reason}`
            ).join("\n");

            return message.channel.send(`📊 Warns de ${user} :\n${list}`);
        }

        // =========================================
        // CLEARWARN
        // =========================================
        if (cmd === "clearwarn") {

            if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
                return;

            if (!target) return;

            const db = loadDB();
            if (!db.users[target.id]) return;

            db.users[target.id].warns = [];
            saveDB(db);

            return message.channel.send(`🧼 Tous les warns supprimés pour ${target}`);
        }

        // =========================================
        // INFRACTION
        // =========================================
        if (cmd === "infractions") {

            const user = target || member;

            const db = loadDB();
            const warns = db.users[user.id]?.warns || [];

            return message.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(`📊 Infractions - ${user.user.tag}`)
                        .setColor("Orange")
                        .setDescription(`Warns : **${warns.length}**`)
                ]
            });
        }

        // =========================================
        // KICK
        // =========================================
        if (cmd === "kick") {

            if (!member.permissions.has(PermissionsBitField.Flags.KickMembers))
                return;

            if (!target) return;

            const reason = args.slice(1).join(" ") || "Aucune raison";

            await target.kick(reason);

            return message.channel.send(`👢 ${target.user.tag} kick : ${reason}`);
        }

        // =========================================
        // BAN
        // =========================================
        if (cmd === "ban") {

            if (!member.permissions.has(PermissionsBitField.Flags.BanMembers))
                return;

            if (!target) return;

            const reason = args.slice(1).join(" ") || "Aucune raison";

            await target.ban({ reason });

            return message.channel.send(`🔨 ${target.user.tag} ban : ${reason}`);
        }

        // =========================================
        // UNBAN
        // =========================================
        if (cmd === "unban") {

            if (!member.permissions.has(PermissionsBitField.Flags.BanMembers))
                return;

            const userId = args[0];
            if (!userId) return;

            await message.guild.members.unban(userId);

            return message.channel.send(`♻️ Unban : ${userId}`);
        }

        // =========================================
        // MUTE (timeout)
        // =========================================
        if (cmd === "mute") {

            if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
                return;

            if (!target) return;

            const time = parseInt(args[1]) || 5;

            await target.timeout(time * 60 * 1000);

            return message.channel.send(`🔇 ${target} mute ${time} min`);
        }

        // =========================================
        // UNMUTE
        // =========================================
        if (cmd === "unmute") {

            if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
                return;

            if (!target) return;

            await target.timeout(null);

            return message.channel.send(`🔊 ${target} unmute`);
        }

        // =========================================
        // CLEAR
        // =========================================
        if (cmd === "clear") {

            if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages))
                return;

            const amount = parseInt(args[0]);
            if (!amount) return;

            await message.channel.bulkDelete(amount, true);

            return message.channel.send(`🧹 ${amount} messages supprimés`).then(m =>
                setTimeout(() => m.delete().catch(() => {}), 3000)
            );
        }

        // =========================================
        // LOCK
        // =========================================
        if (cmd === "lock") {

            if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels))
                return;

            await message.channel.permissionOverwrites.edit(message.guild.id, {
                SendMessages: false
            });

            return message.channel.send("🔒 Salon lock");
        }

        // =========================================
        // UNLOCK
        // =========================================
        if (cmd === "unlock") {

            if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels))
                return;

            await message.channel.permissionOverwrites.edit(message.guild.id, {
                SendMessages: true
            });

            return message.channel.send("🔓 Salon unlock");
        }

    });
};
