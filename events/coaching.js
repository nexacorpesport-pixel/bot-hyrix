const { 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder,
    ChannelType 
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "../data/coachingConfig.json");
const DATA_PATH = path.join(__dirname, "../data/coachingData.json");
const QUOTA_PATH = path.join(__dirname, "../data/coachingQuotas.json");

// Chargement initial des configurations
let config = {};
if (fs.existsSync(CONFIG_PATH)) {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
}

if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify({ dashboardMessageId: null, sessions: [] }, null, 2));
}
let coachingData = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));

const cooldowns = new Map();

// --- GESTION DE LA SAUVEGARDE ET DES QUOTAS ---
function saveCoachingData() {
    fs.writeFileSync(DATA_PATH, JSON.stringify(coachingData, null, 2));
}

function checkQuota(userId) {
    if (!fs.existsSync(QUOTA_PATH)) fs.writeFileSync(QUOTA_PATH, JSON.stringify({}));
    const quotas = JSON.parse(fs.readFileSync(QUOTA_PATH, "utf-8"));
    const currentMonth = new Date().getMonth() + "-" + new Date().getFullYear();
    return quotas[userId] !== currentMonth;
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

// --- ACTUALISATION DU DASHBOARD DYNAMIQUE ---
async function updateDashboard(client) {
    const channel = client.channels.cache.get(config.PLANNING_CHANNEL);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle("📅 TABLEAU DE BORD DES COACHINGS ─ HOVEX")
        .setColor("#ff007f")
        .setTimestamp()
        .setFooter({ text: "Système de suivi dynamique • Team HoveX" });

    let description = "### 📋 Liste des séances planifiées\n\n";

    if (coachingData.sessions.length === 0) {
        description += "*Aucune séance active ou planifiée pour le moment.*";
    } else {
        coachingData.sessions.forEach(s => {
            let statusEmoji = "⏳";
            if (s.status === "EN COURS") statusEmoji = "🟢";
            if (s.status === "REPORTÉ") statusEmoji = "🔁";
            if (s.status === "TERMINÉ") statusEmoji = "✅";

            description += `**${statusEmoji} [${s.status}]**\n` +
                `└ **Date/Heure :** \`${s.time}\`\n` +
                `└ **Joueur :** <@${s.userId}> | **Coach :** <@${s.coachId}>\n` +
                `└ **Détails :** ${s.game}\n\n`;
        });
    }

    embed.setDescription(description);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("refresh_dashboard")
            .setLabel("Actualiser le planning")
            .setEmoji("🔄")
            .setStyle(ButtonStyle.Secondary)
    );

    try {
        if (coachingData.dashboardMessageId) {
            const msg = await channel.messages.fetch(coachingData.dashboardMessageId).catch(() => null);
            if (msg) {
                return await msg.edit({ embeds: [embed], components: [row] });
            }
        }
        const newMsg = await channel.send({ embeds: [embed], components: [row] });
        coachingData.dashboardMessageId = newMsg.id;
        saveCoachingData();
    } catch (e) { 
        console.error("Erreur lors de la mise à jour du Dashboard :", e); 
    }
}

