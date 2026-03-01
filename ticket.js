const { 
    ChannelType, 
    PermissionFlagsBits, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');

module.exports = (client) => {

    const PANEL_CHANNEL_ID = "1456080763534442516";
    const STAFF_ROLE = "1476307954662899990";

    const ticketCategories = {
        joueur: {
            name: "Devenir Joueur",
            message: `Pseudo :
Pseudo Epic Games :
Plateforme (PC / PS / Xbox / Switch) :
Âge :
Pays :
Disponibilités :
Niveau / Expérience :

Motivation :
(Pourquoi souhaites-tu rejoindre HoveX ?)

Points forts :

Anciennes équipes (si oui, lesquelles ?) :

Autres informations utiles :`,
            roles: ["1456080598795030793","1456080585742094338","1456080578397999115"]
        },
        staff: {
            name: "Intégrer le staff",
            message: `Raison : ⚠️ Toute candidature incomplète, non sérieuse ou copiée sera refusée.
Réponses claires, structurées et développées obligatoires.

Pseudo Discord :
ID Discord :
Âge :
Pays / Fuseau horaire :
Disponibilités précises (jours + horaires) :

As-tu déjà occupé un poste staff ?
(Serveur, rôle exact, durée, raison du départ.)

As-tu déjà utilisé des bots de modération ? Lesquels ?

Pourquoi souhaites-tu rejoindre le staff de HoveX ?
(Réponse argumentée.)

Quelles sont tes principales qualités pour ce poste ?

Comment réagirais-tu face à :

Un membre irrespectueux
Un conflit entre membres
Un spam ou un raid

📖 Le règlement s’applique strictement durant toute la procédure.`,
            roles: [STAFF_ROLE]
        },
        studio: { name: "Rejoindre Audiovisuel", message: "Panel en cours de préparation.", roles: [STAFF_ROLE] },
        partenariat: { name: "Partenariat", message: "Panel en cours de préparation.", roles: ["1456080588846006556"] },
        aide: { name: "Besoin d'aide", message: "Panel en cours de préparation.", roles: [STAFF_ROLE] },
        signalement: { name: "Signalement", message: "Panel en cours de préparation.", roles: [STAFF_ROLE] }
    };

    // ================= PANEL =================
    client.once('ready', async () => {

        const panelChannel = await client.channels.fetch(PANEL_CHANNEL_ID);
        if (!panelChannel) return console.log("Salon du panel introuvable.");

        // Supprime anciens messages du bot
        const messages = await panelChannel.messages.fetch({ limit: 50 });
        const botMessages = messages.filter(m => m.author.id === client.user.id);
        botMessages.forEach(m => m.delete().catch(() => {}));

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

━━━━━━━━━━━━━━━━━━

## ❓ Besoin d’aide ou envie de rejoindre l’aventure ?

Sélectionne la **catégorie adaptée** dans le menu ci-dessous afin d’ouvrir un ticket.

Un membre du **<@&${STAFF_ROLE}>** prendra ta demande en charge *dans les plus brefs délais.*

━━━━━━━━━━━━━━━━━━

## ⏳ Délai de réponse

Après l’ouverture de ton ticket, tu disposes de **24 heures maximum** pour répondre.

⚠️ Sans réponse dans ce délai, le ticket sera fermé automatiquement.
⚠️ Les abus pourront entraîner un refus de futurs tickets.

━━━━━━━━━━━━━━━━━━

## 📖 Règlement

Le règlement s’applique également aux tickets.
Merci de rester respectueux, poli et compréhensif envers l’ensemble du <@&${STAFF_ROLE}> de HoveX.

🔗 Règlement :
https://discord.com/channels/1455368732296872160/1456080760548360340

━━━━━━━━━━━━━━━━━━

## 👥 Recrutement

Tu souhaites intégrer notre équipe ?

🔗 Salon effectif :
https://discord.com/channels/1455368732296872160/1476306338395983945`,
            components: [row]
        });

        console.log("✅ Panel envoyé dans le salon 1456080763534442516");
    });

    // ================= CREATION TICKET =================
    client.on("interactionCreate", async interaction => {
        if (!interaction.isStringSelectMenu()) return;
        if (interaction.customId !== "ticket_select") return;

        const category = ticketCategories[interaction.values[0]];
        if (!category) return;

        const existing = interaction.guild.channels.cache.find(
            c => c.name === `ticket-${interaction.user.id}`
        );

        if (existing) {
            return interaction.reply({ content: "Tu as déjà un ticket ouvert.", ephemeral: true });
        }

        const ticketChannel = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}`.toLowerCase(),
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                ...category.roles.map(r => ({
                    id: r,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                }))
            ]
        });

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId("delete").setLabel("Delete").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("thread").setLabel("Thread Staff").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("rappel_user").setLabel("Rappel").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("rappel_staff").setLabel("Rappel Staff").setStyle(ButtonStyle.Success)
        );

        await ticketChannel.send({
            content: `@everyone
Bonjour <@${interaction.user.id}> 👋

Merci d'avoir ouvert un ticket pour **${category.name}**

${category.message}`,
            components: [buttons]
        });

        await interaction.reply({ content: `Ton ticket a été créé : ${ticketChannel}`, ephemeral: true });
    });

};
