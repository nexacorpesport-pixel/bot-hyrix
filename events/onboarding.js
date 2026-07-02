const { 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    PermissionsBitField, ChannelType 
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "../data/onboardingData.json");

// Chargement ou initialisation de la base de données persistante
if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify({ users: {}, stats: { tiktok: 0, media: 0, ami: 0, liste: 0, autre: 0 } }, null, 2));
}
let db = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));

function saveDB() {
    fs.writeFileSync(DATA_PATH, JSON.stringify(db, null, 2));
}

module.exports = (client) => {
    
    // Config Configuration des IDs (Inchangés)
    const LOGS_CHANNEL = "1521965352093749259";
    const ARRIVE_ROLE = "1521965478724108562";  
    const MEMBRE_ROLE = "1501625972896825434";  
    const VERIFIED_ROLE = "1501625972896825434"; 

    const HOMME_ROLE = "1501625976290021609";
    const FEMME_ROLE = "1501625977296654376";
    const NP_ROLE = "1501625978621788291";

    const ANNONCES_ROLE = "1501625982937727096";
    const LIVES_ROLE = "1501625985588793494";
    const EVENTS_ROLE = "1501625944148934758"; // Correction ID doublon potentiel
    const RESEAUX_ROLE = "1501625974066909374";

    const JOUEUR_ROLE = "1501625979905245215";
    const STAFF_ROLE = "1501625981495021721";
    const CEO_ROLE = "1501625944148934758";

    // Outils de nettoyage des rôles
    const clearOnboardingRoles = async (member) => {
        const rolesToRemove = [HOMME_ROLE, FEMME_ROLE, NP_ROLE, ANNONCES_ROLE, LIVES_ROLE, EVENTS_ROLE, RESEAUX_ROLE, JOUEUR_ROLE, STAFF_ROLE];
        for (const roleId of rolesToRemove) {
            if (member.roles.cache.has(roleId)) await member.roles.remove(roleId).catch(() => {});
        }
    };

    // --- LOGIQUE DE GÉNÉRATION DES EMBEDS D'ÉTAPES ---
    const getPayloadForStep = (member, step, extraCode = "") => {
        const embed = new EmbedBuilder().setColor("#ffb347").setTimestamp();
        const controls = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ob_control_help_${member.id}`).setLabel("Besoin d'aide ❓").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`ob_control_reset_${member.id}`).setLabel("Recommencer l'inscription 🔄").setStyle(ButtonStyle.Danger)
        );

        let components = [];

        switch(step) {
            case 1:
                embed.setTitle("✨ BIENVENUE SUR PYXAR ─ ÉTAPE 1")
                     .setDescription(`Bonjour ${member},\n\nPour débloquer l'accès complet au serveur, merci de configurer ton profil en répondant aux questions posées.\n\n**❓ Question : Quel est ton genre ?**\n_Clique sur le bouton correspondant ci-dessous._`)
                     .addFields({ name: "📊 Progression", value: "🟩⬜⬜⬜⬜⬜⬜ **1/7 (Configuration Genre)**" });
                
                components.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`ob_step1_homme_${member.id}`).setLabel("Homme 👨").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`ob_step1_femme_${member.id}`).setLabel("Femme 👩").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`ob_step1_np_${member.id}`).setLabel("Non spécifié 👤").setStyle(ButtonStyle.Secondary)
                ));
                break;

            case 2:
                embed.setTitle("📢 NOTIFICATIONS ─ ÉTAPE 2")
                     .setDescription(`**❓ Question : Quels types de notifications acceptes-tu de recevoir ?**\n\nTu peux en sélectionner plusieurs à la fois. Quand tu as fini ton choix, appuie sur le bouton vert **"Valider mes choix"** pour continuer.`)
                     .addFields({ name: "📊 Progression", value: "🟩🟩⬜⬜⬜⬜⬜ **2/7 (Abonnements Notifications)**" });
                
                components.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`ob_step2_toggle_annonces_${member.id}`).setLabel("Annonces 📢").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`ob_step2_toggle_lives_${member.id}`).setLabel("Lives 🎥").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`ob_step2_toggle_events_${member.id}`).setLabel("Events 🎉").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`ob_step2_toggle_reseaux_${member.id}`).setLabel("Réseaux 🌐").setStyle(ButtonStyle.Secondary)
                ));
                components.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`ob_step2_next_${member.id}`).setLabel("Valider mes choix ➔").setStyle(ButtonStyle.Success)
                ));
                break;

            case 3:
                embed.setTitle("🎯 TON OBJECTIF SUR LE SERVEUR ─ ÉTAPE 3")
                     .setDescription(`**❓ Question : Qu'envisages-tu de faire principalement au sein de notre communauté ?**\n_Choisis l'option qui te correspond le mieux._`)
                     .addFields({ name: "📊 Progression", value: "🟩🟩🟩⬜⬜⬜⬜ **3/7 (Définition Objectif)**" });

                components.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`ob_step3_joueur_${member.id}`).setLabel("Devenir Joueur 🎮").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`ob_step3_staff_${member.id}`).setLabel("Devenir Staff 🛠️").setStyle(ButtonStyle.Primary)
                ));
                break;

            case 4:
                embed.setTitle("🌐 ORIGINE D'ACQUISITION ─ ÉTAPE 4")
                     .setDescription(`**❓ Question : Par quel biais as-tu découvert l'existence de notre structure ?**\n_Cette statistique aide notre équipe marketing à s'améliorer._`)
                     .addFields({ name: "📊 Progression", value: "🟩🟩🟩🟩⬜⬜⬜ **4/7 (Source d'invitation)**" });

                components.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`ob_step4_tiktok_${member.id}`).setLabel("TikTok 📱").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`ob_step4_media_${member.id}`).setLabel("YouTube / Twitch 🎬").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`ob_step4_ami_${member.id}`).setLabel("Un ami 👥").setStyle(ButtonStyle.Primary)
                ));
                components.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`ob_step4_liste_${member.id}`).setLabel("Liste de Serveurs 🔍").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`ob_step4_autre_${member.id}`).setLabel("Autre raison ❓").setStyle(ButtonStyle.Primary)
                ));
                break;

            case 5:
                embed.setTitle("🧬 IDENTITÉ VISUELLE ─ ÉTAPE 5")
                     .setDescription(`**❓ Question : Souhaites-tu soutenir la structure en arborant notre tag devant ton pseudo ?**\n\nRendu attendu : \`HvX ${member.user.username}\`\n\n_Aucune obligation, tu es libre de refuser ! _`)
                     .addFields({ name: "📊 Progression", value: "🟩🟩🟩🟩🟩⬜⬜ **5/7 (Tag Identité)**" });

                components.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`ob_step5_yes_${member.id}`).setLabel("Oui, porter le préfixe 🧬").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`ob_step5_no_${member.id}`).setLabel("Non, garder mon pseudo actuel").setStyle(ButtonStyle.Secondary)
                ));
                break;

            case 6:
                embed.setTitle("⚖️ CHARTE ET RÈGLEMENT INTERNE ─ ÉTAPE 6")
                     .setDescription(`**⚠️ Dernière formalité administrative avant validation :**\n\nPour conserver une entente cordiale sur le serveur, tu t'engages à faire preuve de respect, à proscrire toute forme de toxicité et à respecter les consignes du Staff.\n\n_Appuie sur le bouton ci-dessous pour certifier ta lecture._`)
                     .addFields({ name: "📊 Progression", value: "🟩🟩🟩🟩🟩🟩⬜ **6/7 (Validation Règlement)**" });

                components.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`ob_step6_accept_${member.id}`).setLabel("J'ai lu et j'accepte le règlement de HoveX ✅").setStyle(ButtonStyle.Success)
                ));
                break;

            case 7:
                embed.setTitle("🛡️ COMPTE RENDU DE SÉCURITÉ (CAPTCHA) ─ ÉTAPE 7")
                     .setDescription(`**🔒 Étape anti-bot finale :**\n\nRecopie exactement le code de sécurité à 4 chiffres ci-dessous directement dans ce salon de discussion :\n\n# 🔢 Code de sécurité : \`${extraCode}\``)
                     .addFields({ name: "📊 Progression", value: "🟩🟩🟩🟩🟩🟩🟩 **7/7 (Vérification Humaine)**" });
                
                return { content: `${member}`, embeds: [embed], components: [] };
        }

        components.push(controls);
        return { content: `${member}`, embeds: [embed], components: components };
    };

    // --- ÉVÉNEMENT ARRIVÉE D'UN MEMBRE ---
    client.on("guildMemberAdd", async (member) => {
        try {
            if (member.user.bot) return;

            // Protection anti-doublon si le joueur a déjà un processus actif en BDD
            if (db.users[member.id]) return;

            await member.roles.add(ARRIVE_ROLE).catch(() => {});

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

            // Enregistrement persistant en BDD fichier
            db.users[member.id] = {
                channelId: channel.id,
                step: 1,
                rename: false,
                captcha: null,
                attempts: 0
            };
            saveDB();

            const payload = getPayloadForStep(member, 1);
            await channel.send(payload);

            // Log d'initialisation pour les admins
            const logChan = await member.guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
            if (logChan) {
                logChan.send({ content: `🛫 **Onboarding initialisé** pour ${member}. Salon créé : <#${channel.id}>` }).catch(() => {});
            }

        } catch (err) {
            console.error(err);
        }
    });

    // Nettoyage si le membre quitte le serveur avant la fin
    client.on("guildMemberRemove", async (member) => {
        const userData = db.users[member.id];
        if (userData) {
            const channel = await member.guild.channels.fetch(userData.channelId).catch(() => null);
            if (channel) await channel.delete().catch(() => {});
            delete db.users[member.id];
            saveDB();
        }
    });

    // =====================================================
    // 🌍 CORE SYSTEM : GESTIONNAIRE D'INTERACTIONS CENTRALISÉ (ANTI-CRASH)
    // =====================================================
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;

        const customId = interaction.customId;
        if (!customId.startsWith("ob_")) return;

        const parts = customId.split("_");
        const userId = parts[parts.length - 1]; // L'ID du membre est toujours en fin de customId

        if (interaction.user.id !== userId) {
            return interaction.reply({ content: "❌ Ce menu d'inscription ne t'est pas destiné.", ephemeral: true });
        }

        await interaction.deferUpdate().catch(() => {});

        const guild = interaction.guild;
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return;

        const userData = db.users[userId];
        if (!userData) return interaction.followUp({ content: "❌ Session expirée ou introuvable. Demande à un administrateur.", ephemeral: true });

        // --- GESTION DES BOUTONS DE CONTRÔLE UNIVERSALS ---
        if (customId.startsWith("ob_control_help_")) {
            const logChan = await guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
            if (logChan) logChan.send({ content: `⚠️ Assistance requise urgemment dans <#${userData.channelId}> par ${member}. <@&${CEO_ROLE}>` }).catch(() => {});
            return interaction.followUp({ content: "🔔 Un membre de la direction a été prévenu et arrive pour t'aider !", ephemeral: true });
        }

        if (customId.startsWith("ob_control_reset_")) {
            await clearOnboardingRoles(member);
            userData.step = 1;
            userData.rename = false;
            saveDB();
            const channel = await guild.channels.fetch(userData.channelId).catch(() => null);
            if (channel) await channel.setName(`👋┃${member.user.username.toLowerCase()}`).catch(() => {});
            const payload = getPayloadForStep(member, 1);
            return await interaction.message.edit(payload);
        }

        // --- INTERACTION DES ÉTAPES DE CONFIGURATION ---
        
        // ÉTAPE 1 : Traitement Genre
        if (customId.startsWith("ob_step1_")) {
            const choix = parts[2];
            let prefix = "👋";
            if (choix === "homme") { await member.roles.add(HOMME_ROLE).catch(() => {}); prefix = "👨"; }
            if (choix === "femme") { await member.roles.add(FEMME_ROLE).catch(() => {}); prefix = "👩"; }
            if (choix === "np") { await member.roles.add(NP_ROLE).catch(() => {}); prefix = "👤"; }

            const channel = await guild.channels.fetch(userData.channelId).catch(() => null);
            if (channel) await channel.setName(`${prefix}┃${member.user.username.toLowerCase()}`).catch(() => {});

            userData.step = 2;
            saveDB();
            return await interaction.message.edit(getPayloadForStep(member, 2));
        }

        // ÉTAPE 2 : Toggles pour rôles notifications
        if (customId.startsWith("ob_step2_toggle_")) {
            const typeNotif = parts[3];
            let targetRole = null;
            if (typeNotif === "annonces") targetRole = ANNONCES_ROLE;
            if (typeNotif === "lives") targetRole = LIVES_ROLE;
            if (typeNotif === "events") targetRole = EVENTS_ROLE;
            if (typeNotif === "reseaux") targetRole = RESEAUX_ROLE;

            if (targetRole) {
                if (member.roles.cache.has(targetRole)) {
                    await member.roles.remove(targetRole).catch(() => {});
                    await interaction.followUp({ content: `❌ Rôle de notification **${typeNotif.toUpperCase()}** retiré !`, ephemeral: true });
                } else {
                    await member.roles.add(targetRole).catch(() => {});
                    await interaction.followUp({ content: `✅ Rôle de notification **${typeNotif.toUpperCase()}** ajouté !`, ephemeral: true });
                }
            }
            return;
        }

        if (customId.startsWith("ob_step2_next_")) {
            userData.step = 3;
            saveDB();
            return await interaction.message.edit(getPayloadForStep(member, 3));
        }

        // ÉTAPE 3 : Choix Objectif
        if (customId.startsWith("ob_step3_")) {
            const obj = parts[2];
            if (obj === "joueur") await member.roles.add(JOUEUR_ROLE).catch(() => {});
            if (obj === "staff") await member.roles.add(STAFF_ROLE).catch(() => {});

            userData.step = 4;
            saveDB();
            return await interaction.message.edit(getPayloadForStep(member, 4));
        }

        // ÉTAPE 4 : Acquisition Marketing (Statistiques)
        if (customId.startsWith("ob_step4_")) {
            const source = parts[2];
            if (db.stats[source] !== undefined) db.stats[source]++;
            
            const logChan = await guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
            if (logChan) {
                logChan.send({ content: `📊 **Acquisition Marketing :** ${member} provient de \`${source.toUpperCase()}\` (Total source : ${db.stats[source]})` }).catch(() => {});
            }

            userData.step = 5;
            saveDB();
            return await interaction.message.edit(getPayloadForStep(member, 5));
        }

        // ÉTAPE 5 : Tag Identitaire
        if (customId.startsWith("ob_step5_")) {
            userData.rename = (parts[2] === "yes");
            userData.step = 6;
            saveDB();
            return await interaction.message.edit(getPayloadForStep(member, 6));
        }

        // ÉTAPE 6 : Acceptation Règlement ➔ Passage au Captcha Textuel
        if (customId.startsWith("ob_step6_")) {
            const codeSecu = Math.floor(1000 + Math.random() * 9000);
            userData.captcha = codeSecu;
            userData.attempts = 0;
            userData.step = 7;
            saveDB();
            return await interaction.message.edit(getPayloadForStep(member, 7, codeSecu.toString()));
        }
    });

    // =====================================================
    // 🛡️ LISTENER DU CHAT : DISCRIMINATION DU CAPTCHA FINAL
    // =====================================================
    client.on("messageCreate", async (msg) => {
        if (msg.author.bot) return;

        const userData = db.users[msg.author.id];
        if (!userData || userData.step !== 7) return;

        // On vérifie que le message provient bien de son salon unique d'inscription
        if (msg.channel.id !== userData.channelId) return;

        const cleanContent = msg.content.trim();

        if (cleanContent === userData.captcha?.toString()) {
            // Étape Validée avec Succès ! Clôture immédiate de la session
            const guild = msg.guild;
            const member = await guild.members.fetch(msg.author.id).catch(() => null);

            if (member) {
                if (userData.rename) {
                    await member.setNickname(`HvX ${member.user.username}`).catch(() => {});
                }
                await member.roles.remove(ARRIVE_ROLE).catch(() => {});
                await member.roles.add(MEMBRE_ROLE).catch(() => {});
                await member.roles.add(VERIFIED_ROLE).catch(() => {});

                const logChan = await guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
                if (logChan) {
                    logChan.send({ content: `✅ **Onboarding achevé avec succès** pour ${member}. Profil configuré et vérifié.` }).catch(() => {});
                }
            }

            const endEmbed = new EmbedBuilder()
                .setColor("#57f287")
                .setTitle("✅ Profil Intégralement Validé !")
                .setDescription("Félicitations, ton inscription est désormais terminée. Les salons de la structure viennent de t'être déverrouillés !");
            
            await msg.channel.send({ embeds: [endEmbed] }).catch(() => {});

            delete db.users[msg.author.id];
            saveDB();

            setTimeout(async () => {
                await msg.channel.delete().catch(() => {});
            }, 5000);

        } else {
            // Gestion de l'échec de saisie du Captcha
            userData.attempts++;
            if (userData.attempts >= 3) {
                const newCode = Math.floor(1000 + Math.random() * 9000);
                userData.captcha = newCode;
                userData.attempts = 0;
                saveDB();
                
                // Actualisation de l'affichage avec le nouveau code
                const member = await msg.guild.members.fetch(msg.author.id).catch(() => null);
                const mainMsg = await msg.channel.messages.fetch({ limit: 10 }).then(messages => messages.find(m => m.author.id === client.user.id && m.embeds.length > 0));
                if (mainMsg && member) {
                    const embed = new EmbedBuilder()
                        .setColor("#ffb347")
                        .setTitle("🛡️ COMPTE RENDU DE SÉCURITÉ (CAPTCHA) ─ ÉTAPE 7")
                        .setDescription(`**🔒 Code renouvelé suite à 3 échecs !**\n\nRecopie exactement ce nouveau code à 4 chiffres :\n\n# 🔢 Code de sécurité : \`${newCode}\``)
                        .addFields({ name: "📊 Progression", value: "🟩🟩🟩🟩🟩🟩🟩 **7/7 (Vérification Humaine)**" });
                    await mainMsg.edit({ embeds: [embed] }).catch(() => {});
                }
                
                await msg.reply(`❌ **Trop d'erreurs de frappe !** Le code de sécurité vient d'être renouvelé. Merci de retenter avec le nouveau code affiché ci-dessus.`).catch(() => {});
            } else {
                await msg.reply(`❌ **Code incorrect.** Attention aux fautes de frappe ! Il te reste **${3 - userData.attempts} essai(s)** avant régénération du code.`).catch(() => {});
            }
            saveDB();
        }
    });
};
