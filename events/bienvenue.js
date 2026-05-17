const { EmbedBuilder } = require("discord.js");

module.exports = async (client, member) => {

    const channelId = "1505330766047875242";

    const channel = member.guild.channels.cache.get(channelId);

    if (!channel) return;

    const embed = new EmbedBuilder()
        .setColor("#ffae00")
        .setTitle("✨ Nouveau membre")
        .setDescription(
            `Bienvenue <@${member.id}> sur **Pixar**.\n\n` +
            `Nous sommes heureux de t'accueillir dans notre communauté.\n` +
            `Prends le temps de lire le règlement et profite de l'expérience.`
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

    channel.send({
        embeds: [embed]
    });

};
