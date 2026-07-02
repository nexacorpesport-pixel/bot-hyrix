const {
    PermissionsBitField,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");
const fs = require("fs");
const path = require("path");

// =====================================================
// ⚙️ PARAMÈTRES DE SÉCURITÉ ULTRA-AVANCÉS
// =====================================================
const MESSAGE_LIMIT = 5;
const MESSAGE_INTERVAL = 6 * 1000; 
const MAX_MENTIONS_LIMIT = 4;       
const MAX_NEWLINES = 4;           // Max 4 retours à la ligne (Anti-sauts de ligne)
const MAX_CAPS_PERCENTAGE = 0.75; // Max 75% de majuscules sur plus de 15 caractères
const REACTION_LIMIT = 5;         // Max 5 réactions en 3 secondes
const REACTION_INTERVAL = 3000;
const MAX_EMOJIS_PER_MSG = 8;     // Max 8 émojis par message (Anti-Emoji Flood)
const MAX_SPOILERS_PER_MSG = 6;   // Max 6 blocs de spoilers (||) par message

// Chemin pour la persistance locale de l'état de crise (Lockdown)
const STATE_DB_PATH = path.join(__dirname, "lockdown_state_db.json");

let crisisDatabase = { globalLockdown: false, lockedChannels: [] };
if (fs.existsSync(STATE_DB_PATH)) {
    try {
        crisisDatabase = JSON.parse(fs.readFileSync(STATE_DB_PATH, "utf-8"));
    } catch (e) {
        console.error("[🛡️ SECURITY] Erreur de lecture de l'état de crise, réinitialisation...");
    }
}

const saveCrisisDatabase = () => {
    try {
        fs.writeFileSync(STATE_DB_PATH, JSON.stringify(crisisDatabase, null, 2), "utf-8");
    } catch (e) {
        console.error("[🛡️ SECURITY] Erreur d'écriture de l'état de crise.");
    }
};

// Stockages temporaires en mémoire (RAM)
const userMessages = new Map();
const userWarnings = new Map();
const webhookTracker = new Map();
const lastMessages = new Map();
const userReactions = new Map();
const userEditsTracker = new Map(); // Tracker pour le spam de modifications

const LOCKED_CHANNELS = new Set(crisisDatabase.lockedChannels); 

// =====================================================
// 🧠 FONCTION EN CAPAL (Distance de Levenshtein Optimisée)
// =====================================================
function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    if (Math.abs(str1.length - str2.length) > 10) return 0;

    const track = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    for (let i = 0; i <= str1.length; i += 1) track[0][i] = i;
    for (let j = 0; j <= str2.length; j += 1) track[j][0] = j;
    for (let j = 1; j <= str2.length; j += 1) {
        for (let i = 1; i <= str1.length; i += 1) {
            const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
            track[j][i] = Math.min(
                track[j - 1][i] + 1,
                track[j][i - 1] + 1,
                track[j - 1][i - 1] + indicator
            );
        }
    }
    const distance = track[str2.length][str1.length];
    const maxLength = Math.max(str1.length, str2.length);
    return (maxLength - distance) / maxLength;
}

