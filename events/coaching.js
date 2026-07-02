const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    ChannelType
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "../data/coachingConfig.json");
const QUOTA_PATH = path.join(__dirname, "../data/coachingQuotas.json");

// Chargement de la config des salons
let config = {};
if (fs.existsSync(CONFIG_PATH)) {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
} else {
    console.log("[🎯 COACHING] Erreur : Le fichier data/coachingConfig.json est introuvable.");
}

// Système de quota persistant (1 fois par mois)
function checkQuota(userId) {
    if (!fs.existsSync(QUOTA_PATH)) fs.writeFileSync(QUOTA_PATH, JSON.stringify({}));
    const quotas = JSON.parse(fs.readFileSync(QUOTA_PATH, "utf-8"));
    
    const currentMonth = new Date().getMonth() + "-" + new Date().getFullYear();
    
    if (quotas[userId] === currentMonth) {
        return false; // Quota dépassé pour ce mois
    }
    return true;
}

function setQuota(userId) {
    const quotas = JSON.parse(fs.readFileSync(QUOTA_PATH, "utf-8"));
    quotas[userId] = new Date().getMonth() + "-" + new Date().getFullYear();
    fs.writeFileSync(QUOTA_PATH, JSON.stringify(quotas, null, 2));
}

function resetQuota(userId) {
    if (!fs.existsSync(QUOTA_PATH)) return;
    const quotas = JSON.parse(fs.readFileSync(QUOTA_PATH, "utf-8"));
    delete quotas[userId];
    fs.writeFileSync(QUOTA_PATH, JSON.stringify(quotas, null, 2));
}

