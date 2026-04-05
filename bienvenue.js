const { Client, GatewayIntentBits } = require("discord.js");
require("dotenv").config();

const client = new Client({ 
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] 
});

client.once("ready", () => {
  console.log(`${client.user.tag} est en ligne !`);
});

client.on("guildMemberAdd", async member => {
  const channelId = "1487498673666654238";
  const channel = member.guild.channels.cache.get(channelId);

  // 👉 IDs des rôles à ajouter automatiquement
  const rolesToAdd = [
    "1490074813526577312",
    "1487506977419558992",
    "1490074951074713672"
  ];

  try {
    // ✅ Ajout des rôles
    for (const roleId of rolesToAdd) {
      const role = member.guild.roles.cache.get(roleId);
      if (role) {
        await member.roles.add(role);
      }
    }

    // ✅ Gestion des invitations
    const invites = await member.guild.invites.fetch();
    const invite = invites.find(inv => inv.uses > 0 && inv.inviter);

    let inviterTag = "Inconnu";
    let inviteCount = 0;

    if (invite && invite.inviter) {
      inviterTag = invite.inviter.tag;
      inviteCount = invite.uses;
    }

    const message = `
**Bienvenue sur Ventrix**

*${member.user.username}*, nous sommes heureux de vous accueillir au sein du serveur.

Vous êtes le **${member.guild.memberCount}ème membre**.

Vous avez été invité par **${inviterTag}**, qui comptabilise désormais **${inviteCount} invitation(s)**.

Nous vous souhaitons une excellente intégration parmi nous.
    `;

    if (channel) channel.send(message);

  } catch (error) {
    console.error("Erreur système bienvenue :", error);
  }
});

client.login(process.env.TOKEN);
