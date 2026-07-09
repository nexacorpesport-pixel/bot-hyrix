const { AuditLogEvent, EmbedBuilder, ChannelType } = require("discord.js");

const LOGS = {
    general: "1523471656343961710",
    moderation: "1502757141369589830",
    antiraid: "1522354528626802728",
    members: "1521930283094638722",
    messages: "1502756924503097415",
    vocaux: "1502757392054747356",
    serveur: "1523471349513850931",
    bot: "1523471412566949908",
    permissions: "1522354480631517204",
    tickets: "1521923500439240968",
    tempvoc: "1521931122043256892",
    sanctions: "1502757141369589830"
};

module.exports = (client) => {

    async function sendLog(channelId, embed) {
        try {
            const channel = client.channels.cache.get(channelId);
            if (!channel) return;
            await channel.send({ embeds: [embed] });
        } catch (err) {
            console.error("❌ Erreur logs :", err);
        }
    }

    // --- ENTRÉES / SORTIES DES MEMBRES ---

    client.on("guildMemberAdd", async (member) => {
        const embed = new EmbedBuilder()
            .setColor("Green")
            .setTitle("✅ Membre rejoint")
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: "👤 Utilisateur", value: `${member.user.tag} (<@${member.id}>)`, inline: true },
                { name: "🆔 ID", value: member.id, inline: true },
                { name: "📅 Compte créé", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>` }
            )
            .setFooter({ text: "Aeroz Esports • Logs" })
            .setTimestamp();

        sendLog(LOGS.members, embed);
    });

    client.on("guildMemberRemove", async (member) => {
        const embed = new EmbedBuilder()
            .setColor("Red")
            .setTitle("❌ Membre parti")
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: "👤 Utilisateur", value: member.user.tag, inline: true },
                { name: "🆔 ID", value: member.id, inline: true }
            )
            .setFooter({ text: "Aeroz Esports • Logs" })
            .setTimestamp();

        sendLog(LOGS.members, embed);
    });

    // --- SUIVI DES MESSAGES (Gestion des Partials) ---

    client.on("messageDelete", async (message) => {
        if (!message.guild || message.author?.bot) return;

        // Si le message n'est pas dans le cache
        if (message.partial) {
            const embed = new EmbedBuilder()
                .setColor("Orange")
                .setTitle("🗑️ Message supprimé (Inconnu)")
                .setDescription(`Un message non mis en cache a été supprimé dans ${message.channel}.`)
                .setTimestamp();
            return sendLog(LOGS.messages, embed);
        }

        const embed = new EmbedBuilder()
            .setColor("Orange")
            .setTitle("🗑️ Message supprimé")
            .addFields(
                { name: "👤 Auteur", value: `${message.author.tag} (<@${message.author.id}>)`, inline: true },
                { name: "📍 Salon", value: `${message.channel}`, inline: true },
                { name: "💬 Contenu", value: message.content?.slice(0, 1024) || "*Aucun contenu textuel (Fichier/Embed)*" }
            )
            .setTimestamp();

        sendLog(LOGS.messages, embed);
    });

    client.on("messageUpdate", async (oldMessage, newMessage) => {
        if (!oldMessage.guild || oldMessage.author?.bot) return;
        if (oldMessage.partial) return; // Impossible de comparer si l'ancien n'est pas en cache
        if (oldMessage.content === newMessage.content) return;

        const embed = new EmbedBuilder()
            .setColor("Yellow")
            .setTitle("✏️ Message modifié")
            .addFields(
                { name: "👤 Auteur", value: `${oldMessage.author.tag} (<@${oldMessage.author.id}>)` },
                { name: "📍 Salon", value: `${oldMessage.channel}` },
                { name: "📜 Ancien", value: oldMessage.content?.slice(0, 1024) || "*Vide*" },
                { name: "🆕 Nouveau", value: newMessage.content?.slice(0, 1024) || "*Vide*" }
            )
            .setTimestamp();

        sendLog(LOGS.messages, embed);
    });

    // --- GESTION DES SALONS ---

    client.on("channelCreate", async (channel) => {
        if (!channel.guild) return;

        const embed = new EmbedBuilder()
            .setColor("Green")
            .setTitle("📁 Salon créé")
            .addFields(
                { name: "📌 Nom", value: channel.name, inline: true },
                { name: "🆔 ID", value: channel.id, inline: true },
                { name: "🗂️ Type", value: `${channel.type}`, inline: true }
            )
            .setTimestamp();

        sendLog(LOGS.serveur, embed);
    });

    client.on("channelDelete", async (channel) => {
        if (!channel.guild) return;

        let executor = "Inconnu";
        const fetchedLogs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete }).catch(() => null);
        const deletionLog = fetchedLogs?.entries.first();
        if (deletionLog && deletionLog.target.id === channel.id) {
            executor = deletionLog.executor.tag;
        }

        const embed = new EmbedBuilder()
            .setColor("Red")
            .setTitle("🗑️ Salon supprimé")
            .addFields(
                { name: "📌 Nom", value: channel.name, inline: true },
                { name: "🆔 ID", value: channel.id, inline: true },
                { name: "🛡️ Supprimé par", value: executor, inline: true }
            )
            .setTimestamp();

        sendLog(LOGS.antiraid, embed);
    });

    client.on("channelUpdate", async (oldChannel, newChannel) => {
        if (!oldChannel.guild || oldChannel.name === newChannel.name) return;

        const embed = new EmbedBuilder()
            .setColor("Blue")
            .setTitle("⚙️ Salon modifié (Nom)")
            .addFields(
                { name: "📌 Ancien nom", value: oldChannel.name, inline: true },
                { name: "🆕 Nouveau nom", value: `${newChannel}`, inline: true }
            )
            .setTimestamp();

        sendLog(LOGS.serveur, embed);
    });

    // --- GESTION DES RÔLES ---

    client.on("roleCreate", async (role) => {
        const embed = new EmbedBuilder()
            .setColor("Green")
            .setTitle("🎭 Rôle créé")
            .addFields(
                { name: "📌 Nom", value: role.name, inline: true },
                { name: "🆔 ID", value: role.id, inline: true }
            )
            .setTimestamp();

        sendLog(LOGS.permissions, embed);
    });

    client.on("roleDelete", async (role) => {
        let executor = "Inconnu";
        const fetchedLogs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete }).catch(() => null);
        const roleLog = fetchedLogs?.entries.first();
        if (roleLog && roleLog.target.id === role.id) {
            executor = roleLog.executor.tag;
        }

        const embed = new EmbedBuilder()
            .setColor("Red")
            .setTitle("🗑️ Rôle supprimé")
            .addFields(
                { name: "📌 Nom", value: role.name, inline: true },
                { name: "🆔 ID", value: role.id, inline: true },
                { name: "🛡️ Supprimé par", value: executor, inline: true }
            )
            .setTimestamp();

        sendLog(LOGS.antiraid, embed);
    });

    client.on("roleUpdate", async (oldRole, newRole) => {
        if (oldRole.name === newRole.name) return;

        const embed = new EmbedBuilder()
            .setColor("Blue")
            .setTitle("⚙️ Rôle modifié (Nom)")
            .addFields(
                { name: "📌 Ancien nom", value: oldRole.name, inline: true },
                { name: "🆕 Nouveau nom", value: `${newRole}`, inline: true }
            )
            .setTimestamp();

        sendLog(LOGS.permissions, embed);
    });

    // --- ETATS VOCAUX ---

    client.on("voiceStateUpdate", async (oldState, newState) => {
        const member = newState.member || oldState.member;
        if (!member || member.user.bot) return;

        // Connexion Salon
        if (!oldState.channel && newState.channel) {
            const embed = new EmbedBuilder()
                .setColor("Green")
                .setTitle("🔊 Vocal rejoint")
                .addFields(
                    { name: "👤 Membre", value: `${member.user.tag} (<@${member.id}>)`, inline: true },
                    { name: "🎧 Salon", value: newState.channel.name, inline: true }
                )
                .setTimestamp();
            sendLog(LOGS.vocaux, embed);
        }

        // Déconnexion Salon
        if (oldState.channel && !newState.channel) {
            const embed = new EmbedBuilder()
                .setColor("Red")
                .setTitle("📤 Vocal quitté")
                .addFields(
                    { name: "👤 Membre", value: `${member.user.tag} (<@${member.id}>)`, inline: true },
                    { name: "🎧 Salon", value: oldState.channel.name, inline: true }
                )
                .setTimestamp();
            sendLog(LOGS.vocaux, embed);
        }

        // Changement de Salon
        if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
            const embed = new EmbedBuilder()
                .setColor("Blue")
                .setTitle("🔀 Vocal changé")
                .addFields(
                    { name: "👤 Membre", value: `${member.user.tag} (<@${member.id}>)` },
                    { name: "📉 Ancien Salon", value: oldState.channel.name, inline: true },
                    { name: "📈 Nouveau Salon", value: newState.channel.name, inline: true }
                )
                .setTimestamp();
            sendLog(LOGS.vocaux, embed);
        }
    });

    // --- SANCTIONS (BAN / UNBAN) ---

    client.on("guildBanAdd", async (ban) => {
        let executor = "Inconnu";
        let reason = ban.reason || "Aucune raison fournie";
        
        const fetchedLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd }).catch(() => null);
        const banLog = fetchedLogs?.entries.first();
        if (banLog && banLog.target.id === ban.user.id) {
            executor = `${banLog.executor.tag} (<@${banLog.executor.id}>)`;
        }

        const embed = new EmbedBuilder()
            .setColor("DarkRed")
            .setTitle("🔨 Membre banni")
            .addFields(
                { name: "👤 Utilisateur", value: `${ban.user.tag} (<@${ban.user.id}>)`, inline: true },
                { name: "🛡️ Modérateur", value: executor, inline: true },
                { name: "📝 Raison", value: reason }
            )
            .setTimestamp();

        sendLog(LOGS.sanctions, embed);
    });

    client.on("guildBanRemove", async (ban) => {
        let executor = "Inconnu";
        const fetchedLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanRemove }).catch(() => null);
        const unbanLog = fetchedLogs?.entries.first();
        if (unbanLog && unbanLog.target.id === ban.user.id) {
            executor = `${unbanLog.executor.tag} (<@${unbanLog.executor.id}>)`;
        }

        const embed = new EmbedBuilder()
            .setColor("Green")
            .setTitle("✅ Membre débanni")
            .addFields(
                { name: "👤 Utilisateur", value: `${ban.user.tag} (<@${ban.user.id}>)`, inline: true },
                { name: "🛡️ Modérateur", value: executor, inline: true }
            )
            .setTimestamp();

        sendLog(LOGS.sanctions, embed);
    });

    // --- SÉCURITÉ / STRUCTURES DIVERSES ---

    client.on("emojiCreate", async (emoji) => {
        const embed = new EmbedBuilder()
            .setColor("Green")
            .setTitle("😀 Emoji ajouté")
            .setDescription(`L'emoji ${emoji} a été ajouté au serveur.\n**Nom :** :${emoji.name}:`)
            .setTimestamp();
        sendLog(LOGS.serveur, embed);
    });

    client.on("emojiDelete", async (emoji) => {
        const embed = new EmbedBuilder()
            .setColor("Red")
            .setTitle("🗑️ Emoji supprimé")
            .setDescription(`L'emoji **:${emoji.name}:** a été retiré du serveur.`)
            .setTimestamp();
        sendLog(LOGS.serveur, embed);
    });

    client.on("guildUpdate", async (oldGuild, newGuild) => {
        if (oldGuild.name !== newGuild.name) {
            const embed = new EmbedBuilder()
                .setColor("Blue")
                .setTitle("⚙️ Serveur renommé")
                .addFields(
                    { name: "📌 Ancien nom", value: oldGuild.name, inline: true },
                    { name: "🆕 Nouveau nom", value: newGuild.name, inline: true }
                )
                .setTimestamp();
            sendLog(LOGS.serveur, embed);
        }
    });

    client.once("ready", async () => {
        console.log("[🛡️ LOGS] Central Aeroz Esports opérationnelle !");
        
        const embed = new EmbedBuilder()
            .setColor("Green")
            .setTitle("🤖 Bot Aeroz Esports connecté")
            .setDescription("Les modules d'écoute d'audit et les flux de logs sont actifs.")
            .setTimestamp();

        sendLog(LOGS.bot, embed);
    });
};
