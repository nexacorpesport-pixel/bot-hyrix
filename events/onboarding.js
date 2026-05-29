const {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionsBitField,
    ChannelType
} = require("discord.js");

// Stockages temporaires en mémoire (RAM)
const captchaStorage = new Map();
const captchaAttempts = new Map();
const userChannels = new Map(); 
const renameChoice = new Map(); 

module.exports = (client) => {

    // =====================================================
    // 🛡️ CONFIGURATION DES IDENTIFIANTS (IDS)
    // =====================================================
    const CATEGORY_ONBOARDING = "1510048386626093217"; 
    const LOGS_CHANNEL = "1510039415454568569";

    // Configuration stricte des rôles demandés
    const ARRIVE_ROLE = "1505625588121997572"; // Donné à l'arrivée, retiré à la fin
    const MEMBRE_ROLE = "1505330732187521035"; // Donné après le captcha
    const VERIFIED_ROLE = "1505330731193335920"; // Donné après le captcha

    // Rôles optionnels (étapes de l'onboarding)
    const HOMME_ROLE = "1505330737187131544";
    const FEMME_ROLE = "1505330738772574208";
    const NP_ROLE = "1505330739753783458";

    const ANNONCES_ROLE = "1505330743721721956";
    const LIVES_ROLE = "1505330746301354024";
    const EVENTS_ROLE = "1505330745072156904";
    const RESEAUX_ROLE = "1505625990359945318";

    const JOUEUR_ROLE = "1505330740869599383";
    const STAFF_ROLE = "1505330741234567890";

    const BIENVENUE_CHANNEL = "1505330766047875242";
    const CEO_ROLE = "1505330692106485781";

    // Nettoyage des rôles si l'utilisateur clique sur "Recommencer"
    const clearOnboardingRoles = async (member) => {
        const rolesToRemove = [
            HOMME_ROLE, FEMME_ROLE, NP_ROLE, 
            ANNONCES_ROLE, LIVES_ROLE, EVENTS_ROLE, RESEAUX_ROLE, 
            JOUEUR_ROLE, STAFF_ROLE
        ];
        for (const roleId of rolesToRemove) {
            if (member.roles.cache.has(roleId)) {
                await member.roles.remove(roleId).catch(() => {});
            }
        }
    };

    // =====================================================
    // 🧹 NETTOYAGE DES SALONS AU REBOOT DU BOT
    // =====================================================
    client.once("ready", async () => {
        console.log("[ONBOARDING] Scan et nettoyage des salons temporaires abandonnés...");
        const category = await client.channels.fetch(CATEGORY_ONBOARDING).catch(() => null);
        if (category && category.type === ChannelType.GuildCategory) {
            category.children.cache.forEach(async (channel) => {
                if (channel.type === ChannelType.GuildText && (Date.now() - channel.createdTimestamp) > 1800000) {
                    await channel.delete().catch(() => {});
                }
            });
        }
    });

    // =====================================================
    // 🚪 SUPPRESSION AUTOMATIQUE SI LE MEMBRE QUITTE
    // =====================================================
    client.on("guildMemberRemove", async (member) => {
        const channelId = userChannels.get(member.id);
        if (channelId) {
            const channel = await member.guild.channels.fetch(channelId).catch(() => null);
            if (channel) await channel.delete().catch(() => {});
            
            userChannels.delete(member.id);
            captchaStorage.delete(member.id);
            captchaAttempts.delete(member.id);
            renameChoice.delete(member.id);
        }
    });

    // =====================================================
    // 👋 LOGIQUE COMMUNE D'ARRIVÉE SUR LE SERVEUR
    // =====================================================
    client.on("guildMemberAdd", async (member) => {
        try {
            if (member.user.bot) return;

            // 1. Attribution immédiate du rôle Arrivant
            await member.roles.add(ARRIVE_ROLE).catch((err) => {
                console.error("❌ Impossible d'attribuer le rôle Arrivant. Vérifie la hiérarchie de tes rôles.");
            });

            // 2. Création du salon textuel dédié à l'onboarding
            const channel = await member.guild.channels.create({
                name: `👋┃${member.user.username.toLowerCase()}`,
                type: ChannelType.GuildText,
                parent: CATEGORY_ONBOARDING,
                permissionOverwrites: [
                    { id: member.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    {
                        id: member.id,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ReadMessageHistory
                        ]
                    }
                ]
            }).catch((err) => {
                console.error("❌ Permissions insuffisantes pour créer le salon d'onboarding.");
                return null;
            });

            if (!channel) return;
            userChannels.set(member.id, channel.id);

            // Notification dans les logs du staff
            const logChan = await member.guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
            if (logChan) {
                logChan.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("Yellow")
                            .setDescription(`🛫 **Onboarding démarré** pour ${member} (\`${member.id}\`). Salon : <#${channel.id}>`)
                    ]
                }).catch(() => {});
            }

            // Boutons de navigation universels
            const helpButton = new ButtonBuilder().setCustomId("ob_help").setLabel("Besoin d'aide").setStyle(ButtonStyle.Secondary);
            const resetButton = new ButtonBuilder().setCustomId("ob_reset").setLabel("Recommencer").setStyle(ButtonStyle.Danger);
            const actionRowControls = new ActionRowBuilder().addComponents(helpButton, resetButton);

            // Fonction de structure pour l'étape 1
            const sendEtapeGenre = async (targetChannel, isReset = false) => {
                const genreMenu = new StringSelectMenuBuilder()
                    .setCustomId("ob_genre")
                    .setPlaceholder("🔮 Sélectionne ton genre...")
                    .addOptions([
                        { label: "Homme", value: "homme", emoji: "👨" },
                        { label: "Femme", value: "femme", emoji: "👩" },
                        { label: "Non précisé", value: "np", emoji: "👤" }
                    ]);

                const welcomeEmbed = new EmbedBuilder()
                    .setColor("#ffb347")
                    .setTitle("✨ Bienvenue sur Pyxar")
                    .setDescription(`Bonjour ${member},\n\nMerci de remplir ce formulaire pour valider ton accès au serveur.${isReset ? "\n\n🔄 *Ton parcours a été réinitialisé.*" : ""}\n\n**📊 Progression :**\n🟩⬜⬜⬜⬜⬜⬜ **1/7 (Genre)**`);

                const payload = {
                    content: `${member}`,
                    embeds: [welcomeEmbed],
                    components: [new ActionRowBuilder().addComponents(genreMenu), actionRowControls]
                };

                if (isReset) return payload;
                await targetChannel.send(payload);
            };

            await sendEtapeGenre(channel, false);

            const compCollector = channel.createMessageComponentCollector({ time: 600000 });
            const msgCollector = channel.createMessageCollector({ time: 600000 });

            compCollector.on("collect", async (interaction) => {
                if (interaction.user.id !== member.id) return interaction.reply({ content: "❌ Ce menu ne t'appartient pas.", ephemeral: true });

                if (interaction.customId === "ob_help") {
                    if (logChan) logChan.send({ content: `⚠️ Assistance demandée dans <#${channel.id}> par ${member}.` }).catch(() => {});
                    return interaction.reply({ content: `🔔 Demande d'assistance transmise au staff.`, ephemeral: false });
                }

                if (interaction.customId === "ob_reset") {
                    await clearOnboardingRoles(member);
                    renameChoice.delete(member.id);
                    await channel.setName(`👋┃${member.user.username.toLowerCase()}`).catch(() => {});
                    const resetPayload = await sendEtapeGenre(channel, true);
                    return interaction.update(resetPayload);
                }

                // ÉTAPE 1 -> ÉTAPE 2 (Genre)
                if (interaction.customId === "ob_genre") {
                    const value = interaction.values[0];
                    let prefix = "👋";

                    if (value === "homme") { await member.roles.add(HOMME_ROLE).catch(() => {}); prefix = "👨"; }
                    if (value === "femme") { await member.roles.add(FEMME_ROLE).catch(() => {}); prefix = "👩"; }
                    if (value === "np") { await member.roles.add(NP_ROLE).catch(() => {}); prefix = "👤"; }

                    await channel.setName(`${prefix}┃${member.user.username.toLowerCase()}`).catch(() => {});

                    const notifMenu = new StringSelectMenuBuilder()
                        .setCustomId("ob_notif")
                        .setPlaceholder("🔔 Choisis tes notifications...")
                        .setMinValues(1).setMaxValues(4)
                        .addOptions([
                            { label: "Annonces", value: "annonces", emoji: "📢" },
                            { label: "Lives", value: "lives", emoji: "🎥" },
                            { label: "Events", value: "events", emoji: "🎉" },
                            { label: "Réseaux", value: "reseaux", emoji: "🌐" }
                        ]);

                    const embed = new EmbedBuilder()
                        .setColor("#ffb347")
                        .setTitle("🔔 Rôles de Notification")
                        .setDescription(`Sélectionne les mentions que tu souhaites recevoir.\n\n**📊 Progression :**\n🟩🟩⬜⬜⬜⬜⬜ **2/7 (Notifications)**`);

                    return interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(notifMenu), actionRowControls] });
                }

                // ÉTAPE 2 -> ÉTAPE 3 (Notifications)
                if (interaction.customId === "ob_notif") {
                    if (interaction.values.includes("annonces")) await member.roles.add(ANNONCES_ROLE).catch(() => {});
                    if (interaction.values.includes("lives")) await member.roles.add(LIVES_ROLE).catch(() => {});
                    if (interaction.values.includes("events")) await member.roles.add(EVENTS_ROLE).catch(() => {});
                    if (interaction.values.includes("reseaux")) await member.roles.add(RESEAUX_ROLE).catch(() => {});

                    const objectifMenu = new StringSelectMenuBuilder()
                        .setCustomId("ob_objectif")
                        .setPlaceholder("🎯 Quel est ton but ici ?")
                        .addOptions([
                            { label: "Devenir joueur", value: "joueur", emoji: "🎮" },
                            { label: "Devenir staff", value: "staff", emoji: "🛠️" }
                        ]);

                    const embed = new EmbedBuilder()
                        .setColor("#ffb347")
                        .setTitle("🎯 Ton Objectif")
                        .setDescription(`Quel est ton projet principal sur le serveur ?\n\n**📊 Progression :**\n🟩🟩🟩⬜⬜⬜⬜ **3/7 (Objectif)**`);

                    return interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(objectifMenu), actionRowControls] });
                }

                // ÉTAPE 3 -> ÉTAPE 4 (Objectif)
                if (interaction.customId === "ob_objectif") {
                    const value = interaction.values[0];
                    if (value === "joueur") await member.roles.add(JOUEUR_ROLE).catch(() => {});
                    if (value === "staff") await member.roles.add(STAFF_ROLE).catch(() => {});

                    const sourceMenu = new StringSelectMenuBuilder()
                        .setCustomId("ob_source")
                        .setPlaceholder("🌐 Comment as-tu connu Pyxar ?")
                        .addOptions([
                            { label: "TikTok", value: "tiktok", emoji: "📱" },
                            { label: "YouTube / Twitch", value: "media", emoji: "🎬" },
                            { label: "Un ami", value: "ami", emoji: "👥" },
                            { label: "Liste de serveurs", value: "liste", emoji: "🔍" },
                            { label: "Autre", value: "autre", emoji: "❓" }
                        ]);

                    const embed = new EmbedBuilder()
                        .setColor("#ffb347")
                        .setTitle("📈 Acquisition")
                        .setDescription(`Comment as-tu découvert notre communauté ?\n\n**📊 Progression :**\n🟩🟩🟩🟩⬜⬜⬜ **4/7 (Source)**`);

                    return interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(sourceMenu), actionRowControls] });
                }

                // ÉTAPE 4 -> ÉTAPE 5 (Source)
                if (interaction.customId === "ob_source") {
                    const sourceChoisie = interaction.values[0];
                    if (logChan) logChan.send({ content: `📊 Stat d'entrée : ${member} provient de : \`${sourceChoisie.toUpperCase()}\`.` }).catch(() => {});

                    const pseudoButtonYes = new ButtonBuilder().setCustomId("rename_yes").setLabel("Oui, j'adore !").setStyle(ButtonStyle.Success).setEmoji("🧬");
                    const pseudoButtonNo = new ButtonBuilder().setCustomId("rename_no").setLabel("Non, garder mon pseudo").setStyle(ButtonStyle.Secondary);
                    const rowRename = new ActionRowBuilder().addComponents(pseudoButtonYes, pseudoButtonNo);

                    const embed = new EmbedBuilder()
                        .setColor("#ffb347")
                        .setTitle("🧬 Identité Visuelle")
                        .setDescription(`Souhaites-tu arborer le préfixe de la structure devant ton pseudonyme sur ce serveur ?\n\nExemple : \`HvX ${member.user.username}\`\n\n**📊 Progression :**\n🟩🟩🟩🟩🟩⬜⬜ **5/7 (Identité)**`);

                    return interaction.update({ embeds: [embed], components: [rowRename, actionRowControls] });
                }

                // ÉTAPE 5 -> ÉTAPE 6 (Surnom HvX)
                if (interaction.customId === "rename_yes" || interaction.customId === "rename_no") {
                    renameChoice.set(member.id, interaction.customId === "rename_yes");

                    const rulesMenu = new StringSelectMenuBuilder()
                        .setCustomId("ob_rules")
                        .setPlaceholder("⚖️ Acceptation des conditions...")
                        .addOptions([{ label: "J'ai lu et j'accepte le règlement de Pyxar", value: "accept", emoji: "✅" }]);

                    const embed = new EmbedBuilder()
                        .setColor("#ffb347")
                        .setTitle("📖 Règlement Intérieur")
                        .setDescription(`Prends connaissance de notre charte communautaire pour finaliser ton inscription.\n\n**📊 Progression :**\n🟩🟩🟩🟩🟩🟩⬜ **6/7 (Règlement)**`);

                    return interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(rulesMenu), actionRowControls] });
                }

                // ÉTAPE 6 -> ÉTAPE 7 (Règlement -> Envoi du Captcha)
                if (interaction.customId === "ob_rules") {
                    const code = Math.floor(1000 + Math.random() * 9000);
                    captchaStorage.set(member.id, code);
                    captchaAttempts.set(member.id, 0);

                    const embed = new EmbedBuilder()
                        .setColor("#ffb347")
                        .setTitle("🛡️ Validation Humaine")
                        .setDescription(`Pour des raisons de sécurité, recopie exactement le code de vérification ci-dessous dans le chat textuel :\n\n# 🔢 Code : \`${code}\`\n\n**📊 Progression :**\n🟩🟩🟩🟩🟩🟩🟩 **7/7 (Captcha)**`);

                    return interaction.update({ embeds: [embed], components: [] }); 
                }
            });

            // =====================================================
            // COLLECTEUR DU CAPTCHA TEXTUEL & ATTRIBUTION DES RÔLES FINAUX
            // =====================================================
            msgCollector.on("collect", async (msg) => {
                if (msg.author.bot || msg.author.id !== member.id) return;

                const targetCaptcha = captchaStorage.get(member.id);
                if (!targetCaptcha) return;

                if (msg.content !== targetCaptcha.toString()) {
                    let attempts = (captchaAttempts.get(member.id) || 0) + 1;
                    captchaAttempts.set(member.id, attempts);

                    if (attempts >= 3) {
                        const newCode = Math.floor(1000 + Math.random() * 9000);
                        captchaStorage.set(member.id, newCode);
                        captchaAttempts.set(member.id, 0);
                        return msg.reply(`❌ **Échecs consécutifs.** Nouveau code de sécurité généré : \`${newCode}\``).catch(() => {});
                    } else {
                        return msg.reply(`❌ **Code incorrect.** Reste attentif, il te reste **${3 - attempts} essai(s)**.`).catch(() => {});
                    }
                }

                // ---- VALIDATION STRICTE DU CAPTCHA EFFECTUÉE ----
                msgCollector.stop();
                compCollector.stop();
                captchaStorage.delete(member.id);
                captchaAttempts.delete(member.id);
                userChannels.delete(member.id);

                // Application du changement de pseudonyme si accepté à l'étape 5
                if (renameChoice.get(member.id) === true) {
                    await member.setNickname(`HvX ${member.user.username}`).catch(() => {});
                }
                renameChoice.delete(member.id);

                // 🛑 RETRAIT DU RÔLE ARRIVANT
                await member.roles.remove(ARRIVE_ROLE).catch(() => {});

                // 🎉 AJOUT DES RÔLES DE BASE REQUIS (MEMBRE & VÉRIFIÉ)
                await member.roles.add(MEMBRE_ROLE).catch(() => {});
                await member.roles.add(VERIFIED_ROLE).catch(() => {});

                if (logChan) {
                    logChan.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("Green")
                                .setDescription(`✅ **Onboarding validé** pour ${member}. Rôles de base attribués et rôle Arrivant retiré avec succès.`)
                        ]
                    }).catch(() => {});
                }

                const endEmbed = new EmbedBuilder()
                    .setColor("#57f287")
                    .setTitle("✅ Profil Validé !")
                    .setDescription("L'ensemble des salons du serveur vient de s'ouvrir à toi.");

                await channel.send({ embeds: [endEmbed] }).catch(() => {});
                await member.send(`🎉 Bienvenue sur **Pyxar** ! Retrouve toute la communauté ici : <#${BIENVENUE_CHANNEL}>`).catch(() => {});

                // Suppression du salon temporaire après un délai de 5 secondes
                setTimeout(async () => {
                    await channel.delete().catch(() => {});
                }, 5000);
            });

        } catch (err) {
            console.error("[CRITICAL ONBOARDING ERROR]", err);
        }
    });
};