module.exports = async (client) => {
    console.log("[🎯 COACHING] Module Dashboard & Grinders initialisé avec succès !");

    client.on("messageCreate", async (message) => {
        if (message.author.bot || !message.member.permissions.has("Administrator")) return;

        if (message.content === "!setupcoaching") {
            await message.delete();

            const embed = new EmbedBuilder()
                .setTitle("🎯 PÔLE PERFORMANCE & GRIND ─ TEAM HOVEX")
                .setDescription(
                    "Prêt à passer au niveau supérieur et perfectionner ton gameplay ?\n\n" +
                    "⚠️ **Règles importantes :**\n" +
                    "• **1 seule séance** par mois et par grinder.\n" +
                    "• Remplis ta fiche avec un maximum de sérieux.\n" +
                    "• L'honnêteté sur tes points faibles est obligatoire."
                )
                .setColor("#ff007f");

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("start_apply")
                    .setLabel("Demander un Coaching 🎮")
                    .setStyle(ButtonStyle.Primary)
            );

            await message.channel.send({ embeds: [embed], components: [row] });
        }
    });

    client.on("interactionCreate", async (interaction) => {
        try {
            // 1. Clic sur le bouton de départ
            if (interaction.isButton() && interaction.customId === "start_apply") {
                if (!checkQuota(interaction.user.id)) {
                    return interaction.reply({ content: "❌ Tu as déjà demandé ou effectué un coaching ce mois-ci.", ephemeral: true });
                }

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId("select_earnings")
                    .setPlaceholder("Sélectionne tes gains actuels (Earnings/PR) :")
                    .addOptions([
                        { label: "Entre 0 et 20", value: "0-20" },
                        { label: "Entre 20 et 40", value: "20-40" },
                        { label: "Entre 40 et 60", value: "40-60" },
                        { label: "Entre 60 et 80", value: "60-80" },
                        { label: "Plus de 80 / 100", value: "80-100" }
                    ]);

                await interaction.reply({ 
                    content: "Étape 1/2 : Indique ton niveau de gains pour débloquer le formulaire.", 
                    components: [new ActionRowBuilder().addComponents(selectMenu)], 
                    ephemeral: true 
                });
            }

            // 2. Sélection du menu déroulant -> Ouverture du Modal
            if (interaction.isStringSelectMenu() && interaction.customId === "select_earnings") {
                const earnings = interaction.values[0];
                
                const modal = new ModalBuilder()
                    .setCustomId(`modal_coaching_${earnings}`)
                    .setTitle("Fiche de Suivi Coaching");

                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("c_age").setLabel("Ton Âge :").setPlaceholder("Ex: 16 ans").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("c_game").setLabel("Jeu & Rang actuel :").setPlaceholder("Ex: Fortnite - Unreal").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("c_weak").setLabel("Points Faibles (SINCÈRE & OBLIGATOIRE) :").setPlaceholder("Détaille ici tes difficultés (Mécaniques, mental, stress...)").setStyle(TextInputStyle.Paragraph).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("c_date").setLabel("Tes disponibilités globales :").setPlaceholder("Ex: Le week-end en après-midi").setStyle(TextInputStyle.Short).setRequired(true))
                );

                await interaction.showModal(modal);
            }

            // 3. Traitement de la fiche envoyée
            if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_coaching_")) {
                await interaction.deferReply({ ephemeral: true });
                const earnings = interaction.customId.split("_")[2];
                const age = interaction.fields.getTextInputValue("c_age");
                const game = interaction.fields.getTextInputValue("c_game");
                const weaknesses = interaction.fields.getTextInputValue("c_weak");
                const dateWish = interaction.fields.getTextInputValue("c_date");

                if (weaknesses.length < 10 || weaknesses.toLowerCase().includes("aucun")) {
                    return interaction.editReply({ content: "❌ **Demande annulée :** Tu dois inscrire de vrais points faibles pour qu'un coach puisse t'accompagner." });
                }

                setQuota(interaction.user.id);

                const logChannel = client.channels.cache.get(config.LOGS_CHANNEL);
                if (!logChannel) return interaction.editReply({ content: "Erreur technique : Salon des logs introuvable." });

                const embed = new EmbedBuilder()
                    .setTitle(`🎯 Nouvelle demande de Coaching ─ ${interaction.user.username}`)
                    .addFields(
                        { name: "👤 Joueur", value: `<@${interaction.user.id}>`, inline: true },
                        { name: "🎂 Âge", value: age, inline: true },
                        { name: "💰 Power Ranking", value: `${earnings}€`, inline: true },
                        { name: "🎮 Jeu & Rang", value: game, inline: true },
                        { name: "🗓️ Créneaux", value: dateWish, inline: true },
                        { name: "⚠️ Points faibles indiqués", value: weaknesses, inline: false }
                    )
                    .setColor("#ff007f")
                    .setTimestamp();

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`accept_${interaction.user.id}_${game.replace(/[^a-zA-Z0-9]/g, ' ')}`).setLabel("Accepter & Fixer l'heure").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`deny_${interaction.user.id}`).setLabel("Refuser la demande").setStyle(ButtonStyle.Danger)
                );

                await logChannel.send({ embeds: [embed], components: [row] });
                await interaction.editReply({ content: "✅ Ta fiche de grinder a bien été transmise au pôle coaching !" });
            }

            // 4. Actions des Coachs (Accepter / Refuser)
            if (interaction.isButton() && (interaction.customId.startsWith("accept_") || interaction.customId.startsWith("deny_"))) {
                if (!interaction.member.permissions.has("ManageMessages")) {
                    return interaction.reply({ content: "❌ Seul le staff ou un coach peut gérer cette demande.", ephemeral: true });
                }

                const action = interaction.customId.split("_")[0];
                const userId = interaction.customId.split("_")[1];

                if (action === "deny") {
                    resetQuota(userId);
                    const targetUser = await client.users.fetch(userId).catch(() => null);
                    if (targetUser) await targetUser.send("❌ Ta demande de coaching pour la Team HoveX a été refusée (Fiche incomplète ou manque de disponibilités).").catch(() => null);
                    
                    await interaction.message.delete();
                    return interaction.reply({ content: "Candidature refusée.", ephemeral: true });
                }

                if (action === "accept") {
                    const gameInfo = interaction.customId.split("_")[2] || "Coaching";
                    const coachModal = new ModalBuilder().setCustomId(`final_plan_${userId}_${gameInfo}`).setTitle("Planification de la séance");
                    coachModal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("f_time").setLabel("Fixer le Jour et l'Heure exacte :").setPlaceholder("Ex: Samedi à 15h30").setStyle(TextInputStyle.Short).setRequired(true)));
                    await interaction.showModal(coachModal);
                }
            }

            // 5. Validation finale de la date et création du fil
            if (interaction.isModalSubmit() && interaction.customId.startsWith("final_plan_")) {
                await interaction.deferReply({ ephemeral: true });
                const userId = interaction.customId.split("_")[2];
                const gameInfo = interaction.customId.split("_")[3];
                const time = interaction.fields.getTextInputValue("f_time");

                const targetMember = await interaction.guild.members.fetch(userId).catch(() => null);
                if (!targetMember) return interaction.editReply({ content: "Le joueur a quitté le Discord." });

                coachingData.sessions.push({
                    userId, coachId: interaction.user.id, time, status: "EN ATTENTE", game: gameInfo
                });
                saveCoachingData();

                // Création du canal privé (Thread rattaché au salon des logs)
                const thread = await interaction.channel.threads.create({
                    name: `Coaching ─ ${targetMember.user.username}`,
                    type: ChannelType.PrivateThread,
                    reason: "Suivi coaching individuel"
                }).catch(() => null);

                if (thread) {
                    await thread.members.add(userId).catch(() => null);
                    await thread.members.add(interaction.user.id).catch(() => null);

                    const threadRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`status_encours_${userId}`).setLabel("Lancer la séance (En cours)").setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId(`status_report_${userId}`).setLabel("Reporter la séance").setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId(`status_fini_${userId}`).setLabel("Terminer (Clôturer)").setStyle(ButtonStyle.Success)
                    );

                    await thread.send({ 
                        content: `👋 Bienvenue dans votre salon de suivi <@${userId}> et <@${interaction.user.id}> !\n\nLa séance est officiellement planifiée pour le : **${time}**.\n\n_Les coachs disposent de boutons ci-dessous pour piloter le statut en direct sur le planning._`, 
                        components: [threadRow] 
                    });
                }

                await interaction.message.delete().catch(() => null);
                await updateDashboard(client);
                await interaction.editReply({ content: "✅ Séance ajoutée au planning et fil créé !" });
            }

            // 6. Gestion des boutons de statuts dans le fil de discussion
            if (interaction.isButton() && interaction.customId.startsWith("status_")) {
                const action = interaction.customId.split("_")[1];
                const userId = interaction.customId.split("_")[2];
                const session = coachingData.sessions.find(s => s.userId === userId);

                if (!session) return interaction.reply({ content: "Séance introuvable dans le tableau de bord.", ephemeral: true });

                if (action === "encours") {
                    session.status = "EN COURS";
                    await interaction.reply({ content: "🟢 La séance est maintenant marquée comme **En cours**." });
                }
                if (action === "report") {
                    session.status = "REPORTÉ";
                    const reportModal = new ModalBuilder().setCustomId(`update_time_${userId}`).setTitle("Reporter le rendez-vous");
                    reportModal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("new_time").setLabel("Nouvelle date / horaire :").setStyle(TextInputStyle.Short).setRequired(true)));
                    return await interaction.showModal(reportModal);
                }
                if (action === "fini") {
                    session.status = "TERMINÉ";
                    coachingData.sessions = coachingData.sessions.filter(s => s.userId !== userId);
                    await interaction.reply({ content: "✅ Séance validée et terminée. Fermeture du salon dans 10 secondes..." });
                    setTimeout(() => interaction.channel.delete().catch(() => null), 10000);
                }

                saveCoachingData();
                await updateDashboard(client);
            }

            // Report de date (Modal de mise à jour)
            if (interaction.isModalSubmit() && interaction.customId.startsWith("update_time_")) {
                const userId = interaction.customId.split("_")[2];
                const newTime = interaction.fields.getTextInputValue("new_time");
                const session = coachingData.sessions.find(s => s.userId === userId);

                if (session) {
                    session.time = newTime;
                    session.status = "REPORTÉ";
                    saveCoachingData();
                    await updateDashboard(client);
                    await interaction.reply({ content: `🔁 Séance reportée avec succès au **${newTime}**.` });
                }
            }

            // 7. Bouton d'actualisation manuelle du Dashboard (Cooldown 10s)
            if (interaction.isButton() && interaction.customId === "refresh_dashboard") {
                const lastClick = cooldowns.get(interaction.user.id);
                if (lastClick && Date.now() - lastClick < 10000) {
                    return interaction.reply({ content: "⏳ Patiente 10 secondes avant de rafraîchir à nouveau le planning.", ephemeral: true });
                }

                cooldowns.set(interaction.user.id, Date.now());
                await updateDashboard(client);
                await interaction.reply({ content: "✅ Le tableau de bord a été actualisé avec succès !", ephemeral: true });
            }

        } catch (error) {
            console.error("Erreur interaction Coaching :", error);
        }
    });
};
