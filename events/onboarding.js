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
    
    // ⚙️ Configuration des IDs et Sécurisation
    const LOGS_CHANNEL = "1521965352093749259";
    const ARRIVE_ROLE = "1521965478724108562";  
    const MEMBRE_ROLE = "1501625972896825434";  
    const VERIFIED_ROLE = "1501625972896825434"; 

    const HOMME_ROLE = "1501625976290021609";
    const FEMME_ROLE = "1501625977296654376";
    const NP_ROLE = "1501625978621788291";

    const ANNONCES_ROLE = "1501625982937727096";
    const LIVES_ROLE = "1501625985588793494";
    const RESEAUX_ROLE = "1501625974066909374";
    const EVENTS_ROLE = "1501625984334561372"; // Rôle Événements sécurisé

    const JOUEUR_ROLE = "1501625979905245215";
    const STAFF_ROLE = "1501625981495021721";
    const CEO_ROLE = "1501625944148934758"; 

    // Outils de nettoyage des rôles
    const clearOnboardingRoles = async (member) => {
        const rolesToRemove = [HOMME_ROLE, FEMME_ROLE, NP_ROLE, ANNONCES_ROLE, LIVES_ROLE, EVENTS_ROLE, RESEAUX_ROLE, JOUEUR_ROLE, STAFF_ROLE];
        for (const roleId of rolesToRemove) {
            if (roleId === CEO_ROLE) continue; 
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
                embed.setTitle("✨ BIENVENUE SUR HOVEX ─ ÉTAPE 1")
                     .setDescription(`Bonjour ${member},\n\nPour débloquer l'accès complet au serveur, merci de configurer ton profil en répondant aux questions posées.\n\n**❓ Question : Quel est ton genre ?**\n_Clique sur ton choix ci-dessous._`)
                     .addFields({ name: "📊 Progression", value: "🟩⬜⬜⬜⬜⬜⬜ **1/7 (Configuration Genre)**" });
                
                components.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`ob_step1_homme_${member.id}`).setLabel("Homme 👨").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`ob_step1_femme_${member.id}`).setLabel("Femme 👩").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`ob_step1_np_${member.id}`).setLabel("Non spécifié 👤").setStyle(ButtonStyle.Secondary)
                ));
                break;

            case 2:
                // Construction dynamique de l'état des abonnements pour que le membre comprenne
                const hasAnnonces = member.roles.cache.has(ANNONCES_ROLE) ? "🟢 ACTIVÉ" : "🔴 DÉSACTIVÉ";
                const hasLives = member.roles.cache.has(LIVES_ROLE) ? "🟢 ACTIVÉ" : "🔴 DÉSACTIVÉ";
                const hasEvents = member.roles.cache.has(EVENTS_ROLE) ? "🟢 ACTIVÉ" : "🔴 DÉSACTIVÉ";
                const hasReseaux = member.roles.cache.has(RESEAUX_ROLE) ? "🟢 ACTIVÉ" : "🔴 DÉSACTIVÉ";

                embed.setTitle("📢 ROLES DE NOTIFICATIONS ─ ÉTAPE 2")
                     .setDescription(`**❓ Question : Quels types de notifications acceptes-tu de recevoir ?**\n\nClique sur les boutons gris pour activer/désactiver tes abonnements.\nUne fois que ton choix te convient, clique sur le bouton vert **"Valider mes choix"**.\n\n📊 **Tes abonnements actuels :**\n• Annonces : **${hasAnnonces}**\n• Lives : **${hasLives}**\n• Events : **${hasEvents}**\n• Réseaux : **${hasReseaux}**`)
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
                     .setDescription(`**❓ Question : Souhaites-tu soutenir la structure en arborant notre tag devant ton pseudo ?**\n\nRendu attendu : \`HvX ${member.displayName}\`\n\n_Aucune obligation, tu es libre de refuser ! _`)
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
                     .setDescription(`**🔒 Étape anti-bot finale :**\n\nRecopie exactement le code de sécurité à 4 chiffres ci-dessous en l'écrivant directement dans ce salon de discussion :\n\n# 🔢 Code de sécurité : \`${extraCode}\``)
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

            const logChan = await member.guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
            if (logChan) {
                logChan.send({ content: `🛫 **Onboarding initialisé** pour ${member}. Salon créé : <#${channel.id}>` }).catch(() => {});
            }

        } catch (err) {
            console.error(err);
        }
    });

    client.on("guildMemberRemove", async (member) => {
        const userData = db.users[member.id];
        if (userData) {
            const channel = await member.guild.channels.fetch(userData.channelId).catch(() => null);
            if (channel) await channel.delete().catch(() => {});
            delete db.users[member.id];
            saveDB();
        }
    });

    // --- GESTIONNAIRE D'INTERACTIONS CENTRALISÉ ---
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;

        const customId = interaction.customId;
        if (!customId.startsWith("ob_")) return;

        const parts = customId.split("_");
        const userId = parts[parts.length - 1];

        if (interaction.user.id !== userId) {
            return interaction.reply({ content: "❌ Ce menu d'inscription ne t'est pas destiné.", ephemeral: true });
        }

        await interaction.deferUpdate().catch(() => {});

        const guild = interaction.guild;
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return;

        const userData = db.users[userId];
        if (!userData) return interaction.followUp({ content: "❌ Session expirée.", ephemeral: true });

        // TUTO INTERACTIF EN CAS DE BESOIN D'AIDE (Résout le problème des membres bloqués sans déranger le staff)
        if (customId.startsWith("ob_control_help_")) {
            const helpEmbed = new EmbedBuilder()
                .setColor("#5865F2")
                .setTitle("📖 BESOIN D'AIDE ? VOICI LE GUIDE")
                .setDescription(`Pas de panique ! Voici comment valider ton profil en quelques secondes :\n\n` +
                                `**1️⃣ Étape des Notifications :** Tu peux cliquer sur plusieurs boutons pour choisir tes rôles. Une fois fini, tu **dois impérativement** cliquer sur le bouton vert **"Valider mes choix"** pour continuer.\n\n` +
                                `**2️⃣ Étape du Code (Captcha) :** À la fin, le bot affiche un code à 4 chiffres (ex: \`4852\`). Tu as juste à taper ce nombre dans le chat et à l'envoyer comme un message normal.\n\n` +
                                `_Si le menu est bloqué, tu peux cliquer sur "Recommencer l'inscription" à tout moment._`);

            await interaction.followUp({ embeds: [helpEmbed], ephemeral: true });

            const logChan = await guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
            if (logChan) logChan.send({ content: `ℹ️ **Auto-Assistance :** ${member} a demandé de l'aide. Le bot lui a envoyé le tutoriel explicatif avec succès.` }).catch(() => {});
            return;
        }

        if (customId.startsWith("ob_control_reset_")) {
            await clearOnboardingRoles(member);
            userData.step = 1;
            userData.rename = false;
            saveDB();
            const channel = await guild.channels.fetch(userData.channelId).catch(() => null);
            if (channel) await channel.setName(`👋┃${member.user.username.toLowerCase()}`).catch(() => {});
            return await interaction.message.edit(getPayloadForStep(member, 1));
        }

        // ÉTAPE 1 : Genre
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

        // ÉTAPE 2 : Notifications (Actualisation en direct de l'affichage)
        if (customId.startsWith("ob_step2_toggle_")) {
            const typeNotif = parts[3];
            let targetRole = null;
            if (typeNotif === "annonces") targetRole = ANNONCES_ROLE;
            if (typeNotif === "lives") targetRole = LIVES_ROLE;
            if (typeNotif === "events") targetRole = EVENTS_ROLE;
            if (typeNotif === "reseaux") targetRole = RESEAUX_ROLE;

            if (targetRole && targetRole !== CEO_ROLE) {
                if (member.roles.cache.has(targetRole)) {
                    await member.roles.remove(targetRole).catch(() => {});
                } else {
                    await member.roles.add(targetRole).catch(() => {});
                }
            }
            // Réactualise l'embed pour afficher en direct les rôles cochés/décochés
            return await interaction.message.edit(getPayloadForStep(member, 2));
        }

        if (customId.startsWith("ob_step2_next_")) {
            userData.step = 3;
            saveDB();
            return await interaction.message.edit(getPayloadForStep(member, 3));
        }

        // ÉTAPE 3 : Objectif
        if (customId.startsWith("ob_step3_")) {
            const obj = parts[2];
            if (obj === "joueur") await member.roles.add(JOUEUR_ROLE).catch(() => {});
            if (obj === "staff") await member.roles.add(STAFF_ROLE).catch(() => {});

            userData.step = 4;
            saveDB();
            return await interaction.message.edit(getPayloadForStep(member, 4));
        }

        // ÉTAPE 4 : Acquisition
        if (customId.startsWith("ob_step4_")) {
            const source = parts[2];
            if (db.stats[source] !== undefined) db.stats[source]++;
            
            const logChan = await guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
            if (logChan) {
                logChan.send({ content: `📊 **Acquisition Marketing :** ${member} via \`${source.toUpperCase()}\`` }).catch(() => {});
            }

            userData.step = 5;
            saveDB();
            return await interaction.message.edit(getPayloadForStep(member, 5));
        }

        // ÉTAPE 5 : Tag (Modifié pour utiliser le Pseudo d'affichage "displayName")
        if (customId.startsWith("ob_step5_")) {
            userData.rename = (parts[2] === "yes");
            userData.step = 6;
            saveDB();
            return await interaction.message.edit(getPayloadForStep(member, 6));
        }

        // ÉTAPE 6 : Règlement -> Captcha
        if (customId.startsWith("ob_step6_")) {
            const codeSecu = Math.floor(1000 + Math.random() * 9000);
            userData.captcha = codeSecu;
            userData.attempts = 0;
            userData.step = 7;
            saveDB();
            return await interaction.message.edit(getPayloadForStep(member, 7, codeSecu.toString()));
        }
    });

    // --- LISTENER DU CHAT : CAPTCHA FINAL ---
    client.on("messageCreate", async (msg) => {
        if (msg.author.bot) return;

        const userData = db.users[msg.author.id];
        if (!userData || userData.step !== 7) return;
        if (msg.channel.id !== userData.channelId) return;

        const cleanContent = msg.content.trim();

        if (cleanContent === userData.captcha?.toString()) {
            const guild = msg.guild;
            const member = await guild.members.fetch(msg.author.id).catch(() => null);

            if (member) {
                if (userData.rename) {
                    // Utilisation stricte de displayName (le pseudo propre de l'utilisateur)
                    await member.setNickname(`HvX ${member.displayName}`).catch(() => {});
                }
                await member.roles.remove(ARRIVE_ROLE).catch(() => {});
                await member.roles.add(MEMBRE_ROLE).catch(() => {});
                await member.roles.add(VERIFIED_ROLE).catch(() => {});

                const logChan = await guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
                if (logChan) {
                    logChan.send({ content: `✅ **Onboarding achevé** pour ${member}.` }).catch(() => {});
                }
            }

            const endEmbed = new EmbedBuilder()
                .setColor("#57f287")
                .setTitle("✅ Profil Intégralement Validé !")
                .setDescription("Félicitations, ton inscription est désormais terminée. Bienvenue chez HoveX !");
            
            await msg.channel.send({ embeds: [endEmbed] }).catch(() => {});

            delete db.users[msg.author.id];
            saveDB();

            setTimeout(async () => {
                await msg.channel.delete().catch(() => {});
            }, 5000);

        } else {
            userData.attempts++;
            if (userData.attempts >= 3) {
                const newCode = Math.floor(1000 + Math.random() * 9000);
                userData.captcha = newCode;
                userData.attempts = 0;
                saveDB();
                
                const member = await msg.guild.members.fetch(msg.author.id).catch(() => null);
                const mainMsg = await msg.channel.messages.fetch({ limit: 10 }).then(messages => messages.find(m => m.author.id === client.user.id && m.embeds.length > 0));
                if (mainMsg && member) {
                    const embed = new EmbedBuilder()
                        .setColor("#ffb347")
                        .setTitle("🛡️ COMPTE RENDU DE SÉCURITÉ (CAPTCHA) ─ ÉTAPE 7")
                        .setDescription(`**🔒 Code renouvelé suite à 3 échecs !**\n\nRecopie exactement ce nouveau code :\n\n# 🔢 Code de sécurité : \`${newCode}\``)
                        .addFields({ name: "📊 Progression", value: "🟩🟩🟩🟩🟩🟩🟩 **7/7 (Vérification Humaine)**" });
                    await mainMsg.edit({ embeds: [embed] }).catch(() => {});
                }
                await msg.reply(`❌ **Code renouvelé après 3 échecs.** Merci de retenter.`).catch(() => {});
            } else {
                await msg.reply(`❌ **Code incorrect.** Il te reste **${3 - userData.attempts} essai(s)**.`).catch(() => {});
            }
            saveDB();
        }
    });
};
