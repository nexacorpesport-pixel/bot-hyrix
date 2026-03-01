const { Client, GatewayIntentBits } = require("discord.js");
require("dotenv").config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once("ready", () => {
  console.log(`${client.user.tag} est en ligne !`);
});

// Exemple d'événement guildMemberAdd
client.on("guildMemberAdd", async member => {
  const channelId = "1456080758815850679";
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
});

client.login(process.env.TOKEN);