module.exports = (client) => {

    console.log("[🛡️ ULTRA SECURITY V3] Forteresse anti-spam globale et d'analyse comportementale armée.");

    const LOGS_CHANNEL_ID = 1522354627633217597";
    const CEO_ROLE_ID = "1501625944148934758";

    const triggerStaffAlert = async (guild, violatedChannel, offender, reasonText) => {
        const logChannel = await guild.channels.fetch(LOGS_CHANNEL_ID).catch(() => null);
        if (!logChannel) return;

        const alertEmbed = new EmbedBuilder()
            .setColor("Red")
            .setTitle("🚨 CRITICAL ALERT : TENTATIVE DE RAID / SPAM EXTRÊME 🚨")
            .setDescription(`Le salon ${violatedChannel} a été **VERROUILLÉ AUTOMATIQUEMENT**.\n\n**Cible neutralisée :** ${offender} (\`${offender.id}\`)\n**Détecté pour :** ${reasonText}\n\n🛡️ **Contrôle réservé au CEO :** Veuillez agir via les boutons ci-dessous.`)
            .setTimestamp();

        const btnUnlock = new ButtonBuilder()
            .setCustomId(`sec_unlock_${violatedChannel.id}`)
            .setLabel("Déverrouiller le salon")
            .setStyle(ButtonStyle.Success)
            .setEmoji("🔓");

        const btnLockup = new ButtonBuilder()
            .setCustomId("sec_global_lock")
            .setLabel("Activer le Lockdown Global")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("🛑");

        const row = new ActionRowBuilder().addComponents(btnUnlock, btnLockup);

        logChannel.send({
            content: `<@&${CEO_ROLE_ID}>`,
            embeds: [alertEmbed],
            components: [row]
        }).catch(() => {});
    };

    // Fonctions réutilisables d'analyse de contenu textuel (Anti-Spam)
    const checkMessageContentRules = async (message) => {
        // A. ANTI-SAUTS DE LIGNE
        const newlineCount = (message.content.match(/\n/g) || []).length;
        if (newlineCount > MAX_NEWLINES) {
            await message.delete().catch(() => {});
            message.channel.send(`⚠️ ${message.author}, les messages contenant trop de sauts de ligne sont interdits.`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
            return true;
        }

        // B. ANTI-ZALGO & CARACTÈRES UNICODE INVISIBLES
        const zalgoAndInvisibleRegex = /[\u0300-\u036f\u1dc0-\u1de6\u20d0-\u20f0\u200b-\u200d\u200e\u200f\ufeff]/g;
        if (zalgoAndInvisibleRegex.test(message.content)) {
            await message.delete().catch(() => {});
            message.channel.send(`⚠️ ${message.author}, les caractères spéciaux, invisibles ou corrompus sont interdits.`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
            return true;
        }

        // C. ANTI-CAPS LOCK
        if (message.content.length > 15) {
            const capsCount = message.content.replace(/[^A-Z]/g, "").length;
            const totalLetters = message.content.replace(/[^a-zA-Z]/g, "").length;
            if (totalLetters > 0 && (capsCount / totalLetters) > MAX_CAPS_PERCENTAGE) {
                await message.delete().catch(() => {});
                message.channel.send(`⚠️ ${message.author}, merci de ne pas écrire entièrement en majuscules.`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
                return true;
            }
        }

        // D. ANTI-EMOJI FLOOD
        const emojiRegex = /<(a)?:[a-zA-Z0-9_]+:[0-9]+>|[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
        const emojiCount = (message.content.match(emojiRegex) || []).length;
        if (emojiCount > MAX_EMOJIS_PER_MSG) {
            await message.delete().catch(() => {});
            message.channel.send(`⚠️ ${message.author}, l'accumulation massive d'émojis dans un seul message est interdite.`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
            return true;
        }

        // E. ANTI-SPOILER FLOOD / BLOCS GÉANTS
        const spoilerCount = (message.content.match(/\|\|/g) || []).length / 2;
        if (spoilerCount > MAX_SPOILERS_PER_MSG) {
            await message.delete().catch(() => {});
            message.channel.send(`⚠️ ${message.author}, le spam de blocs masqués (spoilers) est interdit.`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
            return true;
        }

        return false;
    };

    // =====================================================
    // 📨 FILTRAGE ET ANALYSE PHÉNOMÉNALE DU CHAT (CREATION)
    // =====================================================
    client.on("messageCreate", async (message) => {
        if (!message.guild) return;

        if (message.content === "!emergency-off") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && !message.member.roles.cache.has(CEO_ROLE_ID)) return;
            crisisDatabase.globalLockdown = false;
            crisisDatabase.lockedChannels = [];
            LOCKED_CHANNELS.clear();
            saveCrisisDatabase();
            return message.reply("🔓 **Forteresse réinitialisée.** Le Lockdown global et les blocages locaux sont levés.");
        }

        const now = Date.now();
        const userId = message.author.id;

        if (crisisDatabase.globalLockdown || LOCKED_CHANNELS.has(message.channel.id)) {
            if (message.author.bot || message.member.permissions.has(PermissionsBitField.Flags.Administrator) || message.member.roles.cache.has(CEO_ROLE_ID)) return;
            await message.delete().catch(() => {});
            return;
        }

        // SÉCURITÉ WEBHOOK PRIORITY-ONE
        if (message.webhookId) {
            if (!webhookTracker.has(message.webhookId)) webhookTracker.set(message.webhookId, []);
            const whTimestamps = webhookTracker.get(message.webhookId);
            const whFiltered = whTimestamps.filter(t => now - t < 5000);
            whFiltered.push(now);
            webhookTracker.set(message.webhookId, whFiltered);

            if (whFiltered.length >= 4) {
                const webhook = await message.guild.fetchWebhooks().then(whs => whs.get(message.webhookId)).catch(() => null);
                if (webhook) await webhook.delete("Anti-Raid Webhook Dynamique").catch(() => {});
                await message.channel.bulkDelete(20).catch(() => {});
            }
            return;
        }

        if (message.author.bot) return;

        const member = message.member;
        if (!member || member.permissions.has(PermissionsBitField.Flags.Administrator) || member.roles.cache.has(CEO_ROLE_ID)) return;

        // Application des filtres de structure textuelle
        const ruleViolated = await checkMessageContentRules(message);
        if (ruleViolated) return;

        // ANTI MASS-MENTIONS
        const totalMentions = message.mentions.users.size + message.mentions.roles.size;
        if (totalMentions > MAX_MENTIONS_LIMIT || message.content.includes("@everyone") || message.content.includes("@here")) {
            await message.delete().catch(() => {});
            return await member.timeout(60 * 60 * 1000, "Mass-Mention / Selfbot Detection").catch(() => {});
        }

        // ANTI COPIER-COLLER INTER-SALONS ET ALGORITHME DE SIMILARITÉ
        const userLastMsg = lastMessages.get(userId);
        if (userLastMsg) {
            const isIdentical = userLastMsg.content === message.content;
            const similarityScore = calculateSimilarity(userLastMsg.content, message.content);

            if ((isIdentical || similarityScore > 0.82) && (now - userLastMsg.time < 12000) && userLastMsg.channel !== message.channel.id) {
                await message.delete().catch(() => {});
                return;
            }
        }
        lastMessages.set(userId, { content: message.content, time: now, channel: message.channel.id });
        setTimeout(() => { if (lastMessages.get(userId)?.time === now) lastMessages.delete(userId); }, 10 * 60 * 1000);

        // ANALYSE DU RYTHME ET SANCTIONS GRADUELLES
        if (!userMessages.has(userId)) userMessages.set(userId, []);
        const timestamps = userMessages.get(userId);
        const filtered = timestamps.filter(t => now - t < MESSAGE_INTERVAL);
        filtered.push(now);
        userMessages.set(userId, filtered);

        if (filtered.length >= MESSAGE_LIMIT) {
            let warns = userWarnings.get(userId) || 0;
            warns++;
            userWarnings.set(userId, warns);

            if (warns === 1) {
                await message.channel.bulkDelete(6).catch(() => {});
                return message.channel.send(`⚠️ ${message.author}, attention à ton rythme d'envoi. Ne spamme pas.`).then(m => setTimeout(() => m.delete().catch(() => {}), 4000));
            }
            if (warns === 2) {
                await message.channel.bulkDelete(10).catch(() => {});
                await member.timeout(15 * 60 * 1000, "Spam Récidive Niv. 2").catch(() => {});
                return message.channel.send(`🔒 ${message.author} a été réduit au silence pendant **15 minutes**.`);
            }
            if (warns === 3) {
                await message.channel.bulkDelete(12).catch(() => {});
                await member.timeout(30 * 60 * 1000, "Spam Récidive Niv. 3").catch(() => {});
                return message.channel.send(`🔒 ${message.author} a été réduit au silence pendant **30 minutes**.`);
            }
            if (warns >= 4) {
                userWarnings.set(userId, 0); 
                await message.channel.bulkDelete(40).catch(() => {});
                await member.timeout(24 * 60 * 60 * 1000, "Attaque par automate / Raid massif (24h)").catch(() => {});
                
                LOCKED_CHANNELS.add(message.channel.id);
                crisisDatabase.lockedChannels = Array.from(LOCKED_CHANNELS);
                saveCrisisDatabase();

                message.channel.send(`🚨 **Salon Temporairement Sécurisé.** Une tentative d'inondation de chat a été stoppée.`);
                await triggerStaffAlert(message.guild, message.channel, message.author, "Surcharge algorithmique (Spam Continu)");
            }
        }
    });

    // =====================================================
    // 🔄 INTERCEPTION DU SPAM PAR MODIFICATION (EDIT SPAM)
    // =====================================================
    client.on("messageUpdate", async (oldMessage, newMessage) => {
        if (!newMessage.guild || newMessage.author.bot) return;

        const member = newMessage.member;
        if (!member || member.permissions.has(PermissionsBitField.Flags.Administrator) || member.roles.cache.has(CEO_ROLE_ID)) return;

        // Si le contenu n'a pas changé (ex: ajout d'embed/lien d'intégration), on ignore
        if (oldMessage.content === newMessage.content) return;

        const now = Date.now();
        const userId = newMessage.author.id;

        // Analyse de la vitesse de modification
        if (!userEditsTracker.has(userId)) userEditsTracker.set(userId, []);
        const editTimestamps = userEditsTracker.get(userId);
        const filteredEdits = editTimestamps.filter(t => now - t < 4000); // Fenêtre de 4 secondes
        filteredEdits.push(now);
        userEditsTracker.set(userId, filteredEdits);

        // Si l'utilisateur modifie son message plus de 3 fois en 4 secondes (Comportement automate)
        if (filteredEdits.length >= 3) {
            userEditsTracker.set(userId, []);
            await newMessage.delete().catch(() => {});
            await member.timeout(20 * 60 * 1000, "Spam par modification rapide (Automate)").catch(() => {});
            return newMessage.channel.send(`🔒 ${newMessage.author} a été muté 20 minutes pour tentative de spam par modification.`);
        }

        // On lui fait passer les mêmes tests de contenu qu'à la création
        await checkMessageContentRules(newMessage);
    });

    // =====================================================
    // 👻 INTERCEPTION DES PINGS FANTÔMES (GHOST PINGING)
    // =====================================================
    client.on("messageDelete", async (message) => {
        if (!message.guild || message.author.bot) return;

        const now = Date.now();
        const lifeTime = now - message.createdTimestamp;

        // Si le message contenait des pings et a été supprimé moins de 5 secondes après sa création
        const hasMentions = message.mentions.users.size > 0 || message.mentions.roles.size > 0 || message.content.includes("@everyone") || message.content.includes("@here");
        
        if (hasMentions && lifeTime < 5000) {
            const member = message.member;
            if (member && !member.permissions.has(PermissionsBitField.Flags.Administrator) && !member.roles.cache.has(CEO_ROLE_ID)) {
                
                // Sanction : Avertissement public immédiat + Log
                message.channel.send(`👻 **Ghost Ping Détecté !** ${message.author} a supprimé un message contenant des mentions en moins de 5 secondes.`).then(m => setTimeout(() => m.delete().catch(() => {}), 6000));
                
                const logChannel = await message.guild.channels.fetch(LOGS_CHANNEL_ID).catch(() => null);
                if (logChannel) {
                    const ghostEmbed = new EmbedBuilder()
                        .setColor("Yellow")
                        .setTitle("👻 ALERT : PING FANTÔME (GHOST PING)")
                        .setDescription(`**Auteur :** ${message.author} (\`${message.author.id}\`)\n**Salon :** ${message.channel}\n**Contenu supprimé :**\n\`\`\`${message.content || "[Aucun texte / Image]"}\`\`\``)
                        .setTimestamp();
                    logChannel.send({ embeds: [ghostEmbed] }).catch(() => {});
                }
            }
        }
    });

    // =====================================================
    // 🎭 DETECTION DU SPAM DE REACTIONS / EMOJIS
    // =====================================================
    client.on("messageReactionAdd", async (reaction, user) => {
        if (user.bot) return;
        const guild = reaction.message.guild;
        if (!guild) return;

        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member || member.permissions.has(PermissionsBitField.Flags.Administrator) || member.roles.cache.has(CEO_ROLE_ID)) return;

        const now = Date.now();
        const userId = user.id;

        if (!userReactions.has(userId)) userReactions.set(userId, []);
        const reactTimestamps = userReactions.get(userId);
        const filteredReacts = reactTimestamps.filter(t => now - t < REACTION_INTERVAL);
        filteredReacts.push(now);
        userReactions.set(userId, filteredReacts);

        if (filteredReacts.length >= REACTION_LIMIT) {
            userReactions.set(userId, []);
            await reaction.message.reactions.cache.forEach(r => r.users.remove(user.id).catch(() => {}));
            await member.timeout(10 * 60 * 1000, "Spam abusif de réactions/émojis").catch(() => {});
            reaction.message.channel.send(`⚠️ ${user} a été muté 10 minutes pour spam abusif de réactions.`).then(m => setTimeout(() => m.delete().catch(() => {}), 4000));
        }
    });

    // =====================================================
    // 🎛️ COLLECTEUR INTERACTIF PANNEAU CEO
    // =====================================================
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("sec_unlock_") && interaction.customId !== "sec_global_lock") return;

        const hasAccess = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) || interaction.member.roles.cache.has(CEO_ROLE_ID);
        if (!hasAccess) return interaction.reply({ content: "❌ Seul le rôle **CEO** possède les codes d'accès.", ephemeral: true });

        if (interaction.customId.startsWith("sec_unlock_")) {
            const targetChannelId = interaction.customId.replace("sec_unlock_", "");
            LOCKED_CHANNELS.delete(targetChannelId);
            crisisDatabase.lockedChannels = Array.from(LOCKED_CHANNELS);
            saveCrisisDatabase();

            const updateEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setColor("Green")
                .setTitle("🔓 SALON DE CHAT RÉACTIVÉ")
                .setDescription(`Le salon <#${targetChannelId}> a été déverrouillé par le CEO : ${interaction.user}.`);

            await interaction.update({ embeds: [updateEmbed], components: [] }).catch(() => {});
            const targetChannel = await interaction.guild.channels.fetch(targetChannelId).catch(() => null);
            if (targetChannel) targetChannel.send("🔓 **Le salon de discussion est de nouveau disponible.**");
        }

        if (interaction.customId === "sec_global_lock") {
            crisisDatabase.globalLockdown = true;
            saveCrisisDatabase();

            const updateEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setColor("DarkRed")
                .setTitle("🛑 ÉTAT D'URGENCE : LOCKDOWN APPLIQUÉ")
                .setDescription(`⚠️ **Le CEO ${interaction.user} a activé l'isolement complet du serveur.**\nTous les chats non-staff et connexions vocales sont gelés électroniquement.`);

            await interaction.update({ embeds: [updateEmbed], components: [] }).catch(() => {});
        }
    });
};
