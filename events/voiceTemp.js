const {
    ChannelType,
    PermissionsBitField,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const TRIGGER_CHANNEL = "1505330764823265350";
const TEMP_CATEGORY = "1505330761153380476";

const tempChannels = new Map();

module.exports = (client) => {

    client.on("voiceStateUpdate", async (oldState, newState) => {

        const member = newState.member;

        if (!member || member.user.bot) return;

        // =========================================
        // JOIN TRIGGER
        // =========================================

        if (newState.channelId === TRIGGER_CHANNEL) {

            const guild = member.guild;

            const channel = await guild.channels.create({
                name: `🎧｜${member.user.username}`,
                type: ChannelType.GuildVoice,
                parent: TEMP_CATEGORY,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect]
                    },
                    {
                        id: member.id,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.Connect,
                            PermissionsBitField.Flags.Speak,
                            PermissionsBitField.Flags.ManageChannels
                        ]
                    }
                ]
            });

            tempChannels.set(channel.id, {
                owner: member.id,
                createdAt: Date.now()
            });

            await member.voice.setChannel(channel).catch(() => {});

            // =========================
            // PANEL MESSAGE
            // =========================

            const embed = new EmbedBuilder()
                .setColor("#2b2d31")
                .setTitle("🎧 Salon Vocal Temporaire")
                .setDescription(`
Bienvenue dans ton salon vocal.

Utilise les boutons ci-dessous pour gérer ton salon.
                `);

            const row = new ActionRowBuilder().addComponents(

                new ButtonBuilder().setCustomId("vc_open").setLabel("Ouvrir").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId("vc_lock").setLabel("Fermer").setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId("vc_private").setLabel("Privé").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("vc_clear").setLabel("Purger").setStyle(ButtonStyle.Secondary),

                new ButtonBuilder().setCustomId("vc_whitelist").setLabel("Whitelist").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("vc_blacklist").setLabel("Blacklist").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("vc_transfer").setLabel("Transférer").setStyle(ButtonStyle.Primary),

                new ButtonBuilder().setCustomId("vc_mic").setLabel("Micro").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("vc_video").setLabel("Vidéo").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("vc_soundboard").setLabel("Soundboard").setStyle(ButtonStyle.Secondary),

                new ButtonBuilder().setCustomId("vc_status").setLabel("Statut").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("vc_settings").setLabel("Réglages").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("vc_save").setLabel("Sauvegarder").setStyle(ButtonStyle.Success)
            );

            await channel.send({
                embeds: [embed],
                components: [row]
            });
        }

        // =========================================
        // LEAVE CLEANUP
        // =========================================

        const channel = oldState.channel;

        if (!channel) return;

        if (tempChannels.has(channel.id)) {

            setTimeout(async () => {

                const updated = await channel.fetch().catch(() => null);

                if (!updated) return;

                if (updated.members.size === 0) {

                    tempChannels.delete(channel.id);

                    await channel.delete().catch(() => {});
                }

            }, 60000); // 1 minute

        }
    });

    // =========================================
    // BUTTONS (BASIC HANDLERS)
    // =========================================

    client.on("interactionCreate", async (interaction) => {

        if (!interaction.isButton()) return;

        const channel = interaction.channel;

        if (!channel) return;

        const isVC = tempChannels.has(channel.id);

        if (!isVC) return;

        const member = interaction.member;

        const perm = channel.permissionsFor(member);

        if (!perm) return;

        switch (interaction.customId) {

            case "vc_lock":
                await channel.permissionOverwrites.edit(channel.guild.id, {
                    Connect: false
                });
                return interaction.reply({ content: "🔒 Fermé", ephemeral: true });

            case "vc_open":
                await channel.permissionOverwrites.edit(channel.guild.id, {
                    Connect: true
                });
                return interaction.reply({ content: "🔓 Ouvert", ephemeral: true });

            case "vc_private":
                await channel.permissionOverwrites.edit(channel.guild.id, {
                    Connect: false
                });
                await channel.permissionOverwrites.edit(member.id, {
                    Connect: true
                });
                return interaction.reply({ content: "👁️ Privé activé", ephemeral: true });

            case "vc_clear":
                return interaction.reply({ content: "🧹 (à implémenter chat clear)", ephemeral: true });

            case "vc_transfer":
                return interaction.reply({ content: "🔁 (à implémenter transfert)", ephemeral: true });

            default:
                return interaction.reply({ content: "⚙️ Action non configurée", ephemeral: true });
        }
    });

};
