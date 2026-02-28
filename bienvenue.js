module.exports = async (client, member) => {

    const channelId = "1456080758815850679"; // Remplace par l'ID du salon
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

        const message = `
**Bienvenue sur HoveX**

*${member.user.username}*, nous sommes heureux de vous accueillir au sein du serveur.

Vous êtes le **${member.guild.memberCount}ème membre**.

Vous avez été invité par **${inviterTag}**, qui comptabilise désormais **${inviteCount} invitation(s)**.

Nous vous souhaitons une excellente intégration parmi nous.
        `;

        channel.send(message);

    } catch (error) {
        console.error("Erreur système bienvenue :", error);
    }
};
