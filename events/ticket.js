// =====================================================
// TEST SIMPLE TICKET PANEL
// =====================================================

const {

    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle

} = require("discord.js");

module.exports = async (client) => {

    client.once("ready", async () => {

        console.log("✅ BOT CONNECTÉ");

        try {

            // =====================================================
            // FETCH CHANNEL
            // =====================================================

            const channel =
                await client.channels.fetch(
                    "1505330772343656680"
                );

            if (!channel) {

                return console.log(
                    "❌ CHANNEL INTROUVABLE"
                );

            }

            console.log("✅ CHANNEL TROUVÉ");

            // =====================================================
            // EMBED
            // =====================================================

            const embed =
                new EmbedBuilder()

                    .setColor("#ffb347")

                    .setTitle("🎫 TEST TICKET")

                    .setDescription(`
Ceci est un test.

Si ce message s'envoie :

✅ le bot fonctionne
✅ le salon fonctionne
✅ les permissions fonctionnent
✅ Discord.js fonctionne

Le problème viendra donc du système ticket principal.
                    `);

            // =====================================================
            // SELECT MENU
            // =====================================================

            const menu =
                new StringSelectMenuBuilder()

                    .setCustomId("test_menu")

                    .setPlaceholder(
                        "Choisis une option"
                    )

                    .addOptions([

                        {
                            label: "Option 1",
                            value: "one",
                            emoji: "🔥"
                        },

                        {
                            label: "Option 2",
                            value: "two",
                            emoji: "🎮"
                        }

                    ]);

            // =====================================================
            // BUTTONS
            // =====================================================

            const buttons =
                new ActionRowBuilder()

                    .addComponents(

                        new ButtonBuilder()

                            .setCustomId("test_button")

                            .setLabel("Test Button")

                            .setEmoji("✅")

                            .setStyle(
                                ButtonStyle.Success
                            )

                    );

            // =====================================================
            // MENU ROW
            // =====================================================

            const menuRow =
                new ActionRowBuilder()
                    .addComponents(menu);

            // =====================================================
            // SEND MESSAGE
            // =====================================================

            await channel.send({

                embeds: [embed],

                components: [

                    menuRow,
                    buttons

                ]

            });

            console.log(
                "✅ MESSAGE ENVOYÉ"
            );

        } catch (err) {

            console.log(
                "❌ ERREUR :"
            );

            console.log(err);

        }

    });

    // =====================================================
    // INTERACTIONS
    // =====================================================

    client.on("interactionCreate", async (interaction) => {

        // =====================================================
        // BUTTON TEST
        // =====================================================

        if (
            interaction.isButton() &&
            interaction.customId === "test_button"
        ) {

            await interaction.reply({

                content:
                "✅ Le bouton fonctionne.",

                ephemeral: true

            });

        }

        // =====================================================
        // MENU TEST
        // =====================================================

        if (
            interaction.isStringSelectMenu() &&
            interaction.customId === "test_menu"
        ) {

            await interaction.reply({

                content:
                `✅ Tu as choisi : ${interaction.values[0]}`,

                ephemeral: true

            });

        }

    });

};
