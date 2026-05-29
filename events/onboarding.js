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
// 🧠 STOCKAGES TEMPORAIRES (RAM) & PROTECTION
// =====================================================
const captchaStorage = new Map();
const captchaAttempts = new Map();
const userChannels = new Map(); 
const renameChoice = new Map(); 
const cooldowns = new Set(); // Anti-spam boutons

module.exports = (client) => {

    // =====================================================
    // 🛡️ CONFIGURATION DES IDENTIFIANTS (IDS)
    // =====================================================
    let CATEGORY_ONBOARDING = "1505330761153380476"; 
    const LOGS_CHANNEL = "1510039415454568569";

    // Configuration des rôles principaux
    const ARRIVE_ROLE = "1505625588121997572";  // Donné à l'arrivée, retiré à la fin
    const MEMBRE_ROLE = "1505330732187521035";  // Donné après le captcha
    const VERIFIED_ROLE = "1505330731193335920"; // Donné après le captcha

    // Rôles des étapes (Options)
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

    // Fonction de nettoyage des rôles si "Recommencer"
    const clearOnboardingRoles = async (member) => {
        const rolesToRemove = [HOMME_ROLE, FEMME_ROLE, NP_ROLE, ANNONCES_ROLE, LIVES_ROLE, EVENTS_ROLE, RESEAUX_ROLE, JOUEUR_ROLE, STAFF_ROLE];
        for (const roleId of rolesToRemove) {
            if (member.roles.cache.has(roleId)) await member.roles.remove(roleId).catch(() => {});
        }
    };

    // =====================================================
    // 🧹 SYSTÈME DE NETTOYAGE DES SALONS FANTÔMES
    // =====================================================
    client.once("ready", async () => {
        console.log("[🛡️ SECURITY] Scan et nettoyage des salons temporaires abandonnés...");
        const category = await client.channels.fetch(CATEGORY_ONBOARDING).catch(() => null);
        if (category && category.type === ChannelType.GuildCategory) {
            category.children.cache.forEach(async (channel) => {
                if (channel.type === ChannelType.GuildText && (Date.now() - channel.createdTimestamp) > 1800000) {
                    await channel.delete().catch(() => {});
                    console.log(`[🧹 CLEANUP] Salon abandonné supprimé : ${channel.name}`);
                }
            });
        }
    });

    // Suppression si le membre quitte le serveur en cours de route
    client.on("guildMemberRemove", async (member) => {
        const channelId = userChannels.get(member.id);
        if (channelId) {
            const channel = await member.guild.channels.fetch(channelId).catch(() => null);
            if (channel) await channel.delete().catch(() => {});
            
            userChannels.delete(member.id);
            captchaStorage.delete(member.id);
            captchaAttempts.delete(member.id);
            renameChoice.delete(member.id);
            console.log(`[🚪 LEAVE] ${member.user.tag} a quitté pendant l'onboarding. Salon supprimé.`);
        }
    });

    // =====================================================
    // 👋 DECLENCHEMENT INSTANTANÉ À L'ARRIVÉE
    // =====================================================
    client.on("guildMemberAdd", async (member) => {
        try {
            if (member.user.bot) return;

            // 1. ATTRIBUTION DU RÔLE ARRIVANT 
            await member.roles.add(ARRIVE_ROLE).catch((err) => {
                console.error("❌ Erreur critique : Rôle Arrivant introuvable ou hiérarchie incorrecte.");
            });

            // 2. VÉRIFICATION/CRÉATION DE LA CATÉGORIE
            let category = await member.guild.channels.fetch(CATEGORY_ONBOARDING).catch(() => null);
            if (!category || category.type !== ChannelType.GuildCategory) {
                category = await member.guild.channels.create({
                    name: "🎯┃ONBOARDING",
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: [{ id: member.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }]
                }).catch(() => null);
                if (category) CATEGORY_ONBOARDING = category.id;
            }

            // 3. CRÉATION DU SALON TEXTUEL DÉDIÉ
            const channel = await member.guild.channels.create({
                name: `👋┃${member.user.username.toLowerCase()}`,
                type: ChannelType.GuildText,
                parent: category ? category.id : null,
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

            // Logs Staff
            const logChan = await member.guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
            if (logChan) {
                logChan.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("Yellow")
                            .setTitle("🛫 Nouvel Onboarding Démarré")
                            .setDescription(`**Membre :** ${member} (\`${member.id}\`)\n**Salon dédié :** <#${channel.id}>`)
                            .setTimestamp()
                    ]
                }).catch(() => {});
            }

            // Contrôles universels
            const helpButton = new ButtonBuilder().setCustomId("ob_help").setLabel("Besoin d'aide").setStyle(ButtonStyle.Secondary).setEmoji("❓");
            const resetButton = new ButtonBuilder().setCustomId("ob_reset").setLabel("Recommencer").setStyle(ButtonStyle.Danger).setEmoji("🔄");
            const actionRowControls = new ActionRowBuilder().addComponents(helpButton, resetButton);

            // Fonction Génératrice Étape 1
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
                    .setDescription(`Bonjour ${member},\n\nBienvenue parmi nous ! Merci de compléter ce court formulaire interactif en 7 étapes afin de valider ton accès permanent au reste du serveur.\n\n${isReset ? "🔄 *Ton parcours a été réinitialisé à zéro.*" : ""}`)
                    .addFields({ name: "📊 Progression :", value: "🟩⬜⬜⬜⬜⬜⬜ **1/7 (Genre)**" })
                    .setFooter({ text: "Pyxar Structure • Onboarding System" });

                const payload = {
                    content: `${member}`,
                    embeds: [welcomeEmbed],
                    components: [new ActionRowBuilder().addComponents(genreMenu), actionRowControls]
                };

                if (isReset) return payload;
                await targetChannel.send(payload);
            };

            // Envoi de l'étape 1
            await sendEtapeGenre(channel, false);

            const compCollector = channel.createMessageComponentCollector({ time: 600000 });
            const msgCollector = channel.createMessageCollector({ time: 600000 });

            // =====================================================
            // 🗺️ GESTIONNAIRE INTERACTIF DES ÉTAPES
            // =====================================================
            compCollector.on("collect", async (interaction) => {
                if (interaction.user.id !== member.id) return interaction.reply({ content: "❌ Ce menu ne t'appartient pas.", ephemeral: true });

                // 🛡️ Anti-Spam / Cooldown bouton (1.5 seconde)
                if (cooldowns.has(interaction.user.id)) {
                    return interaction.reply({ content: "⚠️ Ne clique pas si vite ! Attends un instant.", ephemeral: true });
                }
                cooldowns.add(interaction.user.id);
                setTimeout(() => cooldowns.delete(interaction.user.id), 1500);

                // Bouton Aide
                if (interaction.customId === "ob_help") {
                    if (logChan) logChan.send({ content: `⚠️ Assistance demandée dans <#${channel.id}> par ${member}. <@&${CEO_ROLE}>` }).catch(() => {});
                    return interaction.reply({ content: `🔔 Ta demande d'assistance a été envoyée à l'équipe administrative.`, ephemeral: false });
                }

                // Bouton Recommencer
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
                        .setDescription("Sélectionne les mentions et actualités de la structure que tu souhaites recevoir en priorité (Choix multiples possibles).")
                        .addFields({ name: "📊 Progression :", value: "🟩🟩⬜⬜⬜⬜⬜ **2/7 (Notifications)**" });

                    return interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(notifMenu), actionRowControls] });
                }

                // ÉTAPE 2 -> 3 (Notifications)
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
                        .setDescription("Qu'envisages-tu d'accomplir principalement au sein de notre communauté ?")
                        .addFields({ name: "📊 Progression :", value: "🟩🟩🟩⬜⬜⬜⬜ **3/7 (Objectif)**" });

                    return interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(objectifMenu), actionRowControls] });
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
                        .setDescription("Par quel biais ou réseau social as-tu découvert l'existence de notre structure ?")
                        .addFields({ name: "📊 Progression :", value: "🟩🟩🟩🟩⬜⬜⬜ **4/7 (Source)**" });

                    return interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(sourceMenu), actionRowControls] });
                }

                // ÉTAPE 4 -> 5 (Source)
                if (interaction.customId === "ob_source") {
                    const sourceChoisie = interaction.values[0];
                    if (logChan) logChan.send({ content: `📊 Stat d'entrée : ${member} provient de : \`${sourceChoisie.toUpperCase()}\`.` }).catch(() => {});

                    const pseudoButtonYes = new ButtonBuilder().setCustomId("rename_yes").setLabel("Oui, avec plaisir !").setStyle(ButtonStyle.Success).setEmoji("🧬");
                    const pseudoButtonNo = new ButtonBuilder().setCustomId("rename_no").setLabel("Non, garder mon pseudo actuel").setStyle(ButtonStyle.Secondary);
                    const rowRename = new ActionRowBuilder().addComponents(pseudoButtonYes, pseudoButtonNo);

                    const embed = new EmbedBuilder()
                        .setColor("#ffb347")
                        .setTitle("🧬 Identité Visuelle")
                        .setDescription(`Souhaites-tu soutenir la structure en ajoutant notre préfixe officiel directement devant ton pseudonyme ?\n\nExemple de rendu : \`HvX ${member.user.username}\``)
                        .addFields({ name: "📊 Progression :", value: "🟩🟩🟩🟩🟩⬜⬜ **5/7 (Identité)**" });

                    return interaction.update({ embeds: [embed], components: [rowRename, actionRowControls] });
                }

                // ÉTAPE 5 -> 6 (Pseudo)
                if (interaction.customId === "rename_yes" || interaction.customId === "rename_no") {
                    renameChoice.set(member.id, interaction.customId === "rename_yes");

                    const rulesMenu = new StringSelectMenuBuilder()
                        .setCustomId("ob_rules")
                        .setPlaceholder("⚖️ Acceptation de la charte...")
                        .addOptions([{ label: "J'ai lu attentivement et j'accepte le règlement", value: "accept", emoji: "✅" }]);

                    const embed = new EmbedBuilder()
                        .setColor("#ffb347")
                        .setTitle("📖 Règlement Intérieur")
                        .setDescription("Afin de garantir une entente cordiale au sein de notre communauté, merci de valider l'acceptation de notre charte réglementaire.")
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
                        .setTitle("🛡️ Validation Humaine Sécurisée")
                        .setDescription(`Dernière formalité ! Pour contrer les vagues de bots automatisés, merci de recopier scrupuleusement le code de sécurité ci-dessous directement par écrit dans le chat textuel :\n\n# 🔢 Code de Sécurité : \`${code}\``)
                        .addFields({ name: "📊 Progression :", value: "🟩🟩🟩🟩🟩🟩🟩 **7/7 (Captcha)**" });

                    return interaction.update({ embeds: [embed], components: [] }); 
                }
            });

            // =====================================================
            // 🛡️ RECEPTION DU CAPTCHA ET ATTRIBUTION DES RÔLES DEFINITIFS
            // =====================================================
            msgCollector.on("collect", async (msg) => {
                if (msg.author.bot || msg.author.id !== member.id) return;

                const targetCaptcha = captchaStorage.get(member.id);
                if (!targetCaptcha) return;

                // Mauvais code écrit
                if (msg.content !== targetCaptcha.toString()) {
                    let attempts = (captchaAttempts.get(member.id) || 0) + 1;
                    captchaAttempts.set(member.id, attempts);

                    if (attempts >= 3) {
                        const newCode = Math.floor(1000 + Math.random() * 9000);
                        captchaStorage.set(member.id, newCode);
                        captchaAttempts.set(member.id, 0);
                        
                        if (logChan) logChan.send({ content: `⚠️ ${member} a raté 3 fois son captcha. Un nouveau code a été généré.` }).catch(() => {});
                        return msg.reply(`❌ **Échecs consécutifs.** Ton code de sécurité a été expiré et renouvelé. Nouveau code : \`${newCode}\``).catch(() => {});
                    } else {
                        return msg.reply(`❌ **Code incorrect.** Attention aux fautes de frappe. Il te reste **${3 - attempts} essai(s)**.`).catch(() => {});
                    }
                }

                // ---- VALIDATION EFFECTUÉE AVEC SUCCÈS ----
                msgCollector.stop();
                compCollector.stop();
                captchaStorage.delete(member.id);
                captchaAttempts.delete(member.id);
                userChannels.delete(member.id);

                // Changement de pseudo si accepté à l'étape 5
                if (renameChoice.get(member.id) === true) {
                    await member.setNickname(`HvX ${member.user.username}`).catch(() => {});
                }
                renameChoice.delete(member.id);

                // 🛑 RETRAIT STRICT DU RÔLE ARRIVANT
                await member.roles.remove(ARRIVE_ROLE).catch(() => {});

                // 🎉 AJOUT STRICT DES DEUX RÔLES DE BASE REQUIS
                await member.roles.add(MEMBRE_ROLE).catch(() => {});
                await member.roles.add(VERIFIED_ROLE).catch(() => {});

                // Notification verte finale dans les logs pour le staff
                if (logChan) {
                    logChan.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("Green")
                                .setTitle("✅ Onboarding Validé & Terminé")
                                .setDescription(`**Membre :** ${member}\nLe rôle **Arrivant** a été supprimé.\nLes rôles **Membre** et **Vérifié** ont été correctement assignés.`)
                                .setTimestamp()
                        ]
                    }).catch(() => {});
                }

                const endEmbed = new EmbedBuilder()
                    .setColor("#57f287")
                    .setTitle("✅ Profil Validé avec Succès !")
                    .setDescription("Félicitations, ton enregistrement est terminé. L'accès complet à tous les salons de la structure vient de t'être accordé.");

                await channel.send({ embeds: [endEmbed] }).catch(() => {});
                
                // Message privé de bienvenue
                await member.send(`🎉 Bienvenue officiellement chez **Pyxar** ! Rejoins nos salons de discussions ici : <#${BIENVENUE_CHANNEL}>`).catch(() => {});

                // Fermeture et destruction définitive du salon après 5 secondes
                setTimeout(async () => {
                    await channel.delete().catch(() => {});
                }, 5000);
            });

        } catch (err) {
            console.error("[CRITICAL ONBOARDING ERROR]", err);
        }
    });
};
