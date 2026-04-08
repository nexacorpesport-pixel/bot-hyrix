const { EmbedBuilder } = require('discord.js');

module.exports = async (client, member) => {
  const channelId = "1487498673666654238";
  const channel = member.guild.channels.cache.get(channelId);

  const rolesToAdd = [
    "1490074813526577312",
    "1487506977419558992",
    "1490074951074713672"
  ];

  try {
    // =========================
    // 🎭 AJOUT DES RÔLES
    // =========================
    for (const roleId of rolesToAdd) {
      const role = member.guild.roles.cache.get(roleId);
      if (role) {
        await member.roles.add(role);
      }
    }

    // =========================
    // 🎟 INVITATIONS
    // =========================
    const invites = await member.guild.invites.fetch();
    const invite = invites.find(inv => inv.uses > 0 && inv.inviter);

    let inviterTag = "Inconnu";
    let inviteCount = 0;

    if (invite && invite.inviter) {
      inviterTag = invite.inviter.tag;
      inviteCount = invite.uses;
    }

    // =========================
    // 💖 EMBED
    // =========================
    const embed = new EmbedBuilder()
      .setColor("#ff69b4") // rose
      .setTitle("🎉 Bienvenue sur Ventrix")
      .setDescription(
`👋 ${member}  

Nous sommes heureux de t'accueillir 💕  

📊 Tu es le **${member.guild.memberCount}ème membre**  

📨 Invité par : **${inviterTag}**  
🎯 Invitations : **${inviteCount}**  

✨ Passe un excellent moment parmi nous !`
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 })) // PDP
      .setFooter({ text: `ID : ${member.id}` })
      .setTimestamp();

    // =========================
    // 📩 ENVOI
    // =========================
    if (channel) {
      channel.send({ embeds: [embed] });
    }

  } catch (error) {
    console.error("Erreur bienvenue :", error);
  }
};
