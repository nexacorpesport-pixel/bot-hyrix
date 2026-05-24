const {
    AuditLogEvent,
    EmbedBuilder,
    ChannelType
} = require("discord.js");

// =========================
// LOG CHANNELS
// =========================
const LOGS = {

    general: "1508156629093187705",
    moderation: "1508156702514479305",
    antiraid: "1508156735213404170",
    members: "1508156766259777686",
    messages: "1508156801189937302",
    vocaux: "1508156845003378828",
    serveur: "1508156874610966739",
    bot: "1508156905804009472",
    permissions: "1508156974015975497",
    tickets: "1508157026491175002",
    tempvoc: "1508157067461132510",
    sanctions: "1508157099153297568"

};

module.exports = (client) => {

    // =========================
    // FUNCTION SEND LOG
    // =========================
    async function sendLog(channelId, embed) {

        try {

            const channel = client.channels.cache.get(channelId);

            if (!channel) return;

            await channel.send({
                embeds: [embed]
            });

        } catch (err) {
            console.log("❌ Erreur logs :", err);
        }
    }

    // =========================
    // MEMBER JOIN
    // =========================
    client.on("guildMemberAdd", async (member) => {

        const embed = new EmbedBuilder()
            .setColor("Green")
            .setTitle("✅ Membre rejoint")
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                {
                    name: "👤 Utilisateur",
                    value: `${member.user.tag}`,
                    inline: true
                },
                {
                    name: "🆔 ID",
                    value: member.id,
                    inline: true
                },
                {
                    name: "📅 Compte créé",
                    value: `<t:${parseInt(member.user.createdTimestamp / 1000)}:R>`
                }
            )
            .setTimestamp();

        sendLog(LOGS.members, embed);
    });

    // =========================
    // MEMBER LEAVE
    // =========================
    client.on("guildMemberRemove", async (member) => {

        const embed = new EmbedBuilder()
            .setColor("Red")
            .setTitle("❌ Membre parti")
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                {
                    name: "👤 Utilisateur",
                    value: `${member.user.tag}`,
                    inline: true
                },
                {
                    name: "🆔 ID",
                    value: member.id,
                    inline: true
                }
            )
            .setTimestamp();

        sendLog(LOGS.members, embed);
    });

    // =========================
    // MESSAGE DELETE
    // =========================
    client.on("messageDelete", async (message) => {

        if (!message.guild) return;
        if (message.author?.bot) return;

        const embed = new EmbedBuilder()
            .setColor("Orange")
            .setTitle("🗑️ Message supprimé")
            .addFields(
                {
                    name: "👤 Auteur",
                    value: `${message.author.tag}`,
                    inline: true
                },
                {
                    name: "📍 Salon",
                    value: `${message.channel}`,
                    inline: true
                },
                {
                    name: "💬 Contenu",
                    value: message.content?.slice(0, 1000) || "Aucun contenu"
                }
            )
            .setTimestamp();

        sendLog(LOGS.messages, embed);
    });

    // =========================
    // MESSAGE UPDATE
    // =========================
    client.on("messageUpdate", async (oldMessage, newMessage) => {

        if (!oldMessage.guild) return;
        if (oldMessage.author?.bot) return;

        if (oldMessage.content === newMessage.content) return;

        const embed = new EmbedBuilder()
            .setColor("Yellow")
            .setTitle("✏️ Message modifié")
            .addFields(
                {
                    name: "👤 Auteur",
                    value: `${oldMessage.author.tag}`
                },
                {
                    name: "📜 Ancien",
                    value: oldMessage.content?.slice(0, 1000) || "Aucun"
                },
                {
                    name: "🆕 Nouveau",
                    value: newMessage.content?.slice(0, 1000) || "Aucun"
                }
            )
            .setTimestamp();

        sendLog(LOGS.messages, embed);
    });

    // =========================
    // CHANNEL CREATE
    // =========================
    client.on("channelCreate", async (channel) => {

        const embed = new EmbedBuilder()
            .setColor("Green")
            .setTitle("📁 Salon créé")
            .addFields(
                {
                    name: "📌 Nom",
                    value: `${channel.name}`,
                    inline: true
                },
                {
                    name: "🆔 ID",
                    value: channel.id,
                    inline: true
                }
            )
            .setTimestamp();

        sendLog(LOGS.serveur, embed);
    });

    // =========================
    // CHANNEL DELETE
    // =========================
    client.on("channelDelete", async (channel) => {

        const embed = new EmbedBuilder()
            .setColor("Red")
            .setTitle("🗑️ Salon supprimé")
            .addFields(
                {
                    name: "📌 Nom",
                    value: `${channel.name}`,
                    inline: true
                },
                {
                    name: "🆔 ID",
                    value: channel.id,
                    inline: true
                }
            )
            .setTimestamp();

        sendLog(LOGS.antiraid, embed);
    });

    // =========================
    // CHANNEL UPDATE
    // =========================
    client.on("channelUpdate", async (oldChannel, newChannel) => {

        if (oldChannel.name === newChannel.name) return;

        const embed = new EmbedBuilder()
            .setColor("Blue")
            .setTitle("⚙️ Salon modifié")
            .addFields(
                {
                    name: "📌 Ancien nom",
                    value: oldChannel.name
                },
                {
                    name: "🆕 Nouveau nom",
                    value: newChannel.name
                }
            )
            .setTimestamp();

        sendLog(LOGS.serveur, embed);
    });

    // =========================
    // ROLE CREATE
    // =========================
    client.on("roleCreate", async (role) => {

        const embed = new EmbedBuilder()
            .setColor("Green")
            .setTitle("🎭 Rôle créé")
            .addFields(
                {
                    name: "📌 Nom",
                    value: role.name,
                    inline: true
                },
                {
                    name: "🆔 ID",
                    value: role.id,
                    inline: true
                }
            )
            .setTimestamp();

        sendLog(LOGS.permissions, embed);
    });

    // =========================
    // ROLE DELETE
    // =========================
    client.on("roleDelete", async (role) => {

        const embed = new EmbedBuilder()
            .setColor("Red")
            .setTitle("🗑️ Rôle supprimé")
            .addFields(
                {
                    name: "📌 Nom",
                    value: role.name,
                    inline: true
                },
                {
                    name: "🆔 ID",
                    value: role.id,
                    inline: true
                }
            )
            .setTimestamp();

        sendLog(LOGS.antiraid, embed);
    });

    // =========================
    // ROLE UPDATE
    // =========================
    client.on("roleUpdate", async (oldRole, newRole) => {

        if (oldRole.name === newRole.name) return;

        const embed = new EmbedBuilder()
            .setColor("Blue")
            .setTitle("⚙️ Rôle modifié")
            .addFields(
                {
                    name: "📌 Ancien nom",
                    value: oldRole.name
                },
                {
                    name: "🆕 Nouveau nom",
                    value: newRole.name
                }
            )
            .setTimestamp();

        sendLog(LOGS.permissions, embed);
    });

    // =========================
    // VOICE JOIN/LEAVE
    // =========================
    client.on("voiceStateUpdate", async (oldState, newState) => {

        const member = newState.member || oldState.member;

        if (!member) return;

        // JOIN
        if (!oldState.channel && newState.channel) {

            const embed = new EmbedBuilder()
                .setColor("Green")
                .setTitle("🔊 Vocal rejoint")
                .addFields(
                    {
                        name: "👤 Membre",
                        value: member.user.tag
                    },
                    {
                        name: "🎧 Salon",
                        value: `${newState.channel.name}`
                    }
                )
                .setTimestamp();

            sendLog(LOGS.vocaux, embed);
        }

        // LEAVE
        if (oldState.channel && !newState.channel) {

            const embed = new EmbedBuilder()
                .setColor("Red")
                .setTitle("📤 Vocal quitté")
                .addFields(
                    {
                        name: "👤 Membre",
                        value: member.user.tag
                    },
                    {
                        name: "🎧 Salon",
                        value: `${oldState.channel.name}`
                    }
                )
                .setTimestamp();

            sendLog(LOGS.vocaux, embed);
        }
    });

    // =========================
    // BAN
    // =========================
    client.on("guildBanAdd", async (ban) => {

        const embed = new EmbedBuilder()
            .setColor("DarkRed")
            .setTitle("🔨 Membre banni")
            .addFields(
                {
                    name: "👤 Utilisateur",
                    value: `${ban.user.tag}`
                },
                {
                    name: "🆔 ID",
                    value: ban.user.id
                }
            )
            .setTimestamp();

        sendLog(LOGS.sanctions, embed);
    });

    // =========================
    // UNBAN
    // =========================
    client.on("guildBanRemove", async (ban) => {

        const embed = new EmbedBuilder()
            .setColor("Green")
            .setTitle("✅ Membre débanni")
            .addFields(
                {
                    name: "👤 Utilisateur",
                    value: `${ban.user.tag}`
                },
                {
                    name: "🆔 ID",
                    value: ban.user.id
                }
            )
            .setTimestamp();

        sendLog(LOGS.sanctions, embed);
    });

    // =========================
    // EMOJI CREATE
    // =========================
    client.on("emojiCreate", async (emoji) => {

        const embed = new EmbedBuilder()
            .setColor("Green")
            .setTitle("😀 Emoji ajouté")
            .setDescription(`${emoji}`)
            .setTimestamp();

        sendLog(LOGS.serveur, embed);
    });

    // =========================
    // EMOJI DELETE
    // =========================
    client.on("emojiDelete", async (emoji) => {

        const embed = new EmbedBuilder()
            .setColor("Red")
            .setTitle("🗑️ Emoji supprimé")
            .setDescription(`${emoji.name}`)
            .setTimestamp();

        sendLog(LOGS.serveur, embed);
    });

    // =========================
    // GUILD UPDATE
    // =========================
    client.on("guildUpdate", async (oldGuild, newGuild) => {

        if (oldGuild.name !== newGuild.name) {

            const embed = new EmbedBuilder()
                .setColor("Blue")
                .setTitle("⚙️ Serveur modifié")
                .addFields(
                    {
                        name: "📌 Ancien nom",
                        value: oldGuild.name
                    },
                    {
                        name: "🆕 Nouveau nom",
                        value: newGuild.name
                    }
                )
                .setTimestamp();

            sendLog(LOGS.serveur, embed);
        }
    });

    // =========================
    // BOT READY LOG
    // =========================
    client.once("clientReady", async () => {

        const embed = new EmbedBuilder()
            .setColor("Green")
            .setTitle("🤖 Bot démarré")
            .setDescription("Tous les systèmes de logs sont actifs.")
            .setTimestamp();

        sendLog(LOGS.bot, embed);
    });

};
