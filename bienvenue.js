const { EmbedBuilder } = require('discord.js');

module.exports = async (client, member) => {

    const channelId = "1456080758815850679"; // ⚠️ Remplace par l'ID du salon bienvenue
    const channel = member.guild.channels.cache.get(channelId);
    if (!channel) return;

    try {
        const invites = await member.guild.invites.fetch();
        const invite = invites.find(inv => inv.uses > 0 && inv.inviter);

        let inviterTag = "Inconnu";
        let inviteCount = 0;

        if (invite && invite.inviter) {
            inviterTag = invite.inviter.tag;
            inviteCount = invite.uses;
        }

        const embed = new EmbedBuilder()
            .setColor("#FFC0CB") // Rose doux
            .setAuthor({
                name: "HoveX",
                iconURL: member.guild.iconURL({ dynamic: true })
            })
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
            .setTitle("Bienvenue sur HoveX")
            .setDescription(
                `🤍 **${member.user.username}**, bienvenue.\n\n` +
                `👥 Membre n° **${member.guild.memberCount}**\n\n` +
                `🔗 Invité par : **${inviterTag}**\n` +
                `📊 Invitations totales : **${inviteCount}**`
            )
            .setTimestamp();

        channel.send({ embeds: [embed] });

    } catch (error) {
        console.error("Erreur système bienvenue :", error);
    }
};
