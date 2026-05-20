const {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionsBitField,
    ChannelType
} = require("discord.js");

module.exports = async (client, member) => {

    try {

        // =========================================
        // IDS
        // =========================================

        const ARRIVE_ROLE = "1505625588121997572";

        const HOMME_ROLE = "1505330737187131544";
        const FEMME_ROLE = "1505330738772574208";
        const NP_ROLE = "1505330739753783458";

        const ANNONCES_ROLE = "1505330743721721956";
        const LIVES_ROLE = "1505330746301354024";
        const EVENTS_ROLE = "1505330745072156904";
        const RESEAUX_ROLE = "1505625990359945318";

        const JOUEUR_ROLE = "1505330740869599383";
        const STAFF_ROLE = "1505330738772574208";

        const ACCESS_ROLE = "1505330734842515586";

        // ROLES APRÈS CAPTCHA UNIQUEMENT
        const VERIFIED_ROLE = "1505330731193335920";
        const MEMBER_ROLE = "1505330732187521035";

        const CEO_ROLE = "1505330692106485781";

        const BIENVENUE_CHANNEL = "1505330766047875242";

        // =========================================
        // ROLE ARRIVEE
        // =========================================

        const arriveRole = member.guild.roles.cache.get(ARRIVE_ROLE);

        if (arriveRole) {
            await member.roles.add(arriveRole).catch(() => {});
        }

        // =========================================
        // CREATE CHANNEL
        // =========================================

        const channel = await member.guild.channels.create({
            name: member.user.username.toLowerCase(),

            type: ChannelType.GuildText,

            permissionOverwrites: [

                {
                    id: member.guild.id,

                    deny: [
                        PermissionsBitField.Flags.ViewChannel
                    ]
                },

                {
                    id: member.id,

                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.ReadMessageHistory
                    ]
                }

            ]
        });

        // =========================================
        // HELP BUTTON
        // =========================================

        const helpButton = new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId("help")
                    .setLabel("Besoin d'aide")
                    .setStyle(ButtonStyle.Secondary)

            );

        // =========================================
        // QUESTION 1
        // =========================================

        const genreMenu = new ActionRowBuilder()
            .addComponents(

                new StringSelectMenuBuilder()
                    .setCustomId("genre")
                    .setPlaceholder("Choisis ton genre")
                    .setMinValues(1)
                    .setMaxValues(1)

                    .addOptions([
                        {
                            label: "Homme",
                            value: "homme"
                        },
                        {
                            label: "Femme",
                            value: "femme"
                        },
                        {
                            label: "Non précisé",
                            value: "np"
                        }
                    ])

            );

        const welcomeEmbed = new EmbedBuilder()

            .setColor("#ffb347")

            .setTitle("✨ Bienvenue sur Pyxar")

            .setDescription(`
Bienvenue ${member}

Nous sommes heureux de t'accueillir dans notre communauté.

Merci de compléter ton onboarding afin d'accéder au serveur.

📌 Étapes :
• Choisir ton genre
• Choisir tes notifications
• Choisir ton objectif
• Accepter le règlement
• Compléter le captcha

Une fois terminé, ton accès sera automatiquement débloqué.
`)

            .setFooter({
                text: "Pyxar"
            });

        await channel.send({

            content: `${member}`,

            embeds: [welcomeEmbed],

            components: [
                genreMenu,
                helpButton
            ]

        });

        // =========================================
        // COLLECTOR
        // =========================================

        const collector = channel.createMessageComponentCollector({
            time: 600000
        });

        collector.on("collect", async (interaction) => {

            if (interaction.user.id !== member.id) {

                return interaction.reply({
                    content: "❌ Ce menu ne t'appartient pas.",
                    ephemeral: true
                });

            }

            // =========================================
            // HELP
            // =========================================

            if (interaction.customId === "help") {

                return interaction.reply({

                    content:
                    `<@&${CEO_ROLE}> assistance demandée par ${member}.`,

                    ephemeral: false

                });

            }

            // =========================================
            // GENRE
            // =========================================

            if (interaction.customId === "genre") {

                const value = interaction.values[0];

                if (value === "homme") {
                    await member.roles.add(HOMME_ROLE);
                }

                if (value === "femme") {
                    await member.roles.add(FEMME_ROLE);
                }

                if (value === "np") {
                    await member.roles.add(NP_ROLE);
                }

                await interaction.message.delete().catch(() => {});

                // =========================================
                // NOTIFS
                // =========================================

                const notifMenu = new ActionRowBuilder()
                    .addComponents(

                        new StringSelectMenuBuilder()
                            .setCustomId("notif")
                            .setPlaceholder("Choisis tes notifications")
                            .setMinValues(1)
                            .setMaxValues(4)

                            .addOptions([
                                {
                                    label: "Annonces",
                                    value: "annonces"
                                },
                                {
                                    label: "Lives",
                                    value: "lives"
                                },
                                {
                                    label: "Events",
                                    value: "events"
                                },
                                {
                                    label: "Réseaux",
                                    value: "reseaux"
                                }
                            ])

                    );

                const notifEmbed = new EmbedBuilder()

                    .setColor("#ffb347")

                    .setTitle("🔔 Notifications")

                    .setDescription(`
Choisis les notifications que tu souhaites recevoir.
`);

                await interaction.reply({
                    embeds: [notifEmbed],
                    components: [notifMenu, helpButton]
                });

            }

            // =========================================
            // NOTIFS
            // =========================================

            if (interaction.customId === "notif") {

                if (interaction.values.includes("annonces")) {
                    await member.roles.add(ANNONCES_ROLE);
                }

                if (interaction.values.includes("lives")) {
                    await member.roles.add(LIVES_ROLE);
                }

                if (interaction.values.includes("events")) {
                    await member.roles.add(EVENTS_ROLE);
                }

                if (interaction.values.includes("reseaux")) {
                    await member.roles.add(RESEAUX_ROLE);
                }

                await interaction.message.delete().catch(() => {});

                // =========================================
                // OBJECTIF
                // =========================================

                const objectifMenu = new ActionRowBuilder()
                    .addComponents(

                        new StringSelectMenuBuilder()
                            .setCustomId("objectif")
                            .setPlaceholder("Choisis ton objectif")
                            .setMinValues(1)
                            .setMaxValues(1)

                            .addOptions([
                                {
                                    label: "Devenir joueur",
                                    value: "joueur"
                                },
                                {
                                    label: "Devenir staff",
                                    value: "staff"
                                }
                            ])

                    );

                const objectifEmbed = new EmbedBuilder()

                    .setColor("#ffb347")

                    .setTitle("🎯 Objectif")

                    .setDescription(`
Quel est ton objectif sur Pyxar ?
`);

                await interaction.reply({
                    embeds: [objectifEmbed],
                    components: [objectifMenu, helpButton]
                });

            }

            // =========================================
            // OBJECTIF
            // =========================================

            if (interaction.customId === "objectif") {

                const value = interaction.values[0];

                if (value === "joueur") {
                    await member.roles.add(JOUEUR_ROLE);
                }

                if (value === "staff") {
                    await member.roles.add(STAFF_ROLE);
                }

                await interaction.message.delete().catch(() => {});

                // =========================================
                // RULES
                // =========================================

                const rulesMenu = new ActionRowBuilder()
                    .addComponents(

                        new StringSelectMenuBuilder()
                            .setCustomId("rules")
                            .setPlaceholder("Accepter le règlement")
                            .setMinValues(1)
                            .setMaxValues(1)

                            .addOptions([
                                {
                                    label: "J'accepte le règlement",
                                    value: "accept"
                                }
                            ])

                    );

                const rulesEmbed = new EmbedBuilder()

                    .setColor("#ffb347")

                    .setTitle("📖 Règlement")

                    .setDescription(`
Merci d'accepter le règlement afin de continuer.
`);

                await interaction.reply({
                    embeds: [rulesEmbed],
                    components: [rulesMenu, helpButton]
                });

            }

            // =========================================
            // RULES
            // =========================================

            if (interaction.customId === "rules") {

                // PAS DE ROLE ICI
                // LES ROLES SERONT DONNÉS APRÈS CAPTCHA

                await interaction.message.delete().catch(() => {});

                // =========================================
                // CAPTCHA
                // =========================================

                const captcha =
                    Math.floor(1000 + Math.random() * 9000);

                member.captchaCode = captcha;

                const captchaEmbed = new EmbedBuilder()

                    .setColor("#ffb347")

                    .setTitle("🛡️ Captcha")

                    .setDescription(`
Merci d'envoyer le code suivant dans ce salon :

# ${captcha}
`);

                await interaction.reply({
                    embeds: [captchaEmbed]
                });

            }

        });

        // =========================================
        // CAPTCHA COLLECTOR
        // =========================================

        const msgCollector = channel.createMessageCollector({
            time: 600000
        });

        msgCollector.on("collect", async (msg) => {

            if (msg.author.bot) return;

            if (
                member.captchaCode &&
                msg.content !== member.captchaCode.toString()
            ) {

                return msg.reply("❌ Captcha incorrect.");

            }

            // =========================================
            // GOOD CAPTCHA
            // =========================================

            if (
                member.captchaCode &&
                msg.content === member.captchaCode.toString()
            ) {

                // =========================================
                // ROLES APRÈS CAPTCHA
                // =========================================

                await member.roles.add(ACCESS_ROLE).catch(() => {});
                await member.roles.add(VERIFIED_ROLE).catch(() => {});
                await member.roles.add(MEMBER_ROLE).catch(() => {});

                const successEmbed = new EmbedBuilder()

                    .setColor("#57f287")

                    .setTitle("✅ Vérification terminée")

                    .setDescription(`
Ton onboarding est terminé.

Bienvenue sur Pyxar.
Tu as maintenant accès au serveur.
`);

                await channel.send({
                    embeds: [successEmbed]
                });

                // =========================================
                // REDIRECTION
                // =========================================

                const bienvenue =
                    member.guild.channels.cache.get(BIENVENUE_CHANNEL);

                if (bienvenue) {

                    await member.send(`
✅ Ton onboarding est terminé.

➡️ Rendez-vous ici :
<#${BIENVENUE_CHANNEL}>
`).catch(() => {});

                }

                // =========================================
                // DELETE CHANNEL
                // =========================================

                setTimeout(async () => {

                    await channel.delete().catch(() => {});

                }, 5000);

            }

        });

    } catch (err) {

        console.log(err);

    }

};
