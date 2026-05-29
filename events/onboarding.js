const {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionsBitField,
    ChannelType
} = require("discord.js");

// Stockages en mémoire volatile (RAM)
const captchaStorage = new Map();
const captchaAttempts = new Map();
const userChannels = new Map(); // Associe l'ID du membre à l'ID de son salon d'onboarding
const renameChoice = new Map(); // Stocke si le membre veut le préfixe HvX ou non

module.exports = (client) => {

    // =====================================================
    // 🛡️ CONFIGURATION DES IDENTIFIANTS (IDS)
    // =====================================================
    const CATEGORY_ONBOARDING = "1505330761153380476"; 
    const LOGS_CHANNEL = "1510039415454568569";

    const ARRIVE_ROLE = "1505625588121997572";
    const HOMME_ROLE = "1505330737187131544";
    const FEMME_ROLE = "1505330738772574208";
    const NP_ROLE = "1505330739753783458";

    const ANNONCES_ROLE = "1505330743721721956";
    const LIVES_ROLE = "1505330746301354024";
    const EVENTS_ROLE = "1505330745072156904";
    const RESEAUX_ROLE = "1505625990359945318";

    const JOUEUR_ROLE = "1505330740869599383";
    const STAFF_ROLE = "1505330741234567890";

    const ACCESS_ROLE = "1505330734842515586";
    const VERIFIED_ROLE = "1505330731193335920";
    const MEMBER_ROLE = "1505330732187521035";
    const CEO_ROLE = "1505330692106485781";

    const BIENVENUE_CHANNEL = "1505330766047875242";

    // Nettoyage automatique des rôles si le joueur clique sur "Recommencer"
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
    // 🧹 ANTI-BUG : PURGE DES SALONS ABANDONNÉS AU DEMARRAGE
    // =====================================================
    client.once("ready", async () => {
        console.log("[ONBOARDING] Scan et nettoyage des salons temporaires abandonnés...");
        const category = await client.channels.fetch(CATEGORY_ONBOARDING).catch(() => null);
        if (category && category.type === ChannelType.GuildCategory) {
            category.children.cache.forEach(async (channel) => {
                if (channel.type === ChannelType.GuildText && (Date.now() - channel.createdTimestamp) > 1800000) {
                    await channel.delete().catch(() => {});
                    console.log(`[ONBOARDING] Salon abandonné supprimé : ${channel.name}`);
                }
            });
        }
    });

    // =====================================================
    // 🚪 SÉCURITÉ : LE MEMBRE QUITTE PENDANT SON ONBOARDING
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

            const logChan = await member.guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
            if (logChan) {
                logChan.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("Red")
                            .setDescription(`🚪 ${member.user.tag} a **quitté le serveur** en plein onboarding. Salon fermé.`)
                    ]
                }).catch(() => {});
            }
        }
    });

    // =====================================================
    // 👋 LOGIQUE PRINCIPALE D'ARRIVÉE
    // =====================================================
    client.on("guildMemberAdd", async (member) => {
        try {
            if (member.user.bot) return;

            const arriveRole = member.guild.roles.cache.get(ARRIVE_ROLE);
            if (arriveRole) await member.roles.add(arriveRole).catch(() => {});

            const logChan = await member.guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
            if (logChan) {
                logChan.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("Yellow")
                            .setDescription(`🛫 **Début d'onboarding** pour ${member} (\`${member.id}\`). Création du salon...`)
                    ]
                }).catch(() => {});
            }

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
            });

            userChannels.set(member.id, channel.id);

            // Boutons de contrôle universels
            const helpButton = new ButtonBuilder().setCustomId("ob_help").setLabel("Besoin d'aide").setStyle(ButtonStyle.Secondary);
            const resetButton = new ButtonBuilder().setCustomId("ob_reset").setLabel("Recommencer").setStyle(ButtonStyle.Danger);
            const actionRowControls = new ActionRowBuilder().addComponents(helpButton, resetButton);

            // ---- ÉTAPE 1 : GENRE (FONCTION ENCAPSULÉE POUR RESET) ----
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
                    .setDescription(`Bonjour ${member},\n\nHeureux de t'accueillir ! Remplis ce court formulaire pour débloquer tes accès.${isReset ? "\n\n🔄 *Ton parcours a été réinitialisé.*" : ""}\n\n**📊 Progression :**\n🟩⬜⬜⬜⬜⬜⬜ **1/7 (Genre)**`)
                    .setFooter({ text: "Onboarding Pyxar" });

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
                if (interaction.user.id !== member.id) {
                    return interaction.reply({ content: "❌ Ce menu ne t'appartient pas.", ephemeral: true });
                }

                // Bouton aide
                if (interaction.customId === "ob_help") {
                    if (logChan) {
                        logChan.send({ content: `⚠️ <@&${CEO_ROLE}> Assistance demandée dans <#${channel.id}> par ${member}.` }).catch(() => {});
                    }
                    return interaction.reply({ content: `🔔 Demande transmise. L'équipe <@&${CEO_ROLE}> arrive.`, ephemeral: false });
                }

                // Bouton Recommencer
                if (interaction.customId === "ob_reset") {
                    await clearOnboardingRoles(member);
                    renameChoice.delete(member.id);
                    await channel.setName(`👋┃${member.user.username.toLowerCase()}`).catch(() => {});
                    const resetPayload = await sendEtapeGenre(channel, true);
                    return interaction.update(resetPayload);
                }

                // ÉTAPE 1 -> ÉTAPE 2 (Genre -> Notifications)
                if (interaction.customId === "ob_genre") {
                    const value = interaction.values[0];
                    let prefix = "👋";

                    if (value === "homme") { await member.roles.add(HOMME_ROLE).catch(() => {}); prefix = "👨"; }
                    if (value === "femme") { await member.roles.add(FEMME_ROLE).catch(() => {}); prefix = "👩"; }
                    if (value === "np") { await member.roles.add(NP_ROLE).catch(() => {}); prefix = "👤"; }

                    await channel.setName(`${prefix}┃${member.user.username.toLowerCase()}`).catch(() => {});

                    const notifMenu = new StringSelectMenuBuilder()
                        .setCustomId("ob_notif")
                        .setPlaceholder("🔔 Choisis tes notifications (Plusieurs choix)...")
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
                        .setDescription(`Sélectionne les notifications que tu acceptes de recevoir.\n\n**📊 Progression :**\n🟩🟩⬜⬜⬜⬜⬜ **2/7 (Notifications)**`);

                    return interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(notifMenu), actionRowControls] });
                }

                // ÉTAPE 2 -> ÉTAPE 3 (Notifications -> Objectif)
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
                        .setDescription(`Qu'envisages-tu de faire principalement au sein de Pyxar ?\n\n**📊 Progression :**\n🟩🟩🟩⬜⬜⬜⬜ **3/7 (Objectif)**`);

                    return interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(objectifMenu), actionRowControls] });
                }

                // ÉTAPE 3 -> ÉTAPE 4 (Objectif -> Source Marketing)
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
                        .setDescription(`Comment as-tu trouvé le chemin vers notre communauté ?\n\n**📊 Progression :**\n🟩🟩🟩🟩⬜⬜⬜ **4/7 (Source)**`);

                    return interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(sourceMenu), actionRowControls] });
                }

                // ÉTAPE 4 -> ÉTAPE 5 (Source -> Surnom HvX) **NOUVEAU**
                if (interaction.customId === "ob_source") {
                    const sourceChoisie = interaction.values[0];
                    if (logChan) {
                        logChan.send({ content: `📊 **Statistique d'entrée :** ${member} provient de : \`${sourceChoisie.toUpperCase()}\`.` }).catch(() => {});
                    }

                    const pseudoButtonYes = new ButtonBuilder().setCustomId("rename_yes").setLabel("Oui, j'adore !").setStyle(ButtonStyle.Success).setEmoji("🧬");
                    const pseudoButtonNo = new ButtonBuilder().setCustomId("rename_no").setLabel("Non, garder mon pseudo").setStyle(ButtonStyle.Secondary);
                    const rowRename = new ActionRowBuilder().addComponents(pseudoButtonYes, pseudoButtonNo);

                    const embed = new EmbedBuilder()
                        .setColor("#ffb347")
                        .setTitle("🧬 Identité Visuelle : Représente la structure")
                        .setDescription(`Souhaites-tu arborer fièrement le préfixe de la communauté devant ton pseudonyme sur le serveur ?\n\nExemple : \`HvX ${member.user.username}\`\n\n*Ce choix est purement esthétique et modifiable plus tard.*\n\n**📊 Progression :**\n🟩🟩🟩🟩🟩⬜⬜ **5/7 (Identité)**`);

                    return interaction.update({ embeds: [embed], components: [rowRename, actionRowControls] });
                }

                // ÉTAPE 5 -> ÉTAPE 6 (Surnom -> Règlement) **NOUVEAU**
                if (interaction.customId === "rename_yes" || interaction.customId === "rename_no") {
                    const veutRenommer = interaction.customId === "rename_yes";
                    renameChoice.set(member.id, veutRenommer);

                    const rulesMenu = new StringSelectMenuBuilder()
                        .setCustomId("ob_rules")
                        .setPlaceholder("⚖️ Acceptation des conditions...")
                        .addOptions([{ label: "J'ai lu et j'accepte le règlement de Pyxar", value: "accept", emoji: "✅" }]);

                    const embed = new EmbedBuilder()
                        .setColor("#ffb347")
                        .setTitle("📖 Règlement Intérieur")
                        .setDescription(`Prends connaissance de nos règles de conduite fondamentales. Tout manquement sera sanctionné.\n\n**📊 Progression :**\n🟩🟩🟩🟩🟩🟩⬜ **6/7 (Règlement)**`);

                    return interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(rulesMenu), actionRowControls] });
                }

                // ÉTAPE 6 -> ÉTAPE 7 (Règlement -> Saisie Captcha)
                if (interaction.customId === "ob_rules") {
                    const code = Math.floor(1000 + Math.random() * 9000);
                    captchaStorage.set(member.id, code);
                    captchaAttempts.set(member.id, 0);

                    const embed = new EmbedBuilder()
                        .setColor("#ffb347")
                        .setTitle("🛡️ Validation Humaine (Anti-Bot)")
                        .setDescription(`Dernière ligne droite ! Merci de recopier le code de sécurité ci-dessous par écrit dans le chat.\n\n# 🔢 Code : \`${code}\`\n\n**📊 Progression :**\n🟩🟩🟩🟩🟩🟩🟩 **7/7 (Captcha)**`);

                    return interaction.update({ embeds: [embed], components: [] }); // Suppression des boutons pour l'écriture chat
                }
            });

            // =====================================================
            // SÉCURITÉ CAPTCHA & FINALISATION DU PROFIL
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
                        return msg.reply(`❌ **Trop d'échecs.** Code réinitialisé. Écris le nouveau code : \`${newCode}\``).catch(() => {});
                    } else {
                        return msg.reply(`❌ **Code incorrect.** Il te reste **${3 - attempts} essai(s)** avant renouvellement du code.`).catch(() => {});
                    }
                }

                // ---- VALIDATION STRICTE ET EXPULSION DU SALON D'ONBOARDING ----
                msgCollector.stop();
                compCollector.stop();
                captchaStorage.delete(member.id);
                captchaAttempts.delete(member.id);
                userChannels.delete(member.id);

                // Application du changement de pseudo si accepté à l'étape 5
                const changePseudo = renameChoice.get(member.id);
                if (changePseudo === true) {
                    await member.setNickname(`HvX ${member.user.username}`).catch((err) => {
                        console.log(`[PSEUDO-ERROR] Impossible de renommer ${member.user.username} (Probablement permissions trop hautes ou propriétaire du serveur)`);
                    });
                }
                renameChoice.delete(member.id);

                // Rôles d'accès globaux
                await member.roles.add(ACCESS_ROLE).catch(() => {});
                await member.roles.add(VERIFIED_ROLE).catch(() => {});
                await member.roles.add(MEMBER_ROLE).catch(() => {});
                if (arriveRole) await member.roles.remove(arriveRole).catch(() => {});

                if (logChan) {
                    logChan.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("Green")
                                .setDescription(`✅ **Onboarding Complété** pour ${member} (\`${member.id}\`). Le salon va s'autodétruire.`)
                        ]
                    }).catch(() => {});
                }

                const endEmbed = new EmbedBuilder()
                    .setColor("#57f287")
                    .setTitle("✅ Configuration Terminée !")
                    .setDescription("Ton profil est validé. L'intégralité du serveur s'ouvre à toi dès maintenant !");

                await channel.send({ embeds: [endEmbed] }).catch(() => {});

                // Envoi du MP final de bienvenue
                await member.send(`🎉 Bienvenue sur **Pyxar** !\n\nTon onboarding s'est déroulé à la perfection. Rejoins les autres membres ici : <#${BIENVENUE_CHANNEL}>`).catch(() => {});

                // Suppression propre du salon temporaire après 5 secondes
                setTimeout(async () => {
                    await channel.delete().catch(() => {});
                }, 5000);
            });

        } catch (err) {
            console.error("[CRITICAL ONBOARDING ERROR]", err);
        }
    });
};
