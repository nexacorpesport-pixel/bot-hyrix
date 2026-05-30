const {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionsBitField,
    ChannelType
} = require("discord.js");

// =====================================================
// 🧠 STOCKAGES TEMPORAIRES (RAM) & PROTECTION CONTROL
// =====================================================
const captchaStorage = new Map();
const captchaAttempts = new Map();
const userChannels = new Map(); // Garantit l'unicité du salon par membre
const renameChoice = new Map(); 
const cooldowns = new Set(); 

module.exports = (client) => {

    // =====================================================
    // 🛡️ CONFIGURATION DES IDENTIFIANTS (IDS)
    // =====================================================
    const LOGS_CHANNEL = "1510039415454568569";

    // Rôles principaux
    const ARRIVE_ROLE = "1505625588121997572";  
    const MEMBRE_ROLE = "1505330732187521035";  
    const VERIFIED_ROLE = "1505330731193335920"; 

    // Rôles optionnels
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

    // Nettoyage des rôles
    const clearOnboardingRoles = async (member) => {
        const rolesToRemove = [HOMME_ROLE, FEMME_ROLE, NP_ROLE, ANNONCES_ROLE, LIVES_ROLE, EVENTS_ROLE, RESEAUX_ROLE, JOUEUR_ROLE, STAFF_ROLE];
        for (const roleId of rolesToRemove) {
            if (member.roles.cache.has(roleId)) await member.roles.remove(roleId).catch(() => {});
        }
    };

    // Nettoyage si le membre quitte le serveur en cours de route
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
    // 👋 LOGIQUE D'ARRIVÉE SUR LE SERVEUR
    // =====================================================
    client.on("guildMemberAdd", async (member) => {
        try {
            if (member.user.bot) return;

            // 1. SÉCURITÉ : Si le membre a déjà un salon enregistré, on stoppe pour éviter les doublons
            if (userChannels.has(member.id)) return;

            // 2. ATTRIBUTION DU RÔLE ARRIVANT 
            await member.roles.add(ARRIVE_ROLE).catch(() => {
                console.error("❌ Impossible d'attribuer le rôle Arrivant.");
            });

            // 3. CRÉATION DU SALON TEXTUEL UNIQUE (Sans catégorie parent)
            const channel = await member.guild.channels.create({
                name: `👋┃${member.user.username.toLowerCase()}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: member.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, // Caché pour tout le monde
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
                console.error("❌ Permissions de création de salon manquantes.");
                return null;
            });

            if (!channel) return;
            userChannels.set(member.id, channel.id); // Enregistrement du salon unique

            // Logs Staff
            const logChan = await member.guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
            if (logChan) {
                logChan.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("Yellow")
                            .setTitle("🛫 Nouvel Onboarding")
                            .setDescription(`**Membre :** ${member} (\`${member.id}\`)\n**Salon unique :** <#${channel.id}>`)
                    ]
                }).catch(() => {});
            }

            // Boutons de contrôle
            const helpButton = new ButtonBuilder().setCustomId("ob_help").setLabel("Besoin d'aide").setStyle(ButtonStyle.Secondary).setEmoji("❓");
            const resetButton = new ButtonBuilder().setCustomId("ob_reset").setLabel("Recommencer").setStyle(ButtonStyle.Danger).setEmoji("🔄");
            const actionRowControls = new ActionRowBuilder().addComponents(helpButton, resetButton);

            // Générateur Étape 1
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
                    .setDescription(`Bonjour ${member},\n\nBienvenue parmi nous ! Merci de compléter ce court formulaire interactif en 7 étapes afin de valider ton accès permanent au reste du serveur.\n\n*Tout se passe ici, dans cet unique salon.*${isReset ? "\n\n🔄 *Ton parcours a été réinitialisé.*" : ""}`)
                    .addFields({ name: "📊 Progression :", value: "🟩⬜⬜⬜⬜⬜⬜ **1/7 (Genre)**" });

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

            // =====================================================
            // 🗺️ INTERACTION ET MENUS (MÊME SALON STRUCTURÉ)
            // =====================================================
            compCollector.on("collect", async (interaction) => {
                if (interaction.user.id !== member.id) return interaction.reply({ content: "❌ Ce menu ne t'appartient pas.", ephemeral: true });

                if (cooldowns.has(interaction.user.id)) {
                    return interaction.reply({ content: "⚠️ Un peu de patience, ne clique pas si vite !", ephemeral: true });
                }
                cooldowns.add(interaction.user.id);
                setTimeout(() => cooldowns.delete(interaction.user.id), 1200);

                if (interaction.customId === "ob_help") {
                    if (logChan) logChan.send({ content: `⚠️ Assistance demandée dans <#${channel.id}> par ${member}. <@&${CEO_ROLE}>` }).catch(() => {});
                    return interaction.reply({ content: `🔔 Demande reçue. Le staff a été notifié.`, ephemeral: false });
                }

                if (interaction.customId === "ob_reset") {
                    await clearOnboardingRoles(member);
                    renameChoice.delete(member.id);
                    await channel.setName(`👋┃${member.user.username.toLowerCase()}`).catch(() => {});
                    const resetPayload = await sendEtapeGenre(channel, true);
                    return interaction.update(resetPayload);
                }

                // ÉTAPE 1 -> 2 (Genre)
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
                        .setDescription("Sélectionne les mentions de la structure que tu souhaites recevoir (Choix multiples possibles).")
                        .addFields({ name: "📊 Progression :", value: "🟩🟩⬜⬜⬜⬜⬜ **2/7 (Notifications)**" });

                    return interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(notifMenu), actionRowControls] });
                }

                // ÉTAPE 2 -> 3 (Notifications)
                if (interaction.customId === "ob_notif") {
                    if (interaction.values.includes("annonces")) await member.roles.add(ANNONCES_ROLE).catch(() => {});
                    if (interaction.values.includes("lives")) await member.roles.add(LIVES_ROLE).catch(() => {});
                    if (interaction.values.includes("events")) await member.roles.add(EVENTS_ROLE).catch(() => {});
                    if (interaction.values.includes("reseaux")) await member.roles.add(RESEAUX_ROLE).catch(() => {});

                    const objectiveMenu = new StringSelectMenuBuilder()
                        .setCustomId("ob_objectif")
                        .setPlaceholder("🎯 Quel est ton but ici ?")
                        .addOptions([
                            { label: "Devenir joueur", value: "joueur", emoji: "🎮" },
                            { label: "Devenir staff", value: "staff", emoji: "🛠️" }
                        ]);

                    const embed = new EmbedBuilder()
                        .setColor("#ffb347")
                        .setTitle("🎯 Ton Objectif")
                        .setDescription("Qu'envisages-tu d'accomplir principalement sur Pyxar ?")
                        .addFields({ name: "📊 Progression :", value: "🟩🟩🟩⬜⬜⬜⬜ **3/7 (Objectif)**" });

                    return interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(objectiveMenu), actionRowControls] });
                }

                // ÉTAPE 3 -> 4 (Objectif)
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
                        .setDescription("Par quel biais as-tu découvert notre structure ?")
                        .addFields({ name: "📊 Progression :", value: "🟩🟩🟩🟩⬜⬜⬜ **4/7 (Source)**" });

                    return interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(sourceMenu), actionRowControls] });
                }

                // ÉTAPE 4 -> 5 (Source)
                if (interaction.customId === "ob_source") {
                    const sourceChoisie = interaction.values[0];
                    if (logChan) logChan.send({ content: `📊 Stat d'entrée : ${member} provient de : \`${sourceChoisie.toUpperCase()}\`.` }).catch(() => {});

                    const pseudoButtonYes = new ButtonBuilder().setCustomId("rename_yes").setLabel("Oui, carrément !").setStyle(ButtonStyle.Success).setEmoji("🧬");
                    const pseudoButtonNo = new ButtonBuilder().setCustomId("rename_no").setLabel("Non, garder mon pseudo").setStyle(ButtonStyle.Secondary);
                    const rowRename = new ActionRowBuilder().addComponents(pseudoButtonYes, pseudoButtonNo);

                    const embed = new EmbedBuilder()
                        .setColor("#ffb347")
                        .setTitle("🧬 Identité Visuelle")
                        .setDescription(`Souhaites-tu ajouter notre préfixe officiel devant ton pseudonyme sur ce serveur ?\n\nExemple : \`HvX ${member.user.username}\``)
                        .addFields({ name: "📊 Progression :", value: "🟩🟩🟩🟩🟩⬜⬜ **5/7 (Identité)**" });

                    return interaction.update({ embeds: [embed], components: [rowRename, actionRowControls] });
                }

                // ÉTAPE 5 -> 6 (Pseudo)
                if (interaction.customId === "rename_yes" || interaction.customId === "rename_no") {
                    renameChoice.set(member.id, interaction.customId === "rename_yes");

                    const rulesMenu = new StringSelectMenuBuilder()
                        .setCustomId("ob_rules")
                        .setPlaceholder("⚖️ Acceptation du règlement...")
                        .addOptions([{ label: "J'ai lu et j'accepte le règlement de Pyxar", value: "accept", emoji: "✅" }]);

                    const embed = new EmbedBuilder()
                        .setColor("#ffb347")
                        .setTitle("📖 Règlement Intérieur")
                        .setDescription("Merci de valider l'acceptation de notre charte communautaire pour continuer.")
                        .addFields({ name: "📊 Progression :", value: "🟩🟩🟩🟩🟩🟩⬜ **6/7 (Règlement)**" });

                    return interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(rulesMenu), actionRowControls] });
                }

                // ÉTAPE 6 -> 7 (Règlement -> Envoi du Captcha)
                if (interaction.customId === "ob_rules") {
                    const code = Math.floor(1000 + Math.random() * 9000);
                    captchaStorage.set(member.id, code);
                    captchaAttempts.set(member.id, 0);

                    const embed = new EmbedBuilder()
                        .setColor("#ffb347")
                        .setTitle("🛡️ Validation Humaine")
                        .setDescription(`Dernière ligne droite ! Recopie exactement le code ci-dessous par écrit dans ce chat textuel :\n\n# 🔢 Code : \`${code}\``)
                        .addFields({ name: "📊 Progression :", value: "🟩🟩🟩🟩🟩🟩🟩 **7/7 (Captcha)**" });

                    return interaction.update({ embeds: [embed], components: [] }); 
                }
            });

            // =====================================================
            // 🛡️ RECEPTION DU CAPTCHA ET ROLES FINAUX
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
                        return msg.reply(`❌ **Trop d'échecs.** Code expiré. Nouveau code généré : \`${newCode}\``).catch(() => {});
                    } else {
                        return msg.reply(`❌ **Code incorrect.** Il te reste **${3 - attempts} essai(s)**.`).catch(() => {});
                    }
                }

                // ---- VALIDATION CAPTCHA RÉUSSIE ----
                msgCollector.stop();
                compCollector.stop();
                captchaStorage.delete(member.id);
                captchaAttempts.delete(member.id);
                userChannels.delete(member.id);

                if (renameChoice.get(member.id) === true) {
                    await member.setNickname(`HvX ${member.user.username}`).catch(() => {});
                }
                renameChoice.delete(member.id);

                // 🛑 ON RETIRE LE RÔLE ARRIVANT
                await member.roles.remove(ARRIVE_ROLE).catch(() => {});

                // 🎉 ON MET LES DEUX RÔLES FINAUX EXCLUSIFS
                await member.roles.add(MEMBRE_ROLE).catch(() => {});
                await member.roles.add(VERIFIED_ROLE).catch(() => {});

                if (logChan) {
                    logChan.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("Green")
                                .setTitle("✅ Onboarding Validé")
                                .setDescription(`**Membre :** ${member}\nLe rôle Arrivant a été retiré. Rôles Membre & Vérifié attribués.`)
                        ]
                    }).catch(() => {});
                }

                const endEmbed = new EmbedBuilder()
                    .setColor("#57f287")
                    .setTitle("✅ Profil Validé !")
                    .setDescription("Ton inscription est terminée. L'ensemble des salons du serveur vient de t'être ouvert.");

                await channel.send({ embeds: [endEmbed] }).catch(() => {});
                await member.send(`🎉 Bienvenue sur **Pyxar** ! Retrouve toute la communauté ici : <#${BIENVENUE_CHANNEL}>`).catch(() => {});

                // Suppression de l'unique salon au bout de 5 secondes
                setTimeout(async () => {
                    await channel.delete().catch(() => {});
                }, 5000);
            });

        } catch (err) {
            console.error("[CRITICAL ONBOARDING ERROR]", err);
        }
    });
};
