const {
    PermissionsBitField,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");
const fs = require("fs");
const path = require("path");

// Variables de config anti-spam
const MSG_LIMIT = 5;
const MSG_INTERVAL = 6000; 
const MAX_MENTIONS = 4;       
const MAX_LINES = 4;           
const MAX_CAPS_RATIO = 0.75; 
const REACT_LIMIT = 5;         
const REACT_INTERVAL = 3000;
const MAX_EMOJIS = 8;     
const MAX_SPOILERS = 6;   

const CONF_CHAN_ID = "1522934627461759067";

const DB_PATH = path.join(__dirname, "lockdown_state_db.json");

let crisisDb = { globalLockdown: false, lockedChannels: [] };
if (fs.existsSync(DB_PATH)) {
    try {
        crisisDb = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    } catch (e) {
        console.log("[Security] Erreur de chargement de l'état de crise.");
    }
}

const saveCrisisDb = () => {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(crisisDb, null, 2), "utf-8");
    } catch (e) {
        console.log("[Security] Erreur d'écriture de l'état de crise.");
    }
};

// Maps de stockage temporaire
const msgTracker = new Map();
const warnTracker = new Map();
const whTracker = new Map();
const spamTracker = new Map();
const reactTracker = new Map();
const editTracker = new Map(); 

const blockedChans = new Set(crisisDb.lockedChannels); 

// Comparateur de texte (Levenshtein basique pour les spams)
function getSimilarity(s1, s2) {
    if (!s1 || !s2) return 0;
    if (Math.abs(s1.length - s2.length) > 10) return 0;

    const arr = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
    for (let i = 0; i <= s1.length; i++) arr[0][i] = i;
    for (let j = 0; j <= s2.length; j++) arr[j][0] = j;
    
    for (let j = 1; j <= s2.length; j++) {
        for (let i = 1; i <= s1.length; i++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            arr[j][i] = Math.min(
                arr[j - 1][i] + 1,
                arr[j][i - 1] + 1,
                arr[j - 1][i - 1] + cost
            );
        }
    }
    const dist = arr[s2.length][s1.length];
    const maxLen = Math.max(s1.length, s2.length);
    return (maxLen - dist) / maxLen;
}

