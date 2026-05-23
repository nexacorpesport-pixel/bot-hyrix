const {
    ChannelType,
    PermissionsBitField,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

// =========================================
// CONFIG
// =========================================

const TRIGGER_CHANNEL = "1507467019715481731";
const TEMP_CATEGORY = "1505330761153380476";

// =========================================
// STORAGE
// =========================================

const tempChannels = new Map();

// =========================================
// EXPORT
// =========================================

module.exports = (client) => {

    // =========================================
    // VOICE UPDATE
    // =========================================

    client.on("voiceStateUpdate", async (oldState, newState) => {

        try {

            const member = newState.member;

            if (!member) return;
            if (member.user.bot) return;

            // =========================================
            // CREATE TEMP CHANNEL
            // =========================================

            if (newState.channelId === TRIGGER_CHANNEL) {

                const guild = member.guild;

                const tempChannel = await guild.channels.create({

                    name: `🎧｜${member.user.username}`,

                    type: ChannelType.GuildVoice,

                    parent: TEMP_CATEGORY,

                    permissionOverwrites: [

                        {
                            id: guild.id,

                            allow: [
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.Connect
                            ]
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

                // SAVE

                tempChannels.set(tempChannel.id, {

                    owner: member.id,
                    createdAt: Date.now()

                });

                // MOVE USER

                await member.voice.setChannel(tempChannel)
                    .catch(() => {});

                // =========================================
                // EMBED
                // =========================================

                const embed = new EmbedBuilder()

                    .setColor("#2b2d31")

                    .setTitle("🎧 Salon Vocal Temporaire")

                    .setDescription(`
Bienvenue dans ton salon vocal temporaire.

Utilise les boutons ci-dessous pour gérer ton salon.

🔓 Ouvrir
🔒 Fermer
👁️ Privé
🧹 Purger
➕ Whitelist
🚫 Blacklist
🔁 Transférer
🎤 Micro
🎥 Vidéo
📣 Soundboard
📌 Statut
⚙️ Réglages
💾 Sauvegarder
                    `)

                    .setFooter({
                        text: "Pyxar Voice System"
                    });

                // =========================================
                // BUTTONS ROW 1
                // =========================================

                const row1 = new ActionRowBuilder()

                    .addComponents(

                        new ButtonBuilder()
                            .setCustomId("vc_open")
                            .setLabel("Ouvrir")
                            .setEmoji("🔓")
                            .setStyle(ButtonStyle.Success),

                        new ButtonBuilder()
                            .setCustomId("vc_lock")
                            .setLabel("Fermer")
                            .setEmoji("🔒")
                            .setStyle(ButtonStyle.Danger),

                        new ButtonBuilder()
                            .setCustomId("vc_private")
                            .setLabel("Privé")
                            .setEmoji("👁️")
                            .setStyle(ButtonStyle.Secondary),

                        new ButtonBuilder()
                            .setCustomId("vc_clear")
                            .setLabel("Purger")
                            .setEmoji("🧹")
                            .setStyle(ButtonStyle.Secondary),

                        new ButtonBuilder()
                            .setCustomId("vc_whitelist")
                            .setLabel("Whitelist")
                            .setEmoji("➕")
                            .setStyle(ButtonStyle.Primary)

                    );

                // =========================================
                // BUTTONS ROW 2
                // =========================================

                const row2 = new ActionRowBuilder()

                    .addComponents(

                        new ButtonBuilder()
                            .setCustomId("vc_blacklist")
                            .setLabel("Blacklist")
                            .setEmoji("🚫")
                            .setStyle(ButtonStyle.Primary),

                        new ButtonBuilder()
                            .setCustomId("vc_transfer")
                            .setLabel("Transférer")
                            .setEmoji("🔁")
                            .setStyle(ButtonStyle.Primary),

                        new ButtonBuilder()
                            .setCustomId("vc_mic")
                            .setLabel("Micro")
                            .setEmoji("🎤")
                            .setStyle(ButtonStyle.Secondary),

                        new ButtonBuilder()
                            .setCustomId("vc_video")
                            .setLabel("Vidéo")
                            .setEmoji("🎥")
                            .setStyle(ButtonStyle.Secondary),

                        new ButtonBuilder()
                            .setCustomId("vc_soundboard")
                            .setLabel("Soundboard")
                            .setEmoji("📣")
                            .setStyle(ButtonStyle.Secondary)

                    );

                // =========================================
                // BUTTONS ROW 3
                // =========================================

                const row3 = new ActionRowBuilder()

                    .addComponents(

                        new ButtonBuilder()
                            .setCustomId("vc_status")
                            .setLabel("Statut")
                            .setEmoji("📌")
                            .setStyle(ButtonStyle.Secondary),

                        new ButtonBuilder()
                            .setCustomId("vc_settings")
                            .setLabel("Réglages")
                            .setEmoji("⚙️")
                            .setStyle(ButtonStyle.Secondary),

                        new ButtonBuilder()
                            .setCustomId("vc_save")
                            .setLabel("Sauvegarder")
                            .setEmoji("💾")
                            .setStyle(ButtonStyle.Success)

                    );

                // =========================================
                // SEND PANEL
                // =========================================

                await tempChannel.send({

                    embeds: [embed],

                    components: [row1, row2, row3]

                }).catch(() => {});

            }

            // =========================================
            // DELETE EMPTY CHANNEL
            // =========================================

            const oldChannel = oldState.channel;

            if (!oldChannel) return;

            if (tempChannels.has(oldChannel.id)) {

                setTimeout(async () => {

                    const fetched =
                        await oldChannel.fetch()
                            .catch(() => null);

                    if (!fetched) return;

                    if (fetched.members.size === 0) {

                        tempChannels.delete(oldChannel.id);

                        await fetched.delete()
                            .catch(() => {});

                    }

                }, 60000);

            }

        } catch (err) {

            console.log("[VOICE ERROR]", err);

        }

    });

    // =========================================
    // BUTTON INTERACTIONS
    // =========================================

    client.on("interactionCreate", async (interaction) => {

        try {

            if (!interaction.isButton()) return;

            const voiceChannel = interaction.channel;

            if (!voiceChannel) return;

            if (!tempChannels.has(voiceChannel.id)) return;

            switch (interaction.customId) {

                case "vc_open":

                    await voiceChannel.permissionOverwrites.edit(
                        interaction.guild.id,
                        {
                            Connect: true
                        }
                    );

                    return interaction.reply({

                        content: "🔓 Salon ouvert.",

                        ephemeral: true

                    });

                case "vc_lock":

                    await voiceChannel.permissionOverwrites.edit(
                        interaction.guild.id,
                        {
                            Connect: false
                        }
                    );

                    return interaction.reply({

                        content: "🔒 Salon fermé.",

                        ephemeral: true

                    });

                case "vc_private":

                    await voiceChannel.permissionOverwrites.edit(
                        interaction.guild.id,
                        {
                            Connect: false
                        }
                    );

                    await voiceChannel.permissionOverwrites.edit(
                        interaction.user.id,
                        {
                            Connect: true
                        }
                    );

                    return interaction.reply({

                        content: "👁️ Mode privé activé.",

                        ephemeral: true

                    });

                default:

                    return interaction.reply({

                        content: "⚙️ Fonction bientôt disponible.",

                        ephemeral: true

                    });

            }

        } catch (err) {

            console.log("[BUTTON ERROR]", err);

        }

    });

};
