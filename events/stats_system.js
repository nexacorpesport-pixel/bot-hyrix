const { EmbedBuilder, PermissionsBitField } = require("discord.js");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "stats_database.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Initialisation de la structure si absente
if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ users: {}, channels: {}, server: { totalMessages: 0, totalVoiceTime: 0 } }, null, 4), "utf-8");
}

// =====================================================
// GESTIONNAIRE DE CACHE POUR ÉVITER LES OVERHEADS I/O
// =====================================================
let memoryDB = { users: {}, channels: {}, server: { totalMessages: 0, totalVoiceTime: 0 } };

try {
    memoryDB = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
} catch (e) {
    console.error("❌ Impossible de charger la DB Stats en mémoire, reset par défaut.");
}

// Sauvegarde asynchrone régulière (Toutes les 30 secondes)
setInterval(() => {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(memoryDB, null, 4), "utf-8");
    } catch (e) {
        console.error("❌ Erreur lors de la sauvegarde auto de la DB Stats :", e);
    }
}, 30000);

// Sauvegarde d'urgence si le bot s'éteint brusquement
process.on("SIGINT", () => {
    fs.writeFileSync(DB_PATH, JSON.stringify(memoryDB, null, 4), "utf-8");
    process.exit(0);
});

const voiceSessions = new Map();
const OWNER_ID = "1431661348218998948";
const STAFF_ROLES = ["1528184662478946535", "1528184660436455545"];