module.exports = async (client) => {
    console.log("[🎯 COACHING] Module de Coaching Premium et Grinders opérationnel !");

    // ==========================================
    // COMMANDE DE MISE EN PLACE (À CHERCHER SUR LE READY)
    // ==========================================
    client.on("messageCreate", async (message) => {
        if (message.author.bot || !message.member.permissions.has("Administrator")) return;

        // Écris "!setupcoaching" dans ton salon #infos-coaching pour envoyer l'embed initial
        if (message.content === "!setupcoaching") {
            await message.delete();

            const embed = new EmbedBuilder()
                .setTitle("🎯 PÔLE GRIND & COACHING ─ TEAM HOVEX")
                .setDescription(
                    "Bienvenue dans l'espace d'entraînement de la structure.\n\n" +
                    "Ce module est exclusivement réservé aux **Grinders** de la team souhaitant perfectionner leur gameplay, analyser leurs erreurs et franchir un cap compétitif.\n\n" +
                    "⚠️ **RÈGLES ET CONDITIONS :**\n" +
                    "• Vous avez le droit à **1 seule séance de coaching par mois**.\n" +
                    "• Soyez sincère et précis dans votre candidature.\n" +
                    "• Tout comportement troll ou non-respectueux envers un coach sera lourdement sanctionné."
                )
                .setColor("#ff007f")
                .setThumbnail(client.user.displayAvatarURL())
                .setFooter({ text: "HoveX Performance • Progressez avec des pros" });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("apply_coaching")
                    .setLabel("Prendre un rendez-vous (Fiche)")
                    .setEmoji("🎮")
                    .setStyle(ButtonStyle.Primary)
            );

            await message.channel.send({ embeds: [embed], components: [row] });
        }
    });

    // ==========================================
    // GESTION DES INTERACTIONS (BOUTONS / MODALS)
    // ==========================================
    client.on("interactionCreate", async (interaction) => {
        try {
            // 1. Clic sur le bouton de demande de coaching
            if (interaction.isButton() && interaction.customId === "apply_coaching") {
                // Vérification du quota mensuel
                if (!checkQuota(interaction.user.id)) {
                    return interaction.reply({ 
                        content: "❌ **Erreur :** Tu as déjà bénéficié de ta séance de coaching ou tu as un rendez-vous en cours pour ce mois-ci. Revenez le mois prochain !", 
                        ephemeral: true 
                    });
                }

                const modal = new ModalBuilder()
                    .setCustomId("coaching_modal")
                    .setTitle("Fiche de Suivi Coaching");

                const ageInput = new TextInputBuilder()
                    .setCustomId("coach_age")
                    .setLabel("Ton Âge :")
                    .setPlaceholder("Ex: 17 ans")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const gameInput = new TextInputBuilder()
                    .setCustomId("coach_game")
                    .setLabel("Jeu principal & Ton Rang actuel :")
                    .setPlaceholder("Ex: Fortnite - Champion / Valorant - Ascendant 2")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const strengthInput = new TextInputBuilder()
                    .setCustomId("coach_strengths")
                    .setLabel("Quels sont tes points forts ?")
                    .setPlaceholder("Sois précis (Aim, communication, vision du jeu, clutch...)")
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                const weaknessInput = new TextInputBuilder()
                    .setCustomId("coach_weaknesses")
                    .setLabel("Points faibles (OBLIGATOIRE ET SINCÈRE) :")
                    .setPlaceholder("Sois honnête ! Si tu n'as aucun point faible, le coaching ne sert à rien.")
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                const dateInput = new TextInputBuilder()
                    .setCustomId("coach_date")
                    .setLabel("Tes disponibilités (Jours / Horaires) :")
                    .setPlaceholder("Ex: Samedi après-midi (14h-18h) ou Dimanche soir")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(ageInput),
                    new ActionRowBuilder().addComponents(gameInput),
                    new ActionRowBuilder().addComponents(strengthInput),
                    new ActionRowBuilder().addComponents(weaknessInput),
                    new ActionRowBuilder().addComponents(dateInput)
                );

                await interaction.showModal(modal);
            }

            // 2. Soumission du Formulaire (Modal)
            if (interaction.isModalSubmit() && interaction.customId === "coaching_modal") {
                await interaction.deferReply({ ephemeral: true });

                const age = interaction.fields.getTextInputValue("coach_age");
                const game = interaction.fields.getTextInputValue("coach_game");
                const strengths = interaction.fields.getTextInputValue("coach_strengths");
                const weaknesses = interaction.fields.getTextInputValue("coach_weaknesses");
                const dateWish = interaction.fields.getTextInputValue("coach_date");

                // Anti-Troll basique sur les points faibles
                if (weaknesses.toLowerCase().includes("aucun") || weaknesses.length < 10) {
                    return interaction.editReply({ content: "❌ **Candidature rejetée :** Tu dois détailler sincèrement tes points faibles pour qu'un coach puisse t'aider." });
                }

                // Bloquer le quota directement pour éviter les spams de clics
                setQuota(interaction.user.id);

                const logsChannel = client.channels.cache.get(config.LOGS_CHANNEL);
                if (!logsChannel) return interaction.editReply({ content: "Erreur : Le salon des logs est introuvable." });

                // Embed pour le salon d'administration/logs des coachs
                const logEmbed = new EmbedBuilder()
                    .setTitle(`🎯 Nouvelle demande de Coaching ─ ${interaction.user.username}`)
                    .setDescription(`Le joueur <@${interaction.user.id}> sollicite un encadrement professionnel.`)
                    .addFields(
                        { name: "👤 Âge", value: age, inline: true },
                        { name: "🎮 Jeu & Classement", value: game, inline: true },
                        { name: "🗓️ Créneaux souhaités", value: dateWish, inline: false },
                        { name: "💪 Points forts", value: strengths, inline: false },
                        { name: "⚠️ Points faibles", value: weaknesses, inline: false }
                    )
                    .setColor("#ff007f")
                    .setTimestamp();

                const logRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`accept_coaching_${interaction.user.id}`)
                        .setLabel("Accepter & Planifier")
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`deny_coaching_${interaction.user.id}`)
                        .setLabel("Refuser / Annuler")
                        .setStyle(ButtonStyle.Danger)
                );

                await logsChannel.send({ embeds: [logEmbed], components: [logRow] });
                await interaction.editReply({ content: "✅ **Ta fiche a été envoyée avec succès aux coachs !** Si un coach accepte ton créneau, un fil de discussion privé sera créé pour caler le rendez-vous." });
            }

            // 3. Gestion des boutons d'administration par les coachs
            if (interaction.isButton() && (interaction.customId.startsWith("accept_coaching_") || interaction.customId.startsWith("deny_coaching_"))) {
                // Rôle Coach obligatoire (à ajuster si besoin, ou permission de gérer des messages)
                if (!interaction.member.permissions.has("ManageMessages")) {
                    return interaction.reply({ content: "❌ Tu n'as pas l'autorisation de gérer les demandes de coaching.", ephemeral: true });
                }

                const userId = interaction.customId.split("_")[2];
                const targetUser = await client.users.fetch(userId).catch(() => null);

                if (interaction.customId.startsWith("deny_coaching_")) {
                    resetQuota(userId); // On lui rend son droit de postuler
                    if (targetUser) await targetUser.send("❌ Ta demande de coaching pour la Team HoveX a été refusée ou annulée par un coach (Motif : Fiche insuffisante ou aucun créneau disponible).").catch(() => null);
                    
                    await interaction.message.delete();
                    return interaction.reply({ content: "La demande a été rejetée et supprimée.", ephemeral: true });
                }

                if (interaction.customId.startsWith("accept_coaching_")) {
                    // Ouverture d'un mini formulaire pour le coach pour fixer l'heure exacte
                    const coachModal = new ModalBuilder()
                        .setCustomId(`confirm_time_modal_${userId}`)
                        .setTitle("Confirmer l'horaire retenu");

                    const exactTimeInput = new TextInputBuilder()
                        .setCustomId("exact_time")
                        .setLabel("Jour et Heure fixés pour la séance :")
                        .setPlaceholder("Ex: Samedi à 15h30")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    coachModal.addComponents(new ActionRowBuilder().addComponents(exactTimeInput));
                    await interaction.showModal(coachModal);
                }
            }

            // 4. Validation finale de la date par le coach
            if (interaction.isModalSubmit() && interaction.customId.startsWith("confirm_time_modal_")) {
                await interaction.deferReply({ ephemeral: true });
                const userId = interaction.customId.split("_")[3];
                const exactTime = interaction.fields.getTextInputValue("exact_time");
                const targetMember = await interaction.guild.members.fetch(userId).catch(() => null);

                if (!targetMember) return interaction.editReply({ content: "Le membre n'est plus sur le serveur Discord." });

                // Mise à jour automatique du salon PLANNING
                const planningChannel = client.channels.cache.get(config.PLANNING_CHANNEL);
                if (planningChannel) {
                    const planEmbed = new EmbedBuilder()
                        .setTitle("📅 SÉANCE DE COACHING PLANIFIÉE")
                        .setDescription(`Une séance officielle vient d'être enregistrée dans le planning.`)
                        .addFields(
                            { name: "👤 Joueur", value: `<@${userId}>`, inline: true },
                            { name: "🧑‍🏫 Coach", value: `<@${interaction.user.id}>`, inline: true },
                            { name: "⏰ Date & Heure", value: `**${exactTime}**`, inline: false },
                            { name: "🔊 Salon Vocal", value: `<#${config.VOICE_COACHING_1}> ou <#${config.VOICE_COACHING_2}>`, inline: false }
                        )
                        .setColor("#00ff88")
                        .setTimestamp();
                    await planningChannel.send({ embeds: [planEmbed] });
                }

                // Création du Fil Privé (Thread) dans le salon actuel pour le suivi
                const thread = await interaction.channel.threads.create({
                    name: `Coaching ─ ${targetMember.user.username}`,
                    autoArchiveDuration: 1440,
                    type: ChannelType.PrivateThread,
                    reason: "Suivi coaching individuel Grinder"
                });

                await thread.members.add(userId);
                await thread.members.add(interaction.user.id);

                const threadRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`cancel_session_${userId}`)
                        .setLabel("Annuler la séance (Imprévu)")
                        .setStyle(ButtonStyle.Danger)
                );

                await thread.send({
                    content: `👋 Bienvenue dans votre salon de suivi privé <@${userId}> et <@${interaction.user.id}> !\n\nVotre session est officiellement bloquée pour le **${exactTime}**.\n\nUtilisez cet espace pour envoyer vos codes de rediffusions (VODs), vos trackers, ou discuter de vos objectifs de grind avant la session.`,
                    components: [threadRow]
                });

                // Supprimer le message d'attente des logs d'origine
                await interaction.message.delete();
                await interaction.editReply({ content: `✅ Le coaching est planifié ! Fil créé : <#${thread.id}>` });
            }

            // 5. Annulation d'une séance par le joueur ou le coach
            if (interaction.isButton() && interaction.customId.startsWith("cancel_session_")) {
                const userId = interaction.customId.split("_")[2];
                
                // Autorisé uniquement pour le joueur concerné ou un modérateur/coach
                if (interaction.user.id !== userId && !interaction.member.permissions.has("ManageMessages")) {
                    return interaction.reply({ content: "Seul le joueur concerné ou le coach peut annuler ce rendez-vous.", ephemeral: true });
                }

                resetQuota(userId); // On libère sa place pour le mois en cours

                const logsChannel = client.channels.cache.get(config.LOGS_CHANNEL);
                if (logsChannel) {
                    await logsChannel.send(`🛑 **Annulation :** La session de coaching pour <@${userId}> a été annulée.`);
                }

                await interaction.reply({ content: "La séance a été annulée avec succès. Ce fil de discussion va se fermer..." });
                
                setTimeout(async () => {
                    await interaction.channel.delete().catch(() => null);
                }, 5000);
            }

        } catch (error) {
            console.error("Erreur système Coaching :", error);
        }
    });
};
