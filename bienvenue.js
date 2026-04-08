module.exports = async (client, member) => {
  const channelId = "1487498673666654238";
  const channel = member.guild.channels.cache.get(channelId);

  const rolesToAdd = [
    "1490074813526577312",
    "1487506977419558992",
    "1490074951074713672"
  ];

  try {
    // Ajout des rôles
    for (const roleId of rolesToAdd) {
      const role = member.guild.roles.cache.get(roleId);
      if (role) {
        await member.roles.add(role);
      }
    }

    // Invitations
    const invites = await member.guild.invites.fetch();
    const invite = invites.find(inv => inv.uses > 0 && inv.inviter);

    let inviterTag = "Inconnu";
    let inviteCount = 0;

    if (invite && invite.inviter) {
      inviterTag = invite.inviter.tag;
      inviteCount = invite.uses;
    }

    const message = `
🎉 **Bienvenue sur Ventrix**

👤 ${member.user.username}
📊 ${member.guild.memberCount}ème membre

📨 Invité par : **${inviterTag}**
🎯 Invitations : **${inviteCount}**
    `;

    if (channel) channel.send(message);

  } catch (error) {
    console.error("Erreur bienvenue :", error);
  }
};