module.exports = (client) => {

    const isStaff = (member) => {
        if (!member) return false;
        if (member.id === OWNER_ID || member.guild.ownerId === member.id) return true;
        if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
        return STAFF_ROLES.some(roleId => member.roles.cache.has(roleId));
    };

    const formatVoiceTime = (ms) => {
        if (!ms || ms < 1000) return "0s";
        const totalSecs = Math.floor(ms / 1000);
        const hours = Math.floor(totalSecs / 3600);
        const minutes = Math.floor((totalSecs % 3600) / 60);
        const seconds = totalSecs % 60;

        let result = [];
        if (hours > 0) result.push(`${hours}h`);
        if (minutes > 0) result.push(`${minutes}m`);
        if (seconds > 0 || result.length === 0) result.push(`${seconds}s`);
        return result.join(" ");
    };

    // =====================================================
    // 📈 TRACKER TEXTUEL
    // =====================================================
    client.on("messageCreate", async (msg) => {
        if (!msg.guild || msg.author.bot) return;

        const userId = msg.author.id;
        const chanId = msg.channel.id;

        if (!memoryDB.users[userId]) memoryDB.users[userId] = { messages: 0, voiceTime: 0, channels: {} };
        if (!memoryDB.channels[chanId]) memoryDB.channels[chanId] = { messages: 0 };
        if (!memoryDB.users[userId].channels) memoryDB.users[userId].channels = {};
        if (!memoryDB.users[userId].channels[chanId]) memoryDB.users[userId].channels[chanId] = 0;

        memoryDB.users[userId].messages += 1;
        memoryDB.users[userId].channels[chanId] += 1;
        memoryDB.channels[chanId].messages += 1;
        memoryDB.server.totalMessages += 1;

        const prefix = "+";
        if (!msg.content.startsWith(prefix)) return;

        const args = msg.content.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        if (command === "help-stats") {
            const embed = new EmbedBuilder()
                .setTitle("📊 Menu des Statistiques — Aeroz Esports")
                .setColor("#2b2d31")
                .setDescription("Découvrez toutes les commandes pour suivre votre activité et celle du serveur !")
                .addFields(
                    { name: "👤 Profils", value: "`+stats` : Affiche vos propres stats.\n`+stats [@membre/ID]` : Affiche les stats d'un autre joueur." },
                    { name: "🏆 Classements", value: "`+top-msg` : Top 10 des membres les plus actifs à l'écrit.\n`+top-voice` : Top 10 des membres les plus actifs en vocal." },
                    { name: "🌐 Serveur", value: "`+stats-server` : Statistiques globales du serveur." },
                    { name: "🛠️ Staff Only", value: "`+stats-reset [@membre]` : Remet à zéro un joueur.\n`+stats-wipe` : Efface toute la base de données de stats." }
                )
                .setFooter({ text: "Aeroz Automations" });
            return msg.channel.send({ embeds: [embed] });
        }

        if (command === "stats") {
            let targetUser = msg.mentions.users.first();
            if (!targetUser && args[0]) {
                targetUser = await client.users.fetch(args[0]).catch(() => null);
            }
            if (!targetUser) targetUser = msg.author;

            const targetData = memoryDB.users[targetUser.id];
            if (!targetData) return msg.reply(`❌ **${targetUser.username}** n'a pas encore enregistré d'activité sur ce serveur.`);

            let favChanId = "Aucun";
            let maxMsgs = 0;
            if (targetData.channels) {
                for (const [cId, count] of Object.entries(targetData.channels)) {
                    if (count > maxMsgs) {
                        maxMsgs = count;
                        favChanId = cId;
                    }
                }
            }
            const favChanStr = favChanId !== "Aucun" ? `<#${favChanId}> (${maxMsgs} msgs)` : "Aucun";

            const statsEmbed = new EmbedBuilder()
                .setAuthor({ name: `Statistiques de ${targetUser.username}`, iconURL: targetUser.displayAvatarURL({ forceStatic: false }) })
                .setColor("#2b2d31")
                .setThumbnail(targetUser.displayAvatarURL({ forceStatic: false, size: 256 }))
                .addFields(
                    { name: "💬 Messages envoyés", value: `\`${targetData.messages}\` messages`, inline: true },
                    { name: "🔊 Temps en Vocal", value: `\`${formatVoiceTime(targetData.voiceTime)}\``, inline: true },
                    { name: "📍 Salon favori", value: favChanStr, inline: false }
                )
                .setFooter({ text: "Aeroz Stats Engine" })
                .setTimestamp();

            return msg.channel.send({ embeds: [statsEmbed] });
        }

        if (command === "stats-server") {
            let topChanId = "Aucun";
            let topChanMsgs = 0;
            for (const [cId, data] of Object.entries(memoryDB.channels)) {
                if (data.messages > topChanMsgs) {
                    topChanMsgs = data.messages;
                    topChanId = cId;
                }
            }
            const topChanStr = topChanId !== "Aucun" ? `<#${topChanId}> avec ${topChanMsgs} messages` : "Aucun";

            const serverEmbed = new EmbedBuilder()
                .setTitle(`📊 Activité Globale de ${msg.guild.name}`)
                .setColor("Blue")
                .setThumbnail(msg.guild.iconURL({ forceStatic: false }))
                .addFields(
                    { name: "💬 Total Messages", value: `\`${memoryDB.server.totalMessages}\` messages`, inline: true },
                    { name: "🔊 Total Vocal", value: `\`${formatVoiceTime(memoryDB.server.totalVoiceTime)}\``, inline: true },
                    { name: "🔥 Zone la plus active", value: topChanStr, inline: false }
                )
                .setFooter({ text: "Données cumulées en temps réel" });

            return msg.channel.send({ embeds: [serverEmbed] });
        }

        if (command === "top-msg") {
            const sortedUsers = Object.entries(memoryDB.users)
                .map(([id, uData]) => ({ id, messages: uData.messages || 0 }))
                .sort((a, b) => b.messages - a.messages)
                .slice(0, 10);

            if (sortedUsers.length === 0) return msg.reply("Aucune donnée enregistrée.");

            let description = sortedUsers.map((user, index) => `**${index + 1}.** <@${user.id}> — \`${user.messages}\` messages`).join("\n");

            const topMsgEmbed = new EmbedBuilder()
                .setTitle("🏆 Top 10 — Activité Écrite (Messages)")
                .setColor("Gold")
                .setDescription(description)
                .setTimestamp();

            return msg.channel.send({ embeds: [topMsgEmbed] });
        }

        if (command === "top-voice") {
            const sortedUsers = Object.entries(memoryDB.users)
                .map(([id, uData]) => ({ id, voiceTime: uData.voiceTime || 0 }))
                .sort((a, b) => b.voiceTime - a.voiceTime)
                .slice(0, 10);

            if (sortedUsers.length === 0) return msg.reply("Aucune donnée enregistrée.");

            let description = sortedUsers.map((user, index) => `**${index + 1}.** <@${user.id}> — \`${formatVoiceTime(user.voiceTime)}\``).join("\n");

            const topVoiceEmbed = new EmbedBuilder()
                .setTitle("🏆 Top 10 — Activité Vocale (Temps)")
                .setColor("Gold")
                .setDescription(description)
                .setTimestamp();

            return msg.channel.send({ embeds: [topVoiceEmbed] });
        }

        if (command === "stats-reset") {
            if (!isStaff(msg.member)) return;
            const target = msg.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
            if (!target) return msg.reply("❌ Veuillez mentionner ou fournir l'ID d'un membre.");

            if (memoryDB.users[target.id]) {
                delete memoryDB.users[target.id];
                return msg.reply(`✅ Les statistiques de **${target.username}** ont été remises à zéro.`);
            }
            return msg.reply("Ce joueur n'a pas de statistiques.");
        }

        if (command === "stats-wipe") {
            if (!isStaff(msg.member)) return;
            memoryDB = { users: {}, channels: {}, server: { totalMessages: 0, totalVoiceTime: 0 } };
            return msg.reply("♻️ **Base de données réinitialisée !**");
        }
    });

    // =====================================================
    // 🎙️ TRACKER VOCAL OPTIMISÉ (AVEC GESTION DE SOURDINE)
    // =====================================================
    client.on("voiceStateUpdate", async (oldState, newState) => {
        if (newState.member?.user.bot) return;

        const userId = newState.member.id;
        const isDeaf = newState.selfDeaf || newState.serverDeaf;
        const wasDeaf = oldState.selfDeaf || oldState.serverDeaf;

        // Condition d'activité légitime : Être dans un salon ET ne pas être sourd
        const isActivelyInVoice = newState.channelId && !isDeaf;
        const wasActivelyInVoice = oldState.channelId && !wasDeaf;

        // Entrée en vocal légitime (ou désactivation de la sourdine)
        if (isActivelyInVoice && !wasActivelyInVoice) {
            voiceSessions.set(userId, Date.now());
        } 
        // Sortie du vocal (ou passage en sourdine)
        else if (!isActivelyInVoice && wasActivelyInVoice) {
            const joinTime = voiceSessions.get(userId);
            if (joinTime) {
                const elapsed = Date.now() - joinTime;
                voiceSessions.delete(userId);

                if (!memoryDB.users[userId]) memoryDB.users[userId] = { messages: 0, voiceTime: 0, channels: {} };
                memoryDB.users[userId].voiceTime = (memoryDB.users[userId].voiceTime || 0) + elapsed;
                memoryDB.server.totalVoiceTime += elapsed;
            }
        }
        // Changement de salon simple (sans altération du statut de sourdine)
        else if (isActivelyInVoice && wasActivelyInVoice && oldState.channelId !== newState.channelId) {
            const joinTime = voiceSessions.get(userId);
            const elapsed = joinTime ? Date.now() - joinTime : 0;

            if (!memoryDB.users[userId]) memoryDB.users[userId] = { messages: 0, voiceTime: 0, channels: {} };
            memoryDB.users[userId].voiceTime = (memoryDB.users[userId].voiceTime || 0) + elapsed;
            memoryDB.server.totalVoiceTime += elapsed;

            voiceSessions.set(userId, Date.now());
        }
    });
};
