const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

// Cache global partagé pour suivre la consommation des invitations
const invitesCache = new Map();

module.exports = (client) => {
    console.log("[Onboarding] Système d'accueil et tracking d'invitations opérationnel.");

    // =====================================================
    // ⚠️ CONFIGURATION DES IDENTIFIANTS (À MODIFIER AVEC TES NOUVEAUX IDs)
    // =====================================================
    const GUILD_ID = "1528107464908603657";
    
    const CHANNELS = {
        WELCOME: "1528184669827239966",
        LOGS_MEMBRES: "1528211548198277130",
        LOGS_INVITES: "1528211564598001685"
    };

    const LINKS = {
        REGLEMENT: "https://discord.com/channels/1528107464908603657/1528184670951444553",
        PRESENTATION: "https://discord.com/channels/1528107464908603657/1528184676139667466",
        CRITERES: "https://discord.com/channels/1528107464908603657/1528184701607608480"
    };

    const LOGO_URL = "https://media.discordapp.net/attachments/1521974012719136899/1525981856606982205/logo_aeroz.png";

    // Mise en cache des invitations au démarrage du bot
    client.once("ready", async () => {
        const guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) return;

        const invites = await guild.invites.fetch().catch(() => null);
        if (invites) {
            invitesCache.set(guild.id, new Map(invites.map(i => [i.code, i.uses])));
        }
    });

    // Tracking à la création d'une nouvelle invitation
    client.on("inviteCreate", async (invite) => {
        if (invite.guild.id !== GUILD_ID) return;
        
        const guildInvites = invitesCache.get(invite.guild.id) || new Map();
        guildInvites.set(invite.code, invite.uses);
        invitesCache.set(invite.guild.id, guildInvites);

        const creator = invite.inviter ? `${invite.inviter.username}` : "Inconnu";

        const logInviteEmbed = new EmbedBuilder()
            .setColor("#2ecc71")
            .setTitle("➕ Invitation Créée")
            .setDescription(`**Code :** \`${invite.code}\`\n**Créateur :** ${creator}\n**Salon :** ${invite.channel}`)
            .setTimestamp();

        const logChannel = await client.channels.fetch(CHANNELS.LOGS_INVITES).catch(() => null);
        if (logChannel) logChannel.send({ embeds: [logInviteEmbed] }).catch(() => {});
    });

    // Gestion des arrivées (Welcome & Tracking)
    client.on("guildMemberAdd", async (member) => {
        if (member.guild.id !== GUILD_ID) return;

        const guild = member.guild;
        const memberCount = guild.memberCount;

        let inviterUser = null;
        let inviteUses = 0;

        const oldInvites = invitesCache.get(guild.id);
        const newInvites = await guild.invites.fetch().catch(() => null);

        // Analyse comparative pour identifier l'invitation utilisée
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

        // --- MESSAGE DE BIENVENUE INTERACTIF ---
        const welcomeChannel = await guild.channels.fetch(CHANNELS.WELCOME).catch(() => null);
        if (welcomeChannel) {
            const inviterText = inviterUser ? `${inviterUser.username}` : "Inconnu / Lien Vanité";
            const scoreText = inviterUser ? `(Déjà ${inviteUses} invitations)` : "";
            const guildIcon = guild.icon ? guild.iconURL({ forceStatic: false }) : null;

            const welcomeEmbed = new EmbedBuilder()
                .setColor("#FFFFFF")
                .setTitle(`🔥 BIENVENUE CHEZ AEROZ ESPORTS 🔥`)
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
                .setTimestamp();

            if (guildIcon) {
                welcomeEmbed.setFooter({ text: `Aeroz Esports • Compteur : ${memberCount} membres`, iconURL: guildIcon });
            } else {
                welcomeEmbed.setFooter({ text: `Aeroz Esports • Compteur : ${memberCount} membres` });
            }

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("📜 Règlement").setURL(LINKS.REGLEMENT),
                new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("🎭 Présentation").setURL(LINKS.PRESENTATION),
                new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("🎮 Critères de Recrutement").setURL(LINKS.CRITERES)
            );

            welcomeChannel.send({ content: `👋 Hé, salut ${member} !`, embeds: [welcomeEmbed], components: [row] }).catch(() => {});
        }

        // --- LOG DE JOINTURE GENERAL ---
        const logMembreChannel = await client.channels.fetch(CHANNELS.LOGS_MEMBRES).catch(() => null);
        if (logMembreChannel) {
            const joinEmbed = new EmbedBuilder()
                .setColor("#2ecc71")
                .setTitle("📥 Nouveau Membre")
                .setDescription(`**Compte :** ${member.user.username} (\`${member.id}\`)\n**Créé le :** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`)
                .setThumbnail(member.user.displayAvatarURL({ forceStatic: false }))
                .setTimestamp();
            logMembreChannel.send({ embeds: [joinEmbed] }).catch(() => {});
        }

        // --- LOG DU TRACKING D'INVITATION ---
        if (inviterUser) {
            const logInviteChannel = await client.channels.fetch(CHANNELS.LOGS_INVITES).catch(() => null);
            if (logInviteChannel) {
                const infoInviteEmbed = new EmbedBuilder()
                    .setColor("#ffc0cb")
                    .setTitle("🎯 Tracking d'Invitation")
                    .setDescription(`**Joueur arrivé :** ${member.user.username}\n**Inviteur :** ${inviterUser.username} (\`${inviterUser.id}\`)\n**Score de l'inviteur :** \`${inviteUses}\` utilisations au total.`)
                    .setTimestamp();
                logInviteChannel.send({ embeds: [infoInviteEmbed] }).catch(() => {});
            }
        }
    });

    // Gestion des départs
    client.on("guildMemberRemove", async (member) => {
        if (member.guild.id !== GUILD_ID) return;

        const logMembreChannel = await client.channels.fetch(CHANNELS.LOGS_MEMBRES).catch(() => null);
        if (logMembreChannel) {
            const leaveEmbed = new EmbedBuilder()
                .setColor("#e74c3c")
                .setTitle("📤 Départ d'un membre")
                .setDescription(`**Compte :** ${member.user.username} (\`${member.id}\`)\n\nLe serveur compte désormais **${member.guild.memberCount}** membres.`)
                .setThumbnail(member.user.displayAvatarURL({ forceStatic: false }))
                .setTimestamp();
            logMembreChannel.send({ embeds: [leaveEmbed] }).catch(() => {});
        }
    });
};
