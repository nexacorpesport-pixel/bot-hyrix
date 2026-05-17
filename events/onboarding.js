const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionsBitField,
    ChannelType
} = require("discord.js");

module.exports = async (client, member) => {

    try {

        // ===== IDs =====

        const ROLE_ARRIVANT = "1505625588121997572";

        const ROLE_HOMME = "1505330737187131544";
        const ROLE_FEMME = "1505330738772574208";
        const ROLE_NOP = "1505330739753783458";

        const ROLE_ANNONCES = "1505330743721721956";
        const ROLE_LIVES = "1505330746301354024";
        const ROLE_EVENTS = "1505330745072156904";
        const ROLE_RESEAUX = "1505625990359945318";

        const ROLE_JOUEUR = "1505330740869599383";
        const ROLE_STAFF = "1505330738772574208";

        const ROLE_GENERAL = "1505330734842515586";

        const ROLE_MEMBRE_1 = "1505330731193335920";
        const ROLE_MEMBRE_2 = "1505330732187521035";

        const ROLE_CEO = "1505330692106485781";

        const CHANNEL_BIENVENUE = "1505330766047875242";

        // ===== ROLE ARRIVANT =====

        await member.roles.add(ROLE_ARRIVANT);

        // ===== SAFE USERNAME =====

        const safeName = member.user.username
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "-")
            .slice(0, 20);

        // ===== CREATE CHANNEL =====

        const channel = await member.guild.channels.create({
            name: safeName,

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
                },

                {
                    id: ROLE_CEO,
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages
                    ]
                }

            ]
        });

        // ===== EMBED =====

        const embed = new EmbedBuilder()
            .setColor("#ffae00")
            .setTitle("✨ Bienvenue sur Pixar")
            .setDescription(
                `Bienvenue ${member}.\n\n` +
                `Merci de compléter ton onboarding.\n\n` +
                `• Choisis ton genre\n` +
                `• Choisis tes notifications\n` +
                `• Choisis ton objectif\n` +
                `• Passe le captcha\n` +
                `• Accepte le règlement\n\n` +
                `Une fois terminé, ton accès sera débloqué automatiquement.\n\n` +
                `Si tu rencontres un problème, utilise le bouton aide ci-dessous.`
            )
            .setThumbnail(member.user.displayAvatarURL({
                dynamic: true
            }))
            .setFooter({
                text: "Pixar • Onboarding"
            })
            .setTimestamp();

        // ===== GENRE =====

        const genreRow = new ActionRowBuilder().addComponents(

            new ButtonBuilder()
                .setCustomId("homme")
                .setLabel("Homme")
                .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
                .setCustomId("femme")
                .setLabel("Femme")
                .setStyle(ButtonStyle.Danger),

            new ButtonBuilder()
                .setCustomId("nop")
                .setLabel("Non précisé")
                .setStyle(ButtonStyle.Secondary)
        );

        // ===== NOTIFS =====

        const notifRow = new ActionRowBuilder().addComponents(

            new ButtonBuilder()
                .setCustomId("annonces")
                .setLabel("Annonces")
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId("lives")
                .setLabel("Lives")
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId("events")
                .setLabel("Events")
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId("reseaux")
                .setLabel("Réseaux")
                .setStyle(ButtonStyle.Success)
        );

        // ===== OBJECTIF =====

        const objectifRow = new ActionRowBuilder().addComponents(

            new ButtonBuilder()
                .setCustomId("joueur")
                .setLabel("Devenir joueur")
                .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
                .setCustomId("staff")
                .setLabel("Devenir staff")
                .setStyle(ButtonStyle.Primary)
        );

        // ===== CAPTCHA =====

        const captchaRow = new ActionRowBuilder().addComponents(

            new ButtonBuilder()
                .setCustomId("captcha")
                .setLabel("Passer le captcha")
                .setStyle(ButtonStyle.Secondary)
        );

        // ===== REGLEMENT =====

        const reglementRow = new ActionRowBuilder().addComponents(

            new ButtonBuilder()
                .setCustomId("accept")
                .setLabel("Accepter le règlement")
                .setStyle(ButtonStyle.Success)
        );

        // ===== HELP =====

        const helpRow = new ActionRowBuilder().addComponents(

            new ButtonBuilder()
                .setCustomId("help")
                .setLabel("Besoin d'aide")
                .setStyle(ButtonStyle.Danger)
        );

        // ===== SEND =====

        await channel.send({

            content: `${member}`,

            embeds: [embed],

            components: [
                genreRow,
                notifRow,
                objectifRow,
                captchaRow,
                reglementRow,
                helpRow
            ]

        });

        console.log(`✅ Onboarding créé pour ${member.user.tag}`);

        // ===== INTERACTIONS =====

        client.on("interactionCreate", async (interaction) => {

            if (!interaction.isButton()) return;

            if (interaction.user.id !== member.id) return;

            // ===== GENRE =====

            if (interaction.customId === "homme") {

                await member.roles.add([
                    ROLE_HOMME,
                    ROLE_GENERAL
                ]);

                interaction.reply({
                    content: "✅ Rôle Homme ajouté.",
                    ephemeral: true
                });
            }

            if (interaction.customId === "femme") {

                await member.roles.add([
                    ROLE_FEMME,
                    ROLE_GENERAL
                ]);

                interaction.reply({
                    content: "✅ Rôle Femme ajouté.",
                    ephemeral: true
                });
            }

            if (interaction.customId === "nop") {

                await member.roles.add([
                    ROLE_NOP,
                    ROLE_GENERAL
                ]);

                interaction.reply({
                    content: "✅ Rôle ajouté.",
                    ephemeral: true
                });
            }

            // ===== NOTIFS =====

            if (interaction.customId === "annonces") {

                await member.roles.add(ROLE_ANNONCES);

                interaction.reply({
                    content: "✅ Notifications annonces activées.",
                    ephemeral: true
                });
            }

            if (interaction.customId === "lives") {

                await member.roles.add(ROLE_LIVES);

                interaction.reply({
                    content: "✅ Notifications lives activées.",
                    ephemeral: true
                });
            }

            if (interaction.customId === "events") {

                await member.roles.add(ROLE_EVENTS);

                interaction.reply({
                    content: "✅ Notifications events activées.",
                    ephemeral: true
                });
            }

            if (interaction.customId === "reseaux") {

                await member.roles.add(ROLE_RESEAUX);

                interaction.reply({
                    content: "✅ Notifications réseaux activées.",
                    ephemeral: true
                });
            }

            // ===== OBJECTIF =====

            if (interaction.customId === "joueur") {

                await member.roles.add(ROLE_JOUEUR);

                interaction.reply({
                    content: "🎮 Objectif joueur sélectionné.",
                    ephemeral: true
                });
            }

            if (interaction.customId === "staff") {

                await member.roles.add(ROLE_STAFF);

                interaction.reply({
                    content: "🛡 Objectif staff sélectionné.",
                    ephemeral: true
                });
            }

            // ===== CAPTCHA =====

            if (interaction.customId === "captcha") {

                interaction.reply({
                    content: "✅ Captcha validé.",
                    ephemeral: true
                });
            }

            // ===== HELP =====

            if (interaction.customId === "help") {

                interaction.reply({
                    content: `<@&${ROLE_CEO}> Un membre a besoin d'aide.`,
                    ephemeral: false
                });
            }

            // ===== ACCEPT =====

            if (interaction.customId === "accept") {

                await member.roles.add([
                    ROLE_MEMBRE_1,
                    ROLE_MEMBRE_2
                ]);

                await member.roles.remove(ROLE_ARRIVANT);

                const welcomeChannel = member.guild.channels.cache.get(CHANNEL_BIENVENUE);

                if (welcomeChannel) {

                    welcomeChannel.send({
                        content: `✨ Bienvenue officiellement ${member} sur Pixar !`
                    });
                }

                interaction.reply({
                    content: "✅ Onboarding terminé.",
                    ephemeral: true
                });

                setTimeout(() => {
                    channel.delete().catch(() => {});
                }, 5000);
            }

        });

        console.log(`✅ Message onboarding envoyé à ${member.user.tag}`);

    } catch (error) {

        console.log("❌ ERREUR ONBOARDING");
        console.error(error);

    }

};
