const {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    PermissionsBitField,
    ChannelType
} = require("discord.js");

module.exports = async (client, member) => {

    try {

        // ===== IDS =====

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

        const VERIFIED_ROLE = "1505330731193335920";
        const MEMBER_ROLE = "1505330732187521035";

        const WELCOME_CHANNEL = "1505330766047875242";

        // ===== ROLE ARRIVEE =====

        const arriveRole = member.guild.roles.cache.get(ARRIVE_ROLE);

        if (arriveRole) {
            await member.roles.add(arriveRole);
        }

        // ===== CREATE CHANNEL =====

        const channel = await member.guild.channels.create({
            name: `${member.user.username}`,
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

        // ===== EMBED =====

        const embed = new EmbedBuilder()
            .setColor("#ffb347")
            .setTitle("✨ Bienvenue sur Pixar")
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
                text: "Pixar"
            });

        // ===== MENU GENRE =====

        const genreMenu = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId("genre")
                    .setPlaceholder("Choisis ton genre")
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

        // ===== MENU NOTIFS =====

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

        // ===== MENU OBJECTIF =====

        const objectifMenu = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId("objectif")
                    .setPlaceholder("Choisis ton objectif")
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

        // ===== MENU REGLEMENT =====

        const reglementMenu = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId("reglement")
                    .setPlaceholder("Accepter le règlement")
                    .addOptions([
                        {
                            label: "J'accepte le règlement",
                            value: "accept"
                        }
                    ])
            );

        // ===== SEND =====

        await channel.send({
            content: `${member}`,
            embeds: [embed],
            components: [
                genreMenu,
                notifMenu,
                objectifMenu,
                reglementMenu
            ]
        });

        // ===== LOG CHANNEL =====

        const welcomeChannel = member.guild.channels.cache.get(WELCOME_CHANNEL);

        if (welcomeChannel) {

            await welcomeChannel.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#ffb347")
                        .setDescription(`✨ ${member} vient de rejoindre Pixar`)
                ]
            });

        }

        // ===== INTERACTION =====

        const collector = channel.createMessageComponentCollector({
            time: 600000
        });

        let genreDone = false;
        let notifDone = false;
        let objectifDone = false;
        let reglementDone = false;

        collector.on("collect", async (interaction) => {

            if (interaction.user.id !== member.id) {
                return interaction.reply({
                    content: "❌ Ce menu ne t'appartient pas.",
                    ephemeral: true
                });
            }

            // ===== GENRE =====

            if (interaction.customId === "genre") {

                genreDone = true;

                if (interaction.values[0] === "homme") {
                    await member.roles.add(HOMME_ROLE);
                }

                if (interaction.values[0] === "femme") {
                    await member.roles.add(FEMME_ROLE);
                }

                if (interaction.values[0] === "np") {
                    await member.roles.add(NP_ROLE);
                }

                await interaction.reply({
                    content: "✅ Genre enregistré",
                    ephemeral: true
                });

            }

            // ===== NOTIFS =====

            if (interaction.customId === "notif") {

                notifDone = true;

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

                await interaction.reply({
                    content: "✅ Notifications enregistrées",
                    ephemeral: true
                });

            }

            // ===== OBJECTIF =====

            if (interaction.customId === "objectif") {

                objectifDone = true;

                if (interaction.values[0] === "joueur") {
                    await member.roles.add(JOUEUR_ROLE);
                }

                if (interaction.values[0] === "staff") {
                    await member.roles.add(STAFF_ROLE);
                }

                await interaction.reply({
                    content: "✅ Objectif enregistré",
                    ephemeral: true
                });

            }

            // ===== REGLEMENT =====

            if (interaction.customId === "reglement") {

                reglementDone = true;

                await member.roles.add(ACCESS_ROLE);
                await member.roles.add(VERIFIED_ROLE);
                await member.roles.add(MEMBER_ROLE);

                await interaction.reply({
                    content: "✅ Règlement accepté",
                    ephemeral: true
                });

            }

            // ===== FIN =====

            if (
                genreDone &&
                notifDone &&
                objectifDone &&
                reglementDone
            ) {

                await channel.send("✅ Onboarding terminé.");

                setTimeout(async () => {

                    await channel.delete().catch(() => {});

                }, 5000);

            }

        });

    } catch (err) {

        console.log(err);

    }

};
