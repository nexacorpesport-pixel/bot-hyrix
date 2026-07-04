const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

// Cache pour stocker les invitations du serveur
const invitesCache = new Map();

module.exports = (client) => {
    console.log("[👋 ONBOARDING] Module d'accueil épuré avec boutons de redirection opérationnel.");

    const GUILD_ID = "1501625824028266676";
    
    // ==========================================
    // CONFIGURATION DES SALONS & COMPOSANTS
    // ==========================================
    const CHANNELS = {
        WELCOME: "1501626008564928572",
        LOGS_MEMBRES: "1521930283094638722",
        LOGS_INVITES: "1502757854568779944"
    };

    // Liens vers tes salons pour les boutons et les redirections
    const LINKS = {
        REGLEMENT: "https://discord.com/channels/1501625824028266676/1501626010049712180",
        PRESENTATION: "https://discord.com/channels/1501625824028266676/1501626026252304555",
        CRITERES: "https://discord.com/channels/1501625824028266676/1501626012822147162"
    };

    // Couleur Blanche demandée
    const COLOR_WHITE = "#FFFFFF";
    
    // URL de ton logo fourni
    const LOGO_URL = "https://media.discordapp.net/attachments/1456718862283444414/1464677828749561987/mwWWI6B.png?ex=6a47f586&is=6a46a406&hm=2c1bcf48d52289db59bc89a72f04586c541bea085a8dbc2f65ef0025e70c06d9&=&format=webp&quality=lossless&width=960&height=960";

    // 1. CHARGEMENT INITIAL DES INVITATIONS AU DÉMARRAGE
    client.once("ready", async () => {
        const guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) return;

        const invites = await guild.invites.fetch().catch(() => null);
        if (invites) {
            invitesCache.set(guild.id, new Map(invites.map(i => [i.code, i.uses])));
        }
    });

    // 2. LOGS QUAND UNE INVITATION EST CRÉÉE
    client.on("inviteCreate", async (invite) => {
        if (invite.guild.id !== GUILD_ID) return;
        
        const guildInvites = invitesCache.get(invite.guild.id) || new Map();
        guildInvites.set(invite.code, invite.uses);
        invitesCache.set(invite.guild.id, guildInvites);

        const logInviteEmbed = new EmbedBuilder()
            .setColor("#2ecc71") // Vert Hexa stable 🟢
            .setTitle("➕ Invitation Créée")
            .setDescription(`**Code :** \`${invite.code}\`\n**Créateur :** ${invite.inviter ? invite.inviter.tag : "Inconnu"}\n**Salon :** ${invite.channel}`)
            .setTimestamp();

        const logChannel = await client.channels.fetch(CHANNELS.LOGS_INVITES).catch(() => null);
        if (logChannel) logChannel.send({ embeds: [logInviteEmbed] }).catch(() => {});
    });

    // 3. ARRIVÉE D'UN MEMBRE : ACCUEIL AUTOMATIQUE DANS LE SALON + TRACKING
    client.on("guildMemberAdd", async (member) => {
        if (member.guild.id !== GUILD_ID) return;

        const guild = member.guild;
        const memberCount = guild.memberCount;

        // Tracking de l'inviteur
        let inviterUser = null;
        let inviteUses = 0;

        const oldInvites = invitesCache.get(guild.id);
        const newInvites = await guild.invites.fetch().catch(() => null);

        if (newInvites && oldInvites) {
            for (const [code, invite] of newInvites) {
                const oldUses = oldInvites.get(code) || 0;
                if (invite.uses > oldUses) {
                    inviterUser = invite.inviter;
                    inviteUses = invite.uses;
                    oldInvites.set(code, invite.uses);
                    break;
                }
            }
        }
        
        if (newInvites) {
            invitesCache.set(guild.id, new Map(newInvites.map(i => [i.code, i.uses])));
        }

        // --- ENVOI DU MESSAGE D'ACCUEIL DANS LE CHANNEL DE BIENVENUE ---
        const welcomeChannel = await guild.channels.fetch(CHANNELS.WELCOME).catch(() => null);
        if (welcomeChannel) {
            const inviterText = inviterUser ? `${inviterUser.username}` : "Inconnu ou via Vanité";
            const scoreText = inviterUser ? `(Déjà ${inviteUses} invitations)` : "";

            const welcomeEmbed = new EmbedBuilder()
                .setColor(COLOR_WHITE)
                .setTitle(`🔥 BIENVENUE CHEZ TEAM HOVEX 🔥`)
                .setDescription(
                    `Bienvenue ${member} ! Installe-toi confortablement.\n\n` +
                    `🏆 Tu es notre **${memberCount}e** membre.\n` +
                    `👤 Invité par : \`${inviterText}\` ${scoreText}\n\n` +
                    `📌 **Prends quelques secondes pour visiter nos sections :**\n` +
                    `• Prends connaissance de notre [📜 Règlement](${LINKS.REGLEMENT}).\n` +
                    `• Découvre l'histoire de la structure via notre [🎭 Présentation](${LINKS.PRESENTATION}).\n` +
                    `• Tu veux nous rejoindre ? Regarde les [🎮 Critères de Recrutement](${LINKS.CRITERES}).`
                )
                .setThumbnail(LOGO_URL)
                .setFooter({ text: `Team HoveX • Compteur : ${memberCount} membres`, iconURL: guild.iconURL({ dynamic: true }) })
                .setTimestamp();

            // Rangée de boutons
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("📜 Règlement").setURL(LINKS.REGLEMENT),
                new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("🎭 Présentation").setURL(LINKS.PRESENTATION),
                new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("🎮 Critères de Recrutement").setURL(LINKS.CRITERES)
            );

            welcomeChannel.send({ content: `👋 Hé, salut ${member} !`, embeds: [welcomeEmbed], components: [row] }).catch(() => {});
        }

        // --- ENVOI DU LOG MEMBRE (ARRIVÉE) ---
        const logMembreChannel = await client.channels.fetch(CHANNELS.LOGS_MEMBRES).catch(() => null);
        if (logMembreChannel) {
            const joinEmbed = new EmbedBuilder()
                .setColor("#2ecc71") // Vert Hexa stable 🟢
                .setTitle("📥 Nouveau Membre")
                .setDescription(`**Compte :** ${member.user.tag} (\`${member.id}\`)\n**Créé le :** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setTimestamp();
            logMembreChannel.send({ embeds: [joinEmbed] }).catch(() => {});
        }

        // --- ENVOI DU LOG INVITATION ---
        if (inviterUser) {
            const logInviteChannel = await client.channels.fetch(CHANNELS.LOGS_INVITES).catch(() => null);
            if (logInviteChannel) {
                const infoInviteEmbed = new EmbedBuilder()
                    .setColor("#ffc0cb") // Rose Hexa valide 🌸 (Plus d'erreur "Pink")
                    .setTitle("🎯 Tracking d'Invitation")
                    .setDescription(`**Joueur arrivé :** ${member.user.tag}\n**Inviteur :** ${inviterUser.tag} (\`${inviterUser.id}\`)\n**Score de l'inviteur :** \`${inviteUses}\` utilisations au total.`)
                    .setTimestamp();
                logInviteChannel.send({ embeds: [infoInviteEmbed] }).catch(() => {});
            }
        }
    });

    // 4. LOGS DE DÉPART (QUAND UN MEMBRE QUITTE)
    client.on("guildMemberRemove", async (member) => {
        if (member.guild.id !== GUILD_ID) return;

        const logMembreChannel = await client.channels.fetch(CHANNELS.LOGS_MEMBRES).catch(() => null);
        if (logMembreChannel) {
            const leaveEmbed = new EmbedBuilder()
                .setColor("#e74c3c") // Rouge Hexa stable 🔴
                .setTitle("📤 Départ d'un membre")
                .setDescription(`**Compte :** ${member.user.tag} (\`${member.id}\`)\n\nLe serveur compte désormais **${member.guild.memberCount}** membres.`)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setTimestamp();
            logMembreChannel.send({ embeds: [leaveEmbed] }).catch(() => {});
        }
    });
};