module.exports = (client) => {

    console.log("[Aeroz Security V3] Protection anti-spam et logs prête.");

    const LOGS_CHAN = "1522354627633217597";
    const CEO_ROLE = "1501625944148934758";

    const sendAlert = async (guild, channel, user, reason) => {
        const logChan = await guild.channels.fetch(LOGS_CHAN).catch(() => null);
        if (!logChan) return;

        const alertEmbed = new EmbedBuilder()
            .setColor("Red")
            .setTitle("🚨 ALERTE SPAM / RAID DÉTECTÉ 🚨")
            .setDescription(`Le salon ${channel} a été automatiquement bloqué.\n\n**Auteur :** ${user} (\`${user.id}\`)\n**Motif :** ${reason}\n\nActions requises ci-dessous.`);

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

        logChan.send({
            content: `<@&${CEO_ROLE}>`,
            embeds: [alertEmbed],
            components: [row]
        }).catch(() => {});
    };

    // Filtres anti-spam
    const isBadMessage = async (msg) => {
        // Retours à la ligne
        const lines = (msg.content.match(/\n/g) || []).length;
        if (lines > MAX_LINES) {
            await msg.delete().catch(() => {});
            msg.channel.send(`⚠️ ${msg.author}, merci d'éviter les sauts de ligne abusifs.`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
            return true;
        }

        // Caractères bizarres / cachés
        const badChars = /[\u0300-\u036f\u1dc0-\u1de6\u20d0-\u20f0\u200b-\u200d\u200e\u200f\ufeff]/g;
        if (badChars.test(msg.content)) {
            await msg.delete().catch(() => {});
            msg.channel.send(`⚠️ ${msg.author}, les caractères invisibles ou Zalgo sont interdits.`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
            return true;
        }

        // Majuscules
        if (msg.content.length > 15) {
            const caps = msg.content.replace(/[^A-Z]/g, "").length;
            const total = msg.content.replace(/[^a-zA-Z]/g, "").length;
            if (total > 0 && (caps / total) > MAX_CAPS_RATIO) {
                await msg.delete().catch(() => {});
                msg.channel.send(`⚠️ ${msg.author}, évite d'écrire en majuscules.`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
                return true;
            }
        }

        // Trop d'emojis
        const emojis = /<(a)?:[a-zA-Z0-9_]+:[0-9]+>|[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
        const emojiCount = (msg.content.match(emojis) || []).length;
        if (emojiCount > MAX_EMOJIS) {
            await msg.delete().catch(() => {});
            msg.channel.send(`⚠️ ${msg.author}, trop d'émojis dans ton message.`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
            return true;
        }

        // Spoilers
        const spoilers = (msg.content.match(/\|\|/g) || []).length / 2;
        if (spoilers > MAX_SPOILERS) {
            await msg.delete().catch(() => {});
            msg.channel.send(`⚠️ ${msg.author}, merci de ne pas abuser des spoilers.`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
            return true;
        }

        return false;
    };

    // --- EVENEMENT MESSAGE ---
    client.on("messageCreate", async (msg) => {
        if (!msg.guild) return;
        if (msg.channel.id === CONF_CHAN_ID) return;

        if (msg.content === "!emergency-off") {
            if (!msg.member.permissions.has(PermissionsBitField.Flags.Administrator) && !msg.member.roles.cache.has(CEO_ROLE)) return;
            crisisDb.globalLockdown = false;
            crisisDb.lockedChannels = [];
            blockedChans.clear();
            saveCrisisDb();
            return msg.reply("🔓 Le confinement global et les verrous locaux ont été désactivés.");
        }

        const now = Date.now();
        const userId = msg.author.id;

        if (crisisDb.globalLockdown || blockedChans.has(msg.channel.id)) {
            if (msg.author.bot || msg.member.permissions.has(PermissionsBitField.Flags.Administrator) || msg.member.roles.cache.has(CEO_ROLE)) return;
            await msg.delete().catch(() => {});
            return;
        }

        // Webhook check
        if (msg.webhookId) {
            if (!whTracker.has(msg.webhookId)) whTracker.set(msg.webhookId, []);
            const whTimes = whTracker.get(msg.webhookId);
            const whFiltered = whTimes.filter(t => now - t < 5000);
            whFiltered.push(now);
            whTracker.set(msg.webhookId, whFiltered);

            if (whFiltered.length >= 4) {
                const wh = await msg.guild.fetchWebhooks().then(w => w.get(msg.webhookId)).catch(() => null);
                if (wh) await wh.delete("Anti-Raid Webhook").catch(() => {});
                await msg.channel.bulkDelete(20).catch(() => {});
            }
            return;
        }

        if (msg.author.bot) return;

        const member = msg.member;
        if (!member || member.permissions.has(PermissionsBitField.Flags.Administrator) || member.roles.cache.has(CEO_ROLE)) return;

        const broken = await isBadMessage(msg);
        if (broken) return;

        // Mentions abusives
        const totalMentions = msg.mentions.users.size + msg.mentions.roles.size;
        if (totalMentions > MAX_MENTIONS || msg.content.includes("@everyone") || msg.content.includes("@here")) {
            await msg.delete().catch(() => {});
            return await member.timeout(3600000, "Mass-Mentions détectées").catch(() => {});
        }

        // Copier-coller inter-salons
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

        // Analyse vitesse envoi
        if (!msgTracker.has(userId)) msgTracker.set(userId, []);
        const times = msgTracker.get(userId);
        const filtered = times.filter(t => now - t < MSG_INTERVAL);
        filtered.push(now);
        msgTracker.set(userId, filtered);

        if (filtered.length >= MSG_LIMIT) {
            let warns = warnTracker.get(userId) || 0;
            warns++;
            warnTracker.set(userId, warns);

            if (warns === 1) {
                await msg.channel.bulkDelete(6).catch(() => {});
                return msg.channel.send(`⚠️ ${msg.author}, ralentis ton rythme d'envoi s'il te plaît.`).then(m => setTimeout(() => m.delete().catch(() => {}), 4000));
            }
            if (warns === 2) {
                await msg.channel.bulkDelete(10).catch(() => {});
                await member.timeout(900000, "Spam continu (Niv 2)").catch(() => {});
                return msg.channel.send(`🔒 ${msg.author} a été mute 15 minutes pour spam.`);
            }
            if (warns === 3) {
                await msg.channel.bulkDelete(12).catch(() => {});
                await member.timeout(1800000, "Spam continu (Niv 3)").catch(() => {});
                return msg.channel.send(`🔒 ${msg.author} a été mute 30 minutes pour récidive.`);
            }
            if (warns >= 4) {
                warnTracker.set(userId, 0); 
                await msg.channel.bulkDelete(40).catch(() => {});
                await member.timeout(86400000, "Spam extrême (24h)").catch(() => {});
                
                blockedChans.add(msg.channel.id);
                crisisDb.lockedChannels = Array.from(blockedChans);
                saveCrisisDb();

                msg.channel.send(`🚨 **Salon fermé temporairement.** Trop de spams détectés.`);
                await sendAlert(msg.guild, msg.channel, msg.author, "Spam intensif et continu");
            }
        }
    });

    // --- EVENEMENT EDIT SPAM ---
    client.on("messageUpdate", async (oldMsg, newMsg) => {
        if (!newMsg.guild || newMsg.author.bot) return;
        if (newMsg.channel.id === CONF_CHAN_ID) return;

        const member = newMsg.member;
        if (!member || member.permissions.has(PermissionsBitField.Flags.Administrator) || member.roles.cache.has(CEO_ROLE)) return;
        if (oldMsg.content === newMsg.content) return;

        const now = Date.now();
        const userId = newMsg.author.id;

        if (!editTracker.has(userId)) editTracker.set(userId, []);
        const editTimes = editTracker.get(userId);
        const filteredEdits = editTimes.filter(t => now - t < 4000);
        filteredEdits.push(now);
        editTracker.set(userId, filteredEdits);

        if (filteredEdits.length >= 3) {
            editTracker.set(userId, []);
            await newMsg.delete().catch(() => {});
            await member.timeout(1200000, "Spam par modification").catch(() => {});
            return newMsg.channel.send(`🔒 ${newMsg.author} a été mute 20 minutes pour spam de modifs.`);
        }

        await isBadMessage(newMsg);
    });

    // --- EVENEMENT GHOST PING ---
    client.on("messageDelete", async (msg) => {
        if (!msg.guild || msg.author.bot) return;
        if (msg.channel.id === CONF_CHAN_ID) return;

        const now = Date.now();
        const life = now - msg.createdTimestamp;

        const mentions = msg.mentions.users.size > 0 || msg.mentions.roles.size > 0 || msg.content.includes("@everyone") || msg.content.includes("@here");
        
        if (mentions && life < 5000) {
            const member = msg.member;
            if (member && !member.permissions.has(PermissionsBitField.Flags.Administrator) && !member.roles.cache.has(CEO_ROLE)) {
                
                msg.channel.send(`👻 **Ghost Ping !** ${msg.author} a supprimé un message contenant des mentions trop rapidement.`).then(m => setTimeout(() => m.delete().catch(() => {}), 6000));
                
                const logChan = await msg.guild.channels.fetch(LOGS_CHAN).catch(() => null);
                if (logChan) {
                    const ghostEmbed = new EmbedBuilder()
                        .setColor("Yellow")
                        .setTitle("👻 ALERTE GHOST PING")
                        .setDescription(`**Auteur :** ${msg.author} (\`${msg.author.id}\`)\n**Salon :** ${msg.channel}\n**Message supprimé :**\n\`\`\`${msg.content || "[Aucun texte]"}\`\`\``);
                    logChan.send({ embeds: [ghostEmbed] }).catch(() => {});
                }
            }
        }
    });

    // --- EVENEMENT REACTION SPAM ---
    client.on("messageReactionAdd", async (reaction, user) => {
        if (user.bot) return;
        const guild = reaction.message.guild;
        if (!guild) return;
        if (reaction.message.channel.id === CONF_CHAN_ID) return;

        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member || member.permissions.has(PermissionsBitField.Flags.Administrator) || member.roles.cache.has(CEO_ROLE)) return;

        const now = Date.now();
        const userId = user.id;

        if (!reactTracker.has(userId)) reactTracker.set(userId, []);
        const reactTimes = reactTracker.get(userId);
        const filteredReacts = reactTimes.filter(t => now - t < REACT_INTERVAL);
        filteredReacts.push(now);
        reactTracker.set(userId, filteredReacts);

        if (filteredReacts.length >= REACT_LIMIT) {
            reactTracker.set(userId, []);
            reaction.message.reactions.cache.forEach(r => r.users.remove(user.id).catch(() => {}));
            await member.timeout(600000, "Spam de réactions").catch(() => {});
            reaction.message.channel.send(`⚠️ ${user} a été mute 10 minutes (Spam émojis/réactions).`).then(m => setTimeout(() => m.delete().catch(() => {}), 4000));
        }
    });

    // --- BOUTONS INTERACTIFS ---
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("sec_unlock_") && interaction.customId !== "sec_global_lock") return;

        const allowed = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) || interaction.member.roles.cache.has(CEO_ROLE);
        if (!allowed) return interaction.reply({ content: "❌ Droits CEO manquants.", ephemeral: true });

        if (interaction.customId.startsWith("sec_unlock_")) {
            const chanId = interaction.customId.replace("sec_unlock_", "");
            blockedChans.delete(chanId);
            crisisDb.lockedChannels = Array.from(blockedChans);
            saveCrisisDb();

            const updEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setColor("Green")
                .setTitle("🔓 SALON DÉVERROUILLÉ")
                .setDescription(`Le salon <#${chanId}> a été réouvert par ${interaction.user}.`);

            await interaction.update({ embeds: [updEmbed], components: [] }).catch(() => {});
            const targetChan = await interaction.guild.channels.fetch(chanId).catch(() => null);
            if (targetChan) targetChan.send("🔓 **Le salon est de nouveau ouvert aux discussions.**");
        }

        if (interaction.customId === "sec_global_lock") {
            crisisDb.globalLockdown = true;
            saveCrisisDb();

            const updEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setColor("DarkRed")
                .setTitle("🛑 LOCKDOWN GENERAL APPLIQUÉ")
                .setDescription(`Le serveur a été verrouillé complètement par ${interaction.user}.`);

            await interaction.update({ embeds: [updEmbed], components: [] }).catch(() => {});
        }
    });
};
