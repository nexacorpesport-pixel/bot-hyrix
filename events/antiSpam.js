const {
    PermissionsBitField,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

// =====================================================
// ⚙️ PARAMÈTRES DE SÉCURITÉ AVANCÉS
// =====================================================
const MESSAGE_LIMIT = 5;
const MESSAGE_INTERVAL = 6 * 1000; 
const MAX_MENTIONS_LIMIT = 4;       
const MAX_NEWLINES = 4;          // Max 4 retours à la ligne par message (Anti-sauts de ligne)
const MAX_CAPS_PERCENTAGE = 0.75; // Max 75% de majuscules sur les messages de plus de 15 caractères

// Stockages temporaires en mémoire (RAM)
const userMessages = new Map();
const userWarnings = new Map();
const webhookTracker = new Map();
const lastMessages = new Map();

// Variables de contrôle d'état de crise
let GLOBAL_LOCKDOWN = false; 
const LOCKED_CHANNELS = new Set(); 

// =====================================================
// 🧠 FONCTION EN CAPAL (Distance de Levenshtein)
// Détecte le spam intelligent (ex: "Slt 1", "Slt 2", "Slt 3")
// =====================================================
function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
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

    console.log("[🛡️ EXTREME SECURITY] Le bouclier ultime anti-applications externes est opérationnel.");

    const LOGS_CHANNEL_ID = "1510250586703003708";
    const CEO_ROLE_ID = "1505330692106485781";

    // Alerte centrale et panneau de contrôle interactif pour le CEO
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

    // =====================================================
    // 🎤 INTERCEPTION DES SALONS VOCAUX (CRISE)
    // =====================================================
    client.on("voiceStateUpdate", async (oldState, newState) => {
        if (!GLOBAL_LOCKDOWN) return;

        if (newState.channelId && !newState.member.user.bot) {
            if (newState.member.permissions.has(PermissionsBitField.Flags.Administrator) || newState.member.roles.cache.has(CEO_ROLE_ID)) return;

            await newState.disconnect("SÉCURITÉ : Lockdown Global Actif").catch(() => {});
            await newState.member.send("🔒 **Pyxar Sécurité :** L'accès aux salons vocaux est figé pour des raisons de sécurité.").catch(() => {});
        }
    });

    // =====================================================
    // 📨 FILTRAGE ET ANALYSE PHÉNOMÉNALE DU CHAT
    // =====================================================
    client.on("messageCreate", async (message) => {
        if (!message.guild) return;

        // Commande d'urgence d'extinction du mode panique
        if (message.content === "!emergency-off") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && !message.member.roles.cache.has(CEO_ROLE_ID)) return;
            GLOBAL_LOCKDOWN = false;
            LOCKED_CHANNELS.clear();
            return message.reply("🔓 **Forteresse réinitialisée.** Le Lockdown global et les blocages locaux sont levés.");
        }

        const now = Date.now();
        const userId = message.author.id;

        // 1. BLOCAGE SI LE LOCKDOWN GLOBAL EST ACTIF
        if (GLOBAL_LOCKDOWN) {
            if (message.author.bot || message.member.permissions.has(PermissionsBitField.Flags.Administrator) || message.member.roles.cache.has(CEO_ROLE_ID)) return;
            await message.delete().catch(() => {});
            return;
        }

        // 2. BLOCAGE SI LE SALON PRÉCIS EST VERROUILLÉ
        if (LOCKED_CHANNELS.has(message.channel.id)) {
            if (message.author.bot || message.member.permissions.has(PermissionsBitField.Flags.Administrator) || message.member.roles.cache.has(CEO_ROLE_ID)) return;
            await message.delete().catch(() => {});
            return message.channel.send(`⚠️ ${message.author}, les envois sont restreints ici pour le moment.`)
                .then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
        }

        // 3. SÉCURITÉ WEBHOOK (Anti-injection d'applications de raid)
        if (message.webhookId) {
            if (!webhookTracker.has(message.webhookId)) webhookTracker.set(message.webhookId, []);
            const whTimestamps = webhookTracker.get(message.webhookId);
            const whFiltered = whTimestamps.filter(t => now - t < 5000);
            whFiltered.push(now);
            webhookTracker.set(message.webhookId, whFiltered);

            if (whFiltered.length >= 4) {
                await message.channel.bulkDelete(20).catch(() => {});
                const webhook = await message.guild.fetchWebhooks().then(whs => whs.get(message.webhookId)).catch(() => null);
                if (webhook) await webhook.delete("Anti-Raid Webhook Dynamique").catch(() => {});
            }
            return;
        }

        if (message.author.bot) return;

        const member = message.member;
        if (!member || member.permissions.has(PermissionsBitField.Flags.Administrator) || member.roles.cache.has(CEO_ROLE_ID)) return;

        // --------------------------------=====================
        // 🔬 FILTRES EXTRÊMES DE CONTENU DE MESSAGE (ANTI-SELFBOTS)
        // --------------------------------=====================

        // A. ANTI-SAUTS DE LIGNE (Flood visuel vertical)
        const newlineCount = (message.content.match(/\n/g) || []).length;
        if (newlineCount > MAX_NEWLINES) {
            await message.delete().catch(() => {});
            return message.channel.send(`⚠️ ${message.author}, les messages contenant trop de sauts de ligne sont interdits.`)
                .then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
        }

        // B. ANTI-ZALGO & CARACTÈRES Unicode Invisibles/Corrompus
        const zalgoRegex = /[\u0300-\u036f\u1dc0-\u1de6\u20d0-\u20f0]/g;
        if (zalgoRegex.test(message.content)) {
            await message.delete().catch(() => {});
            return message.channel.send(`⚠️ ${message.author}, les caractères spéciaux ou corrompus sont interdits.`)
                .then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
        }

        // C. ANTI-CAPS LOCK (Agressivité textuelle)
        if (message.content.length > 15) {
            const capsCount = message.content.replace(/[^A-Z]/g, "").length;
            const totalLetters = message.content.replace(/[^a-zA-Z]/g, "").length;
            if (totalLetters > 0 && (capsCount / totalLetters) > MAX_CAPS_PERCENTAGE) {
                await message.delete().catch(() => {});
                return message.channel.send(`⚠️ ${message.author}, merci de ne pas écrire entièrement en majuscules.`)
                    .then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
            }
        }

        // D. ANTI MASS-MENTIONS
        const totalMentions = message.mentions.users.size + message.mentions.roles.size;
        if (totalMentions > MAX_MENTIONS_LIMIT || message.content.includes("@everyone") || message.content.includes("@here")) {
            await message.delete().catch(() => {});
            return await member.timeout(60 * 60 * 1000, "Mass-Mention / Selfbot Detection").catch(() => {});
        }

        // E. ANTI COPIER-COLLER INTER-SALONS ET ALGORITHME DE SIMILARITÉ (Anti-Spam Intelligent)
        const userLastMsg = lastMessages.get(userId);
        if (userLastMsg) {
            const isIdentical = userLastMsg.content === message.content;
            const similarityScore = calculateSimilarity(userLastMsg.content, message.content);

            // Si le message est identique ou ressemble à plus de 82% à son message précédent dans un autre salon
            if ((isIdentical || similarityScore > 0.82) && (now - userLastMsg.time < 12000) && userLastMsg.channel !== message.channel.id) {
                await message.delete().catch(() => {});
                return;
            }
        }
        lastMessages.set(userId, { content: message.content, time: now, channel: message.channel.id });

        // =====================================================
        // 📈 ANALYSE DU RYTHME ET SANCTIONS GRADUELLES
        // =====================================================
        if (!userMessages.has(userId)) userMessages.set(userId, []);
        const timestamps = userMessages.get(userId);
        const filtered = timestamps.filter(t => now - t < MESSAGE_INTERVAL);
        filtered.push(now);
        userMessages.set(userId, filtered);

        if (filtered.length >= MESSAGE_LIMIT) {
            let warns = userWarnings.get(userId) || 0;
            warns++;
            userWarnings.set(userId, warns);

            // Étape 1 : Avertissement
            if (warns === 1) {
                await message.channel.bulkDelete(6).catch(() => {});
                return message.channel.send(`⚠️ ${message.author}, attention à ton rythme d'envoi. Ne spamme pas.`)
                    .then(m => setTimeout(() => m.delete().catch(() => {}), 4000));
            }

            // Étape 2 : Mute 15 Minutes
            if (warns === 2) {
                await message.channel.bulkDelete(10).catch(() => {});
                await member.timeout(15 * 60 * 1000, "Spam Récidive Niv. 2").catch(() => {});
                return message.channel.send(`🔒 ${message.author} a été réduit au silence pendant **15 minutes**.`);
            }

            // Étape 3 : Mute 30 Minutes
            if (warns === 3) {
                await message.channel.bulkDelete(12).catch(() => {});
                await member.timeout(30 * 60 * 1000, "Spam Récidive Niv. 3").catch(() => {});
                return message.channel.send(`🔒 ${message.author} a été réduit au silence pendant **30 minutes**.`);
            }

            // Étape 4 : Mute 24 Heures + LOCKOUT DU SALON + ALERTE PANNEAU CEO
            if (warns >= 4) {
                userWarnings.set(userId, 0); 
                
                // Purge flash rétroactive des 40 derniers messages pour effacer les traces de l'attaque
                await message.channel.bulkDelete(40).catch(() => {});
                await member.timeout(24 * 60 * 60 * 1000, "Attaque par automate / Raid massif (24h)").catch(() => {});
                
                LOCKED_CHANNELS.add(message.channel.id);
                message.channel.send(`🚨 **Salon Temporairement Sécurisé.** Une tentative d'inondation de chat a été stoppée.`);

                await triggerStaffAlert(message.guild, message.channel, message.author, "Surcharge algorithmique (Spam Continu)");
            }
        }
    });

    // =====================================================
    // 🎛️ COLLECTEUR INTERACTIF COMPORTEMENTAL EXCLUSIF CEO
    // =====================================================
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;

        // 🔥 LA CORRECTION EST ICI : Si le bouton cliqué n'appartient pas au panneau de crise, on ignore complètement
        if (!interaction.customId.startsWith("sec_unlock_") && interaction.customId !== "sec_global_lock") return;

        const hasAccess = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) || interaction.member.roles.cache.has(CEO_ROLE_ID);
        
        if (!hasAccess) {
            return interaction.reply({ content: "❌ Seul le rôle **CEO** possède les codes d'accès pour ce panneau de crise.", ephemeral: true });
        }

        // Déverrouillage d'un salon précis
        if (interaction.customId.startsWith("sec_unlock_")) {
            const targetChannelId = interaction.customId.replace("sec_unlock_", "");
            LOCKED_CHANNELS.delete(targetChannelId);

            const updateEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setColor("Green")
                .setTitle("🔓 SALON DE CHAT RÉACTIVÉ")
                .setDescription(`Le salon <#${targetChannelId}> a été validé et déverrouillé par le CEO : ${interaction.user}.`);

            await interaction.update({ embeds: [updateEmbed], components: [] }).catch(() => {});
            
            const targetChannel = await interaction.guild.channels.fetch(targetChannelId).catch(() => null);
            if (targetChannel) {
                targetChannel.send("🔓 **Le salon de discussion est de nouveau disponible.**");
            }
        }

        // Activation instantanée du mode Lockdown Global sur l'infrastructure du bot
        if (interaction.customId === "sec_global_lock") {
            GLOBAL_LOCKDOWN = true;

            const updateEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setColor("DarkRed")
                .setTitle("🛑 ÉTAT D'URGANCE : LOCKDOWN APPLIQUÉ")
                .setDescription(`⚠️ **Le CEO ${interaction.user} a activé l'isolement complet du serveur.**\nTous les chats non-staff et connexions vocales sont gelés électroniquement.`);

            await interaction.update({ embeds: [updateEmbed], components: [] }).catch(() => {});
        }
    });
};
