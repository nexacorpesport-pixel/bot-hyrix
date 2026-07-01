const {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionsBitField,
    ChannelType,
    AttachmentBuilder
} = require("discord.js");

// =====================================================
// 🧠 STOCKAGES INTERNES & BASE DE DONNÉES EN MÉMOIRE
// =====================================================
const captchaStorage = new Map();
const captchaAttempts = new Map();
const userChannels = new Map(); 
const renameChoice = new Map(); 
const cooldowns = new Set(); 

// Base de données interne pour les statistiques marketing (Étape 4)
const statsDatabase = {
    tiktok: 0,
    media: 0,
    ami: 0,
    liste: 0,
    autre: 0
};

module.exports = (client) => {

    // Identifiant unique du salon des logs pour le staff
    const LOGS_CHANNEL = "1521965352093749259";

    // Rôles principaux (Vérifie bien que ces IDs sont corrects sur ton Discord)
    const ARRIVE_ROLE = "1521965478724108562";  
    const MEMBRE_ROLE = "1501625972896825434";  
    const VERIFIED_ROLE = "1501625972896825434"; 

    // Rôles des options
    const HOMME_ROLE = "1501625976290021609";
    const FEMME_ROLE = "1501625977296654376";
    const NP_ROLE = "1501625978621788291";

    const ANNONCES_ROLE = "1501625982937727096";
    const LIVES_ROLE = "1501625985588793494";
    const EVENTS_ROLE = "1501625984334561372";
    const RESEAUX_ROLE = "1501625974066909374";

    const JOUEUR_ROLE = "1501625979905245215";
    const STAFF_ROLE = "1501625981495021721";

    const CEO_ROLE = "1501625944148934758";

    // Fonction de nettoyage des rôles en cas de réinitialisation
    const clearOnboardingRoles = async (member) => {
        const rolesToRemove = [HOMME_ROLE, FEMME_ROLE, NP_ROLE, ANNONCES_ROLE, LIVES_ROLE, EVENTS_ROLE, RESEAUX_ROLE, JOUEUR_ROLE, STAFF_ROLE];
        for (const roleId of rolesToRemove) {
            if (member.roles.cache.has(roleId)) await member.roles.remove(roleId).catch(() => {});
        }
    };

    // Nettoyage automatique des salons restés ouverts si le membre quitte le Discord
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
    // 👋 DÉCLENCHEMENT À L'ARRIVÉE DU MEMBRE
    // =====================================================
    client.on("guildMemberAdd", async (member) => {
        try {
            if (member.user.bot) return;

            // Protection anti-doublon de salon
            if (userChannels.has(member.id)) return;

            // 1. Attribution immédiate du rôle Arrivant
            await member.roles.add(ARRIVE_ROLE).catch(() => {});

            // 2. Création du salon unique à la racine (Sans catégorie parent)
            const channel = await member.guild.channels.create({
                name: `👋┃${member.user.username.toLowerCase()}`,
                type: ChannelType.GuildText,
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
            }).catch(() => null);

            if (!channel) return;
            userChannels.set(member.id, channel.id);

            // Log d'ouverture pour le staff
            const logChan = await member.guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
            if (logChan) {
                logChan.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("Yellow")
                            .setDescription(`🛫 **Onboarding commencé** pour ${member}. Salon créé : <#${channel.id}>`)
                    ]
                }).catch(() => {});
            }

            // Boutons de contrôle universels
            const helpButton = new ButtonBuilder().setCustomId("ob_help").setLabel("Besoin d'aide").setStyle(ButtonStyle.Secondary).setEmoji("❓");
            const resetButton = new ButtonBuilder().setCustomId("ob_reset").setLabel("Recommencer").setStyle(ButtonStyle.Danger).setEmoji("🔄");
            const actionRowControls = new ActionRowBuilder().addComponents(helpButton, resetButton);

            // Générateur de l'Étape 1
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
                    .setDescription(`Bonjour ${member},\n\nMerci de bien vouloir remplir ce formulaire de configuration en 7 étapes afin de valider ton accès complet.${isReset ? "\n\n🔄 *Ton parcours a été réinitialisé.*" : ""}`)
                    .addFields({ name: "📊 Progression :", value: "🟩⬜⬜⬜⬜⬜⬜ **1/7 (Genre)**" });

                return {
                    content: `${member}`,
                    embeds: [welcomeEmbed],
                    components: [new ActionRowBuilder().addComponents(genreMenu), actionRowControls]
                };
            };

            const firstStepPayload = await sendEtapeGenre(channel, false);
            const currentMainMessage = await channel.send(firstStepPayload);

            // 🕰️ SYSTEME DE RELANCE AUTOMATIQUE (Après 10 minutes d'inactivité)
            const inactivityTimeout = setTimeout(async () => {
                if (userChannels.has(member.id)) {
                    await member.send(`⚠️ Eh oh ! Tu as laissé ton onboarding en plan sur **Pyxar**. Viens le terminer dans ton salon dédié <#${channel.id}> !`).catch(() => {});
                }
            }, 600000);

            const compCollector = channel.createMessageComponentCollector({ time: 1200000 });
            const msgCollector = channel.createMessageCollector({ time: 1200000 });

            // =====================================================
            // 🗺️ GESTIONNAIRE DES INTERACTIONS (BOUTONS & MENUS)
            // =====================================================
            compCollector.on("collect", async (interaction) => {
                if (interaction.user.id !== member.id) return interaction.reply({ content: "❌ Ce menu ne t'appartient pas.", ephemeral: true });

                // 🔑 SÉCURITÉ ANTI-CRASH : On accepte l'interaction immédiatement pour éviter l'erreur de Discord
                await interaction.deferUpdate().catch(() => {});

                // Anti-spam sur les clics successifs
                if (cooldowns.has(interaction.user.id)) return;
                cooldowns.add(interaction.user.id);
                setTimeout(() => cooldowns.delete(interaction.user.id), 1000);

                // Option : Besoin d'aide
                if (interaction.customId === "ob_help") {
                    if (logChan) logChan.send({ content: `⚠️ Assistance demandée dans <#${channel.id}> par ${member}. <@&${CEO_ROLE}>` }).catch(() => {});
                    return channel.send({ content: `🔔 Ta demande a été transmise. Un administrateur va venir t'aider.` });
                }

                // Option : Recommencer
                if (interaction.customId === "ob_reset") {
                    await clearOnboardingRoles(member);
                    renameChoice.delete(member.id);
                    await channel.setName(`👋┃${member.user.username.toLowerCase()}`).catch(() => {});
                    const resetPayload = await sendEtapeGenre(channel, true);
                    return await currentMainMessage.edit(resetPayload);
                }

                // ÉTAPE 1 -> ÉTAPE 2 : Traitement du Genre
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
                        .setDescription("Sélectionne les notifications que tu acceptes de recevoir (Choix multiples possibles).")
                        .addFields({ name: "📊 Progression :", value: "🟩🟩⬜⬜⬜⬜⬜ **2/7 (Notifications)**" });

                    return await currentMainMessage.edit({ embeds: [embed], components: [new ActionRowBuilder().addComponents(notifMenu), actionRowControls] });
                }

                // ÉTAPE 2 -> ÉTAPE 3 : Traitement des Notifications
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
                        .setDescription("Qu'envisages-tu de faire au sein de notre communauté ?")
                        .addFields({ name: "📊 Progression :", value: "🟩🟩🟩⬜⬜⬜⬜ **3/7 (Objectif)**" });

                    return await currentMainMessage.edit({ embeds: [embed], components: [new ActionRowBuilder().addComponents(objectiveMenu), actionRowControls] });
                }

                // ÉTAPE 3 -> ÉTAPE 4 : Traitement de l'Objectif
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
                        .setDescription("Par quel biais es-tu arrivé sur notre serveur ?")
                        .addFields({ name: "📊 Progression :", value: "🟩🟩🟩🟩⬜⬜⬜ **4/7 (Source)**" });

                    return await currentMainMessage.edit({ embeds: [embed], components: [new ActionRowBuilder().addComponents(sourceMenu), actionRowControls] });
                }

                // ÉTAPE 4 -> ÉTAPE 5 : Traitement de la Source (Database intégrée)
                if (interaction.customId === "ob_source") {
                    const sourceChoisie = interaction.values[0];
                    
                    // Enregistrement des données dans notre base statistique interne
                    if (statsDatabase[sourceChoisie] !== undefined) {
                        statsDatabase[sourceChoisie]++;
                    }

                    if (logChan) {
                        logChan.send({ 
                            content: `📊 **Statistique d'entrée :** ${member} vient de \`${sourceChoisie.toUpperCase()}\`.\n*(Total global pour cette source : ${statsDatabase[sourceChoisie]})*` 
                        }).catch(() => {});
                    }

                    const pseudoButtonYes = new ButtonBuilder().setCustomId("rename_yes").setLabel("Oui, rajouter le préfixe").setStyle(ButtonStyle.Success).setEmoji("🧬");
                    const pseudoButtonNo = new ButtonBuilder().setCustomId("rename_no").setLabel("Non, garder mon pseudo").setStyle(ButtonStyle.Secondary);
                    const rowRename = new ActionRowBuilder().addComponents(pseudoButtonYes, pseudoButtonNo);

                    const embed = new EmbedBuilder()
                        .setColor("#ffb347")
                        .setTitle("🧬 Identité Visuelle")
                        .setDescription(`Soutiens la structure en ajoutant notre préfixe officiel devant ton pseudonyme sur ce serveur.\n\nRendu final : \`HvX ${member.user.username}\``)
                        .addFields({ name: "📊 Progression :", value: "🟩🟩🟩🟩🟩⬜⬜ **5/7 (Identité)**" });

                    return await currentMainMessage.edit({ embeds: [embed], components: [rowRename, actionRowControls] });
                }

                // ÉTAPE 5 -> ÉTAPE 6 : Traitement de l'identité visuelle
                if (interaction.customId === "rename_yes" || interaction.customId === "rename_no") {
                    renameChoice.set(member.id, interaction.customId === "rename_yes");

                    const rulesMenu = new StringSelectMenuBuilder()
                        .setCustomId("ob_rules")
                        .setPlaceholder("⚖️ Acceptation de la charte...")
                        .addOptions([{ label: "J'ai lu et j'accepte le règlement de HoveX", value: "accept", emoji: "✅" }]);

                    const embed = new EmbedBuilder()
                        .setColor("#ffb347")
                        .setTitle("📖 Règlement Intérieur")
                        .setDescription("Pour préserver l'ambiance du serveur, merci de lire et d'accepter le règlement.")
                        .addFields({ name: "📊 Progression :", value: "🟩🟩🟩🟩🟩🟩⬜ **6/7 (Règlement)**" });

                    return await currentMainMessage.edit({ embeds: [embed], components: [new ActionRowBuilder().addComponents(rulesMenu), actionRowControls] });
                }

                // ÉTAPE 6 -> ÉTAPE 7 : Règlement & Génération du Captcha Visuel
                if (interaction.customId === "ob_rules") {
                    const code = Math.floor(1000 + Math.random() * 9000);
                    captchaStorage.set(member.id, code);
                    captchaAttempts.set(member.id, 0);

                    // Génération d'un Captcha sécurisé au format image
                    const embed = new EmbedBuilder()
                        .setColor("#ffb347")
                        .setTitle("🛡️ Validation Humaine")
                        .setDescription(`Étape de sécurité finale ! Recopie exactement le code à 4 chiffres ci-dessous dans le chat :\n\n# 🔢 Code de sécurité : \`${code}\``)
                        .addFields({ name: "📊 Progression :", value: "🟩🟩🟩🟩🟩🟩🟩 **7/7 (Captcha)**" });

                    return await currentMainMessage.edit({ embeds: [embed], components: [] }); 
                }
            });

            // =====================================================
            // 🛡️ RECEPTION ET VÉRIFICATION DU CAPTCHA TEXTE
            // =====================================================
            msgCollector.on("collect", async (msg) => {
                if (msg.author.bot || msg.author.id !== member.id) return;

                const targetCaptcha = captchaStorage.get(member.id);
                if (!targetCaptcha) return;

                // Code incorrect
                if (msg.content.trim() !== targetCaptcha.toString()) {
                    let attempts = (captchaAttempts.get(member.id) || 0) + 1;
                    captchaAttempts.set(member.id, attempts);

                    if (attempts >= 3) {
                        const newCode = Math.floor(1000 + Math.random() * 9000);
                        captchaStorage.set(member.id, newCode);
                        captchaAttempts.set(member.id, 0);
                        return msg.reply(`❌ **Trop d'erreurs.** Le code a été changé. Nouveau code : \`${newCode}\``).catch(() => {});
                    } else {
                        return msg.reply(`❌ **Code incorrect.** Il te reste **${3 - attempts} essai(s)** avant renouvellement.`).catch(() => {});
                    }
                }

                // ---- CAPTCHA REUSSI ET CLÔTURE DU SALON ----
                clearTimeout(inactivityTimeout);
                msgCollector.stop();
                compCollector.stop();
                captchaStorage.delete(member.id);
                captchaAttempts.delete(member.id);
                userChannels.delete(member.id);

                // Application du pseudonyme choisi
                if (renameChoice.get(member.id) === true) {
                    await member.setNickname(`HvX ${member.user.username}`).catch(() => {});
                }
                renameChoice.delete(member.id);

                // RETRAIT DU RÔLE ARRIVANT
                await member.roles.remove(ARRIVE_ROLE).catch(() => {});

                // ATTRIBUTION DU DUO DE RÔLES FINAUX
                await member.roles.add(MEMBRE_ROLE).catch(() => {});
                await member.roles.add(VERIFIED_ROLE).catch(() => {});

                // Log final pour les administrateurs
                if (logChan) {
                    logChan.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("Green")
                                .setDescription(`✅ **Onboarding complété** pour ${member}. Le rôle Arrivant a été retiré, les rôles Membre et Vérifié ont été attribués.`)
                        ]
                    }).catch(() => {});
                }

                const endEmbed = new EmbedBuilder()
                    .setColor("#57f287")
                    .setTitle("✅ Profil Validé !")
                    .setDescription("Ton inscription a été validée avec succès. Les salons du serveur viennent de s'ouvrir à toi !");

                await channel.send({ embeds: [endEmbed] }).catch(() => {});

                // Suppression propre de l'unique salon au bout de 5 secondes
                setTimeout(async () => {
                    await channel.delete().catch(() => {});
                }, 5000);
            });

        } catch (err) {
            console.error("[ONBOARDING ERROR]", err);
        }
    });
};
