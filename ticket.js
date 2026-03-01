require('dotenv').config();
const express = require('express');
const {
    Client,
    GatewayIntentBits,
    ActivityType,
    ChannelType,
    PermissionsBitField,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const app = express();
const PORT = process.env.PORT || 3000;

const GUILD_ID = "1455368732296872160";
const MENU_CHANNEL_ID = "1456080763534442516";

const CATEGORIES = {
    joueur: "1456080701643292865",
    staff: "1456080698405294317",
    studio: "1456080703207899325",
    partenariat: "1456080705422627066",
    aide: "1456080710321438823"
};

const STAFF_ROLES = [
    "1456080567304192102",
    "1456080570881806456",
    "1456080569837555957",
    "1456080574451028042",
    "1456080576518947026",
    "1456080572957987001"
];
const JOUEUR_ROLES = [
    "1456080598795030793",
    "1456080585742094338",
    "1456080578397999115"
];
const PARTENAIRE_ROLE = "1456080588846006556";
const TEST_ROLE = "1456080580541284352";

let ticketCounter = 1;
const ticketInfos = new Map();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ============================
// READY
// ============================
client.once('ready', async () => {
    console.log(`✅ Connecté en tant que ${client.user.tag}`);

    // Statut dynamique
    const updateStatus = async () => {
        const guild = await client.guilds.fetch(GUILD_ID);
        const memberCount = guild.memberCount;
        const statuses = [
            { name: `${memberCount} membres`, type: ActivityType.Streaming, url: "https://twitch.tv/kyrelfn" },
            { name: "Surveille les membres", type: ActivityType.Streaming, url: "https://twitch.tv/kyrelfn" },
            { name: "Dev by Kyrel", type: ActivityType.Streaming, url: "https://twitch.tv/kyrelfn" }
        ];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        client.user.setActivity(randomStatus.name, { type: randomStatus.type, url: randomStatus.url });
    };
    updateStatus();
    setInterval(updateStatus, 30000);

    // Créer menu de sélection
    const menuChannel = await client.channels.fetch(MENU_CHANNEL_ID);
    try {
        const messages = await menuChannel.messages.fetch({ limit: 10 });
        for (const msg of messages.values()) if (msg.author.id === client.user.id) await msg.delete().catch(() => {});
    } catch(e) { console.log("Impossible de nettoyer le salon menu :", e); }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("ticket_select")
        .setPlaceholder("Choisis une catégorie")
        .addOptions([
            { label: "Devenir Joueur", value: "joueur" },
            { label: "Intégrer le staff", value: "staff" },
            { label: "Rejoindre Audiovisuel", value: "studio" },
            { label: "Signalement", value: "aide" },
            { label: "Besoin d'aide", value: "aide" },
            { label: "Partenariat", value: "partenariat" }
        ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await menuChannel.send({
        content: `# 🎫・Support & Recrutement — HoveX

━━━━━━━━━━━━━━━━━━

## ❓ Besoin d’aide ou envie de rejoindre l’aventure ?

Sélectionne la catégorie adaptée dans le menu ci-dessous afin d’ouvrir un ticket.

Un membre du <@&1476307954662899990> prendra ta demande en charge rapidement.

━━━━━━━━━━━━━━━━━━

## ⏳ Délai de réponse

Après l’ouverture de ton ticket, tu disposes de 24 heures maximum pour répondre.

━━━━━━━━━━━━━━━━━━

## 📖 Règlement

Merci de rester respectueux envers le staff HoveX.

━━━━━━━━━━━━━━━━━━

## 👥 Recrutement

Merci de passer par le salon dédié.`,
        components: [row]
    });
});

// ============================
// INTERACTIONS
// ============================
client.on("interactionCreate", async interaction => {
    try {
        if (interaction.isStringSelectMenu() && interaction.customId === "ticket_select") {
            const type = interaction.values[0];
            const categoryId = CATEGORIES[type];
            const ticketName = `${type}-${ticketCounter++}`;

            let roles = [...STAFF_ROLES];
            if (type === "joueur") roles.push(...JOUEUR_ROLES);
            if (type === "partenariat") roles.push(PARTENAIRE_ROLE);

            const perms = [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ];
            roles.forEach(r => perms.push({ id: r, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }));

            const ticket = await interaction.guild.channels.create({
                name: ticketName,
                type: ChannelType.GuildText,
                parent: categoryId,
                permissionOverwrites: perms
            });

            ticketInfos.set(ticket.id, { createdAt: Date.now(), rappelUser: false, rappelStaff: false, claimedBy: null });

            await ticket.send("@everyone").then(m => m.delete());

            if (type === "joueur") await ticket.send(`🎮 FORMULAIRE JOUEUR HoveX\n\nPseudo :\nPseudo Epic Games :\nPlateforme :\nÂge :\nPays :\nDisponibilités :\nNiveau / Expérience :\n\nMotivation :\n\nPoints forts :\n\nAnciennes équipes :\n\nAutres informations utiles :`);
            else if (type === "staff") await ticket.send(`🛡️ CANDIDATURE STAFF HoveX\n\nPseudo Discord :\nID Discord :\nÂge :\nPays :\nDisponibilités :\n\nExpérience staff :\n\nBots utilisés :\n\nPourquoi HoveX ?\n\nQualités :\n\nRéaction face à conflit / raid / spam :`);
            else await ticket.send("📌 Panel en cours de préparation.");

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("delete").setLabel("Delete").setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId("thread").setLabel("Thread Staff").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId("rappel_user").setLabel("Rappel User").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("rappel_staff").setLabel("Rappel Staff").setStyle(ButtonStyle.Secondary)
            );
            await ticket.send({ components: [buttons] });

            return interaction.reply({ content: "Ticket créé !", ephemeral: true });
        }

        if (interaction.isButton()) {
            const data = ticketInfos.get(interaction.channel.id);
            if (!data) return;

            const isStaff = interaction.member.roles.cache.some(r => STAFF_ROLES.includes(r.id));

            switch (interaction.customId) {
                case "claim":
                    if (!isStaff) return interaction.reply({ content: "Réservé au staff.", ephemeral: true });
                    data.claimedBy = interaction.user.id;
                    interaction.channel.send(`Ticket pris en charge par ${interaction.user}`);
                    return interaction.reply({ content: "Ticket claim.", ephemeral: true });

                case "close":
                    if (!isStaff) return interaction.reply({ content: "Réservé au staff.", ephemeral: true });
                    await interaction.channel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: false });
                    return interaction.reply({ content: "Ticket fermé.", ephemeral: true });

                case "delete":
                    if (!isStaff) return interaction.reply({ content: "Réservé au staff.", ephemeral: true });
                    return interaction.channel.delete();

                case "thread":
                    if (!isStaff) return interaction.reply({ content: "Réservé au staff.", ephemeral: true });
                    await interaction.channel.threads.create({ name: "Discussion Staff", autoArchiveDuration: 60 });
                    return interaction.reply({ content: "Thread créé.", ephemeral: true });

                case "rappel_user":
                    if (data.rappelUser) return interaction.reply({ content: "Déjà utilisé.", ephemeral: true });
                    if (Date.now() - data.createdAt < 86400000) return interaction.reply({ content: "Disponible après 24h.", ephemeral: true });
                    data.rappelUser = true;
                    interaction.channel.send("⏰ Merci de répondre à ton ticket.");
                    return interaction.reply({ content: "Rappel envoyé.", ephemeral: true });

                case "rappel_staff":
                    if (data.rappelStaff) return interaction.reply({ content: "Déjà utilisé.", ephemeral: true });
                    if (Date.now() - data.createdAt < 86400000) return interaction.reply({ content: "Disponible après 24h.", ephemeral: true });
                    data.rappelStaff = true;
                    interaction.channel.send("⏰ Staff merci de répondre au ticket.");
                    return interaction.reply({ content: "Rappel staff envoyé.", ephemeral: true });
            }
        }

    } catch (err) {
        console.error("Erreur interaction : ", err);
    }
});

// ============================
// COMMANDE TEST MODO
// ============================
client.on("messageCreate", async message => {
    if (!message.content.startsWith("!test")) return;
    if (!message.member.roles.cache.has(TEST_ROLE)) return;
    const member = message.mentions.members.first();
    if (!member) return message.reply("Mentionne un utilisateur à tester.");

    message.channel.send(`Bonjour ${member}\n\nDans le cadre de notre formation modérateur HoveX,\nnous formons directement dans les tickets.\nSoyez bienveillants avec lui.`);
});

// ============================
// LOGIN & EXPRESS
// ============================
client.login(process.env.TOKEN);

app.get('/', (req, res) => res.send('🚀 Bot HoveX actif !'));
app.listen(PORT, () => console.log(`🌐 Serveur web actif sur le port ${PORT}`));
