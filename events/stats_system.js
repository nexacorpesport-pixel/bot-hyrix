const { EmbedBuilder, PermissionsBitField } = require("discord.js");
const fs = require("fs");
const path = require("path");

// =====================================================
// PERSISTENT STORAGE ROUTING - CORRIGÉ POUR LES CHEMINS HÉBERGEURS
// =====================================================
const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "stats_database.json");

// Sécurité d'initialisation des dossiers et fichiers
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ users: {}, channels: {}, server: { totalMessages: 0, totalVoiceTime: 0 } }, null, 4), "utf-8");
}

function readDB() { 
    try {
        return JSON.parse(fs.readFileSync(DB_PATH, "utf-8")); 
    } catch (e) {
        return { users: {}, channels: {}, server: { totalMessages: 0, totalVoiceTime: 0 } };
    }
}
function writeDB(data) { 
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 4), "utf-8"); 
    } catch (e) {
        console.log("❌ Erreur d'écriture DB Stats :", e);
    }
}

// RAM Runtime Registry pour stocker l'heure de connexion des membres en vocal
const voiceSessions = new Map();

// Configuration du Staff
const OWNER_ID = "1431661348218998948";
const STAFF_ROLES = ["1528184662478946535", "1528184660436455545"];

module.exports = (client) => {

    const isStaff = (member) => {
        if (!member) return false;
        if (member.id === OWNER_ID || member.guild.ownerId === member.id) return true;
        if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
        return STAFF_ROLES.some(roleId => member.roles.cache.has(roleId));
    };

    // Helper pour formater le temps vocal (ms -> Heures, Min, Sec)
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
    // 📈 TRACKER TEXTUEL (messageCreate)
    // =====================================================
    client.on("messageCreate", async (msg) => {
        if (!msg.guild || msg.author.bot) return;

        const db = readDB();
        const userId = msg.author.id;
        const chanId = msg.channel.id;

        // 1. Initialisation des objets si inexistants
        if (!db.users[userId]) db.users[userId] = { messages: 0, voiceTime: 0, channels: {} };
        if (!db.channels[chanId]) db.channels[chanId] = { messages: 0 };
        if (!db.users[userId].channels) db.users[userId].channels = {};
        if (!db.users[userId].channels[chanId]) db.users[userId].channels[chanId] = 0;

        // 2. Incrémentation des compteurs
        db.users[userId].messages += 1;
        db.users[userId].channels[chanId] += 1;
        db.channels[chanId].messages += 1;
        db.server.totalMessages += 1;

        writeDB(db);

        // =====================================================
        // ⌨️ TERMINAL DES COMMANDES TEXTUELLES (+)
        // =====================================================
        const prefix = "+";
        if (!msg.content.startsWith(prefix)) return;

        const args = msg.content.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        // 📜 COMMANDE : +help-stats
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

        // 👤 COMMANDE : +stats ou +stats [@membre] ou +stats [ID]
        if (command === "stats") {
            let targetUser = msg.mentions.users.first();
            if (!targetUser && args[0]) {
                targetUser = await client.users.fetch(args[0]).catch(() => null);
            }
            if (!targetUser) targetUser = msg.author;

            const targetData = db.users[targetUser.id];
            if (!targetData) return msg.reply(`❌ **${targetUser.username}** n'a pas encore enregistré d'activité sur ce serveur.`);

            // Trouver son salon écrit favori
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
                .setAuthor({ name: `Statistiques de ${targetUser.username}`, iconURL: targetUser.displayAvatarURL({ dynamic: true }) })
                .setColor("#2b2d31")
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
                .addFields(
                    { name: "💬 Messages envoyés", value: `\`${targetData.messages}\` messages`, inline: true },
                    { name: "🔊 Temps en Vocal", value: `\`${formatVoiceTime(targetData.voiceTime)}\``, inline: true },
                    { name: "📍 Salon favori", value: favChanStr, inline: false }
                )
                .setFooter({ text: "Aeroz Stats Engine" })
                .setTimestamp();

            return msg.channel.send({ embeds: [statsEmbed] });
        }

        // 🌐 COMMANDE : +stats-server
        if (command === "stats-server") {
            let topChanId = "Aucun";
            let topChanMsgs = 0;
            for (const [cId, data] of Object.entries(db.channels)) {
                if (data.messages > topChanMsgs) {
                    topChanMsgs = data.messages;
                    topChanId = cId;
                }
            }
            const topChanStr = topChanId !== "Aucun" ? `<#${topChanId}> avec ${topChanMsgs} messages` : "Aucun";

            const serverEmbed = new EmbedBuilder()
                .setTitle(`📊 Activité Globale de ${msg.guild.name}`)
                .setColor("Blue")
                .setThumbnail(msg.guild.iconURL({ dynamic: true }))
                .addFields(
                    { name: "💬 Total Messages", value: `\`${db.server.totalMessages}\` messages envoyés`, inline: true },
                    { name: "🔊 Total Vocal", value: `\`${formatVoiceTime(db.server.totalVoiceTime)}\` cumulés`, inline: true },
                    { name: "🔥 Zone la plus active", value: topChanStr, inline: false }
                )
                .setFooter({ text: "Données cumulées en temps réel" });

            return msg.channel.send({ embeds: [serverEmbed] });
        }

        // 🏆 COMMANDE : +top-msg
        if (command === "top-msg") {
            const sortedUsers = Object.entries(db.users)
                .map(([id, uData]) => ({ id, messages: uData.messages }))
                .sort((a, b) => b.messages - a.messages)
                .slice(0, 10);

            if (sortedUsers.length === 0) return msg.reply("Aucune donnée enregistrée.");

            let description = "";
            sortedUsers.forEach((user, index) => {
                description += `**${index + 1}.** <@${user.id}> — \`${user.messages}\` messages\n`;
            });

            const topMsgEmbed = new EmbedBuilder()
                .setTitle("🏆 Top 10 — Activité Écrite (Messages)")
                .setColor("Gold")
                .setDescription(description)
                .setTimestamp();

            return msg.channel.send({ embeds: [topMsgEmbed] });
        }

        // 🏆 COMMANDE : +top-voice
        if (command === "top-voice") {
            const sortedUsers = Object.entries(db.users)
                .map(([id, uData]) => ({ id, voiceTime: uData.voiceTime || 0 }))
                .sort((a, b) => b.voiceTime - a.voiceTime)
                .slice(0, 10);

            if (sortedUsers.length === 0) return msg.reply("Aucune donnée enregistrée.");

            let description = "";
            sortedUsers.forEach((user, index) => {
                description += `**${index + 1}.** <@${user.id}> — \`${formatVoiceTime(user.voiceTime)}\`\n`;
            });

            const topVoiceEmbed = new EmbedBuilder()
                .setTitle("🏆 Top 10 — Activité Vocale (Temps)")
                .setColor("Gold")
                .setDescription(description)
                .setTimestamp();

            return msg.channel.send({ embeds: [topVoiceEmbed] });
        }

        // ⚙️ COMMANDES STAFF : +stats-reset / +stats-wipe
        if (command === "stats-reset") {
            if (!isStaff(msg.member)) return;
            const target = msg.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
            if (!target) return msg.reply("❌ Veuillez mentionner ou fournir l'ID d'un membre.");

            if (db.users[target.id]) {
                delete db.users[target.id];
                writeDB(db);
                return msg.reply(`✅ Les statistiques de **${target.username}** ont été remises à zéro.`);
            }
            return msg.reply("Ce joueur n'a pas de statistiques.");
        }

        if (command === "stats-wipe") {
            if (!isStaff(msg.member)) return;
            writeDB({ users: {}, channels: {}, server: { totalMessages: 0, totalVoiceTime: 0 } });
            return msg.reply("♻️ **Base de données réinitialisée !** Toutes les statistiques du serveur sont reparties de zéro.");
        }
    });

    // =====================================================
    // 🎙️ TRACKER VOCAL (voiceStateUpdate)
    // =====================================================
    client.on("voiceStateUpdate", async (oldState, newState) => {
        if (newState.member?.user.bot) return;

        const userId = newState.member.id;

        // Cas 1 : L'utilisateur se connecte à un salon vocal
        if (!oldState.channelId && newState.channelId) {
            voiceSessions.set(userId, Date.now());
        }

        // Cas 2 : L'utilisateur se déconnecte totalement des vocaux
        if (oldState.channelId && !newState.channelId) {
            const joinTime = voiceSessions.get(userId);
            if (joinTime) {
                const elapsed = Date.now() - joinTime;
                voiceSessions.delete(userId);

                const db = readDB();
                if (!db.users[userId]) db.users[userId] = { messages: 0, voiceTime: 0, channels: {} };
                
                db.users[userId].voiceTime = (db.users[userId].voiceTime || 0) + elapsed;
                db.server.totalVoiceTime += elapsed;

                writeDB(db);
            }
        }

        // Cas 3 : Changement de salon
        if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            const joinTime = voiceSessions.get(userId);
            if (joinTime) {
                const elapsed = Date.now() - joinTime;
                
                const db = readDB();
                if (!db.users[userId]) db.users[userId] = { messages: 0, voiceTime: 0, channels: {} };

                db.users[userId].voiceTime = (db.users[userId].voiceTime || 0) + elapsed;
                db.server.totalVoiceTime += elapsed;
                writeDB(db);

                voiceSessions.set(userId, Date.now());
            } else {
                voiceSessions.set(userId, Date.now());
            }
        }
    });
};
