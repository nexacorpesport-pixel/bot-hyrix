const { 
    ChannelType,
    PermissionFlagsBits,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const PANEL_CHANNEL_ID = "1456080763534442516";
const STAFF_ROLE = "1476307954662899990";

module.exports = async (client) => {

    const panelChannel = await client.channels.fetch(PANEL_CHANNEL_ID).catch(() => null);
    if (!panelChannel) return console.log("❌ Salon panel introuvable");

    // Supprime anciens messages du bot
    const messages = await panelChannel.messages.fetch({ limit: 50 });
    messages
        .filter(m => m.author.id === client.user.id)
        .forEach(m => m.delete().catch(() => {}));

    const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket_select")
        .setPlaceholder("Sélectionne une catégorie")
        .addOptions([
            { label: "Devenir Joueur", value: "joueur" },
            { label: "Intégrer le staff", value: "staff" },
            { label: "Rejoindre Audiovisuel", value: "studio" },
            { label: "Signalement", value: "signalement" },
            { label: "Besoin d'aide", value: "aide" },
            { label: "Partenariat", value: "partenariat" }
        ]);

    const row = new ActionRowBuilder().addComponents(menu);

    await panelChannel.send({
        content: `# 🎫・Support & Recrutement — HoveX

Sélectionne une catégorie ci-dessous pour ouvrir un ticket.

Un membre du <@&${STAFF_ROLE}> prendra ta demande en charge.`,
        components: [row]
    });

    console.log("✅ Panel envoyé correctement.");
};
