const { ChannelType, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = (client) => {

    const TICKET_PANEL_CHANNEL = "1456080763534442516"; // Salon du panel
    const STAFF_ROLE = "1476307954662899990"; // Rôle staff

    // Catégories de ticket
    const ticketCategories = {
        "joueur": { name: "Devenir Joueur", message: `Pseudo :
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
            roleIds: ["1456080598795030793","1456080585742094338","1456080578397999115","1456080580541284352"]
        },
        "staff": { name: "Intégrer le staff", message: `Raison : ⚠️ Toute candidature incomplète, non sérieuse ou copiée sera refusée.
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
            roleIds: [STAFF_ROLE]
        },
        "studio": { name: "Rejoindre Audiovisuel", message: "Panel en cours de préparation.", roleIds: [STAFF_ROLE] },
        "partenariat": { name: "Partenariat", message: "Panel en cours de préparation.", roleIds: ["1456080588846006556"] },
        "aide": { name: "Besoin d'aide", message: "Panel en cours de préparation.", roleIds: [STAFF_ROLE] },
        "signalement": { name: "Signalement", message: "Panel en cours de préparation.", roleIds: [STAFF_ROLE] }
    };

    // Créer le panel de ticket
    client.once('ready', async () => {
        const channel = await client.channels.fetch(TICKET_PANEL_CHANNEL);
        if (!channel) return console.log("Salon panel introuvable");

        // Supprime les anciens messages
        const messages = await channel.messages.fetch({ limit: 10 });
        messages.forEach(msg => msg.delete().catch(() => {}));

        // Crée le menu de sélection
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('ticket_select')
            .setPlaceholder('Sélectionnez votre type de ticket')
            .addOptions(Object.entries(ticketCategories).map(([key, val]) => ({
                label: val.name,
                description: `Ouvrir un ticket pour ${val.name}`,
                value: key
            })));

        const row = new ActionRowBuilder().addComponents(selectMenu);

        // Message du panel
        await channel.send({
            content: `# 🎫・Support & Recrutement — HoveX

━━━━━━━━━━━━━━━━━━

## ❓ Besoin d’aide ou envie de rejoindre l’aventure ?

Sélectionne la **catégorie adaptée** dans le menu ci-dessous afin d’ouvrir un ticket.

Un membre du **<@&${STAFF_ROLE}>** prendra ta demande en charge *dans les plus brefs délais.*

━━━━━━━━━━━━━━━━━━

## ⏳ Délai de réponse

Après l’ouverture de ton ticket, tu disposes de **24 heures maximum** pour répondre.

*⚠️ Sans réponse dans ce délai, le ticket sera fermé automatiquement.*
*⚠️ Les abus pourront entraîner un refus de futurs tickets.*

━━━━━━━━━━━━━━━━━━

## 📖 Règlement

Le règlement s’applique également aux tickets.
Merci de rester **respectueux, poli et compréhensif** envers l’ensemble du **<@&${STAFF_ROLE}> de HoveX.**

🔗 Règlement :
https://discord.com/channels/1455368732296872160/1456080760548360340

━━━━━━━━━━━━━━━━━━

## 👥 Recrutement

Tu souhaites intégrer notre équipe ?

Merci de passer par le salon dédié :

🔗 Salon effectif :
https://discord.com/channels/1455368732296872160/1476306338395983945`,
            components: [row]
        });
    });

    // Interaction menu
    client.on('interactionCreate', async interaction => {
        if (!interaction.isStringSelectMenu()) return;
        if (interaction.customId !== 'ticket_select') return;

        const categoryKey = interaction.values[0];
        const category = ticketCategories[categoryKey];

        // Vérifie si l'utilisateur a déjà un ticket pour cette catégorie
        const existingChannel = interaction.guild.channels.cache.find(
            c => c.name === `ticket-${interaction.user.id}-${categoryKey}`
        );
        if (existingChannel) {
            return interaction.reply({ content: "Vous avez déjà un ticket ouvert pour cette catégorie.", ephemeral: true });
        }

        // Création du salon
        const channel = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.id}-${categoryKey}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                ...category.roleIds.map(role => ({ id: role, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }))
            ]
        });

        // Message d'accueil + boutons
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('delete_ticket').setLabel('Delete').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('thread_staff').setLabel('Thread Staff').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('reminder_user').setLabel('Rappel').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('reminder_staff').setLabel('Rappel Staff').setStyle(ButtonStyle.Success)
        );

        // Mention everyone uniquement dans le ticket
        await channel.send({ content: `@everyone\nBonjour <@${interaction.user.id}>, merci d'avoir ouvert un ticket pour **${category.name}**.\n\n${category.message}`, components: [buttons] });

        interaction.reply({ content: `Votre ticket a été créé : ${channel}`, ephemeral: true });
    });

    // Interaction boutons
    client.on('interactionCreate', async interaction => {
        if (!interaction.isButton()) return;
        const channel = interaction.channel;
        const member = interaction.member;

        if (!channel.name.startsWith('ticket-')) return;

        switch(interaction.customId) {
            case 'claim_ticket':
                if (!member.roles.cache.has(STAFF_ROLE)) return interaction.reply({ content: "Seulement le staff peut claim.", ephemeral: true });
                await interaction.reply({ content: `<@${member.id}> a pris en charge ce ticket.`, ephemeral: false });
                break;

            case 'close_ticket':
                if (!member.roles.cache.has(STAFF_ROLE)) return interaction.reply({ content: "Seulement le staff peut fermer.", ephemeral: true });
                await interaction.reply({ content: "Ticket fermé, mais le salon reste ouvert pour consultation.", ephemeral: false });
                break;

            case 'delete_ticket':
                if (!member.roles.cache.has(STAFF_ROLE)) return interaction.reply({ content: "Seulement le staff peut supprimer.", ephemeral: true });
                await channel.delete();
                break;

            case 'thread_staff':
                if (!member.roles.cache.has(STAFF_ROLE)) return interaction.reply({ content: "Seulement le staff peut créer un thread.", ephemeral: true });
                const thread = await channel.threads.create({ name: `Staff Discussion`, autoArchiveDuration: 60, reason: 'Thread pour staff' });
                await interaction.reply({ content: `Thread créé : ${thread}`, ephemeral: false });
                break;

            case 'reminder_user':
                await interaction.reply({ content: `Rappel envoyé à <@${channel.name.split('-')[1]}>`, ephemeral: false });
                break;

            case 'reminder_staff':
                await interaction.reply({ content: `Rappel envoyé au staff`, ephemeral: false });
                break;
        }
    });

};
