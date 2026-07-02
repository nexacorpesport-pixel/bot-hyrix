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

const ROLE_DISPO = "1522242965823684609";
const ROLE_INDISPO = "1522243018453684266";

// Chargement initial des configurations
let config = {};
if (fs.existsSync(CONFIG_PATH)) {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
}

if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify({ dashboardMessageId: null, sessions: [], history: [] }, null, 2));
}
let coachingData = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
if (!coachingData.history) coachingData.history = [];

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
    if (!fs.existsSync(QUOTA_PATH)) fs.writeFileSync(QUOTA_PATH, JSON.stringify({}));
    const quotas = JSON.parse(fs.readFileSync(QUOTA_PATH, "utf-8"));
    quotas[userId] = new Date().getMonth() + "-" + new Date().getFullYear();
    fs.writeFileSync(QUOTA_PATH, JSON.stringify(quotas, null, 2));
}

function resetQuota(userId) {
    if (!fs.existsSync(QUOTA_PATH)) fs.writeFileSync(QUOTA_PATH, JSON.stringify({}));
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
        .setFooter({ text: "Système automatique d'élite • Team HoveX" });

    let description = "### 📋 Liste des séances planifiées\n\n";

    if (coachingData.sessions.length === 0) {
        description += "*Aucune séance active ou planifiée pour le moment.*";
    } else {
        coachingData.sessions.forEach(s => {
            let statusEmoji = "⏳";
            if (s.status === "EN COURS") statusEmoji = "🟢";
            if (s.status === "REPORTÉ") statusEmoji = "🔁";

            description += `**${statusEmoji} [${s.status}]**\n` +
                `└ **Date/Heure :** \`${s.time}\`\n` +
                `└ **Joueur :** <@${s.userId}> | **Coach :** <@${s.coachId}>\n` +
                `└ **Détails :** ${s.game}\n\n`;
        });
    }

    if (coachingData.history && coachingData.history.length > 0) {
        description += "\n---\n### ✅ Dernières sessions terminées (Historique)\n";
        coachingData.history.slice(-5).reverse().forEach(h => {
            description += `• <@${h.userId}> par <@${h.coachId}> ➔ *${h.game}*\n`;
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

// --- SYSTÈME DE DÉTECTION VOCALE AUTOMATIQUE ---
function startVoiceChecker(client) {
    setInterval(async () => {
        if (!coachingData.sessions || coachingData.sessions.length === 0) return;
        let change = false;

        for (const session of coachingData.sessions) {
            if (session.status === "EN COURS") continue;

            const guild = client.guilds.cache.first(); // Récupère le serveur
            if (!guild) continue;

            const coachMember = await guild.members.fetch(session.coachId).catch(() => null);
            const userMember = await guild.members.fetch(session.userId).catch(() => null);

            if (coachMember && userMember && coachMember.voice.channelId && userMember.voice.channelId) {
                const v1 = config.VOICE_COACHING_1;
                const v2 = config.VOICE_COACHING_2;
                const cId = coachMember.voice.channelId;
                const uId = userMember.voice.channelId;

                // Si les deux sont dans le même salon de coaching vocal
                if (cId === uId && (cId === v1 || cId === v2)) {
                    session.status = "EN COURS";
                    change = true;
                }
            }
        }

        if (change) {
            saveCoachingData();
            await updateDashboard(client);
        }
    }, 60000); // Scan toutes les 60 secondes
}

module.exports = async (client) => {
    console.log("[🎯 COACHING] Module Dashboard & Grinders initialisé avec succès !");
    startVoiceChecker(client);

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
                    "• Indique clairement tes points faibles et tes disponibilités."
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
            if (interaction.isButton() && interaction.customId === "start_apply") {
                if (!checkQuota(interaction.user.id)) {
                    return interaction.reply({ content: "❌ Tu as déjà demandé ou effectué un coaching ce mois-ci.", ephemeral: true });
                }

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId("select_pr")
                    .setPlaceholder("Sélectionne ton Power Ranking (PR) actuel :")
                    .addOptions([
                        { label: "Entre 0 et 20 PR", value: "0-20" },
                        { label: "Entre 20 et 40 PR", value: "20-40" },
                        { label: "Entre 40 et 60 PR", value: "40-60" },
                        { label: "Entre 60 et 80 PR", value: "60-80" },
                        { label: "Plus de 80 / 100+ PR", value: "80-100+" }
                    ]);

                await interaction.reply({ 
                    content: "Étape 1/2 : Indique ta tranche de PR pour débloquer le formulaire.", 
                    components: [new ActionRowBuilder().addComponents(selectMenu)], 
                    ephemeral: true 
                });
            }

            if (interaction.isStringSelectMenu() && interaction.customId === "select_pr") {
                const prValue = interaction.values[0];
                const modal = new ModalBuilder().setCustomId(`modal_coaching_${prValue}`).setTitle("Fiche de Suivi Coaching");

                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("c_age").setLabel("Ton Âge :").setPlaceholder("Ex: 16 ans").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("c_rank").setLabel("Ton Rang actuel :").setPlaceholder("Ex: Unreal / Radiant / Master").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("c_weak").setLabel("Points Faibles :").setPlaceholder("Détaille ici tes difficultés (Mécaniques, mental, stress...)").setStyle(TextInputStyle.Paragraph).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("c_date").setLabel("Tes disponibilités globales :").setPlaceholder("Ex: Le week-end en après-midi").setStyle(TextInputStyle.Short).setRequired(true))
                );

                await interaction.showModal(modal);
            }

            if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_coaching_")) {
                await interaction.deferReply({ ephemeral: true });
                const prValue = interaction.customId.split("_")[2];
                const age = interaction.fields.getTextInputValue("c_age");
                const rank = interaction.fields.getTextInputValue("c_rank");
                const weaknesses = interaction.fields.getTextInputValue("c_weak");
                const dateWish = interaction.fields.getTextInputValue("c_date");

                setQuota(interaction.user.id);

                const logChannel = client.channels.cache.get(config.LOGS_CHANNEL);
                if (!logChannel) return interaction.editReply({ content: "Erreur technique : Salon des logs introuvable." });

                const embed = new EmbedBuilder()
                    .setTitle(`🎯 Nouvelle demande de Coaching ─ ${interaction.user.username}`)
                    .addFields(
                        { name: "👤 Joueur", value: `<@${interaction.user.id}>`, inline: true },
                        { name: "🎂 Âge", value: age, inline: true },
                        { name: "📈 Power Ranking", value: `${prValue} PR`, inline: true },
                        { name: "🏆 Rang", value: rank, inline: true },
                        { name: "🗓️ Créneaux", value: dateWish, inline: true },
                        { name: "⚠️ Points faibles indiqués", value: weaknesses, inline: false }
                    )
                    .setColor("#ff007f")
                    .setTimestamp();

                const safeRank = rank.replace(/[^a-zA-Z0-9]/g, ' ') || "Coaching";
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`accept_${interaction.user.id}_${safeRank}`).setLabel("Accepter & Fixer l'heure").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`deny_${interaction.user.id}`).setLabel("Refuser la demande").setStyle(ButtonStyle.Danger)
                );

                await logChannel.send({ embeds: [embed], components: [row] });
                await interaction.editReply({ content: "✅ Ta fiche de grinder a bien été transmise au pôle coaching !" });
            }

            if (interaction.isButton() && (interaction.customId.startsWith("accept_") || interaction.customId.startsWith("deny_"))) {
                if (!interaction.member.permissions.has("ManageMessages")) {
                    return interaction.reply({ content: "❌ Seul le staff ou un coach peut gérer cette demande.", ephemeral: true });
                }

                const action = interaction.customId.split("_")[0];
                const userId = interaction.customId.split("_")[1];

                if (action === "deny") {
                    resetQuota(userId);
                    const targetUser = await client.users.fetch(userId).catch(() => null);
                    if (targetUser) await targetUser.send("❌ Ta demande de coaching pour la Team HoveX a été refusée.").catch(() => null);
                    
                    await interaction.message.delete().catch(() => null);
                    return interaction.reply({ content: "Candidature refusée.", ephemeral: true });
                }

                if (action === "accept") {
                    const rankInfo = interaction.customId.split("_")[2] || "Coaching";
                    const coachModal = new ModalBuilder().setCustomId(`final_plan_${userId}_${rankInfo}`).setTitle("Planification de la séance");
                    coachModal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("f_time").setLabel("Fixer le Jour et l'Heure exacte :").setPlaceholder("Ex: Samedi à 15h30").setStyle(TextInputStyle.Short).setRequired(true)));
                    await interaction.showModal(coachModal);
                }
            }

            if (interaction.isModalSubmit() && interaction.customId.startsWith("final_plan_")) {
                await interaction.deferReply({ ephemeral: true });
                const userId = interaction.customId.split("_")[2];
                const rankInfo = interaction.customId.split("_")[3];
                const time = interaction.fields.getTextInputValue("f_time");

                const targetMember = await interaction.guild.members.fetch(userId).catch(() => null);
                if (!targetMember) return interaction.editReply({ content: "Le joueur a quitté le Discord." });

                // Update rôles du Coach (Passe en Indisponible)
                await interaction.member.roles.remove(ROLE_DISPO).catch(() => null);
                await interaction.member.roles.add(ROLE_INDISPO).catch(() => null);

                coachingData.sessions.push({
                    userId, coachId: interaction.user.id, time, status: "EN ATTENTE", game: `Rang: ${rankInfo}`
                });
                saveCoachingData();

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
                await interaction.editReply({ content: "✅ Séance ajoutée au planning et rôles mis à jour !" });
            }

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
                    coachingData.history.push(session); // Ajout à l'historique global
                    coachingData.sessions = coachingData.sessions.filter(s => s.userId !== userId);
                    
                    // Reset des rôles du Coach (Repasse en Disponible)
                    const coachMember = await interaction.guild.members.fetch(session.coachId).catch(() => null);
                    if (coachMember) {
                        await coachMember.roles.remove(ROLE_INDISPO).catch(() => null);
                        await coachMember.roles.add(ROLE_DISPO).catch(() => null);
                    }

                    await interaction.reply({ content: "✅ Séance archivée avec succès. Fermeture du salon dans 10 secondes..." });
                    setTimeout(() => interaction.channel.delete().catch(() => null), 10000);
                }

                saveCoachingData();
                await updateDashboard(client);
            }

            if (interaction.isModalSubmit() && interaction.customId.startsWith("update_time_")) {
                const userId = interaction.customId.split("_")[2];
                const newTime = interaction.fields.getTextInputValue("new_time");
                const session = coachingData.sessions.find(s => s.userId === userId);

                if (session) {
                    session.time = newTime;
                    session.status = "REPORTÉ";
                    saveCoachingData();
                    await updateDashboard(client);
                    await interaction.reply({ content: `🔁 Séance reportée au **${newTime}**.` });
                }
            }

            if (interaction.isButton() && interaction.customId === "refresh_dashboard") {
                const lastClick = cooldowns.get(interaction.user.id);
                if (lastClick && Date.now() - lastClick < 10000) {
                    return interaction.reply({ content: "⏳ Patiente 10 secondes avant d'actualiser.", ephemeral: true });
                }

                cooldowns.set(interaction.user.id, Date.now());
                await updateDashboard(client);
                await interaction.reply({ content: "✅ Tableau de bord actualisé !", ephemeral: true });
            }

        } catch (error) {
            console.error("Erreur interaction Coaching :", error);
        }
    });
};
