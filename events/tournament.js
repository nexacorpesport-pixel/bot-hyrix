const {
    ChannelType,
    PermissionsBitField,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require("discord.js");
const fs = require("fs");
const path = require("path");

// =========================================================================
// CONFIGURATION DES IDENTIFIANTS OFFICIELS AEROZ ESPORTS
// =========================================================================
const CONFERENCE_CHANNEL_ID = "1522934627461759067"; 
const TOURNAMENT_ROLE_ID = "1523810835338760192"; 
const ANNONCES_CHANNEL_ID = "1523811024707391620"; 
const ARBRE_CHANNEL_ID = "1523811049160179784";       
const LOGS_CHANNEL_ID = "1523811079409500200";         
const LINK_EVENT = "https://discord.com/events/1501625824028266676/1523813643870015558"; 

const DB_PATH = path.join(__dirname, "../data/tournament_database.json");

// Initialisation ultra-sécurisée de la base de données
if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ active: false, phase: "Inscriptions", treeMessageId: null, participants: [], matchups: [] }, null, 4));
}

function readDB() {
    try {
        return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    } catch (err) {
        console.error("[TOURNAMENT DB READ ERROR]", err);
        return { active: false, phase: "Inscriptions", treeMessageId: null, participants: [], matchups: [] };
    }
}

function writeDB(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 4), "utf-8");
    } catch (err) {
        console.error("[TOURNAMENT DB WRITE ERROR]", err);
    }
}

// Générateur automatique de l'arbre visuel (Brackets)
function generateTreeEmbed(db) {
    let title = db.phase === "Opens" ? "🏆 BRACKET OFFICIEL • OPENS" : `🏆 BRACKET OFFICIEL • PHASES FINALES (${db.phase})`;
    let description = `### 🌿 ÉTAPE EN COURS : ${db.phase.toUpperCase()}\n\n`;
    
    if (!db.matchups || db.matchups.length === 0) {
        description += "*Aucun match n'est programmé pour le moment.*";
    } else {
        db.matchups.forEach((m, index) => {
            let timeString = `\`⏱️ ${m.time}\``;
            
            if (!m.p2) {
                description += `${timeString} • Match **#${index + 1}**\n👑 <@${m.p1.id}> (Epic: \`${m.p1.epic}\`) ➜ **Qualifié d'office par tirage**\n\n`;
            } else {
                let p1Display = m.winner === m.p1.id ? `👑 **<@${m.p1.id}> (Epic: \`${m.p1.epic}\`)**` : (m.winner ? `❌ ~~<@${m.p1.id}>~~` : `<@${m.p1.id}> (Epic: \`${m.p1.epic}\`)`);
                let p2Display = m.winner === m.p2.id ? `👑 **<@${m.p2.id}> (Epic: \`${m.p2.epic}\`)**` : (m.winner ? `❌ ~~<@${m.p2.id}>~~` : `<@${m.p2.id}> (Epic: \`${m.p2.epic}\`)`);
                
                description += `${timeString} • Match **#${index + 1}**\n👉 ${p1Display}\n 🆚 \n👉 ${p2Display}\n\n`;
            }
        });
    }

    return new EmbedBuilder()
        .setColor("#ff6b00")
        .setTitle(title)
        .setDescription(description)
        .setFooter({ text: "Aeroz Esports • Système de Bracket Dynamique" })
        .setTimestamp();
}

module.exports = (client) => {

    // =========================================================================
    // ÉVÉNEMENT : GESTION DES BOUTONS ET POP-UPS (MODALS)
    // =========================================================================
    client.on("interactionCreate", async (interaction) => {
        try {
            if (interaction.isButton() && interaction.customId === "tn_register") {
                const db = readDB();
                if (db.active) {
                    return interaction.reply({ content: "❌ **Inscriptions clôturées :** Le tournoi a déjà commencé.", ephemeral: true });
                }
                if (db.participants.some(p => p.id === interaction.user.id)) {
                    return interaction.reply({ content: "❌ **Erreur :** Tu es déjà sur la liste des participants inscrits !", ephemeral: true });
                }

                const modal = new ModalBuilder().setCustomId("tn_modal_inscription").setTitle("Aeroz Tournament");
                const epicInput = new TextInputBuilder()
                    .setCustomId("epic_username")
                    .setLabel("Quel est ton pseudo Epic Games exact ?")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Ex: Aeroz_Luxx")
                    .setMinLength(3)
                    .setMaxLength(30)
                    .setRequired(true);
                
                modal.addComponents(new ActionRowBuilder().addComponents(epicInput));
                await interaction.showModal(modal);
            }

            if (interaction.isModalSubmit() && interaction.customId === "tn_modal_inscription") {
                const epicUsername = interaction.fields.getTextInputValue("epic_username");
                const db = readDB();

                if (db.participants.some(p => p.id === interaction.user.id)) {
                    return interaction.reply({ content: "❌ Tu es déjà inscrit.", ephemeral: true });
                }

                db.participants.push({ id: interaction.user.id, tag: interaction.user.tag, epic: epicUsername, status: "En lice" });
                writeDB(db);

                const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
                if (member) {
                    const role = interaction.guild.roles.cache.get(TOURNAMENT_ROLE_ID);
                    if (role) await member.roles.add(role).catch(() => {});
                }

                const logsChan = interaction.guild.channels.cache.get(LOGS_CHANNEL_ID);
                if (logsChan) {
                    await logsChan.send({ 
                        embeds: [new EmbedBuilder().setColor("#2ecc71").setTitle("📥 Nouvelle Inscription").setDescription(`👤 Joueur : <@${interaction.user.id}>\n🎮 Epic Games : \`${epicUsername}\``).setTimestamp()] 
                    });
                }

                return interaction.reply({ content: `✅ **Inscription validée !** Ton Epic enregistré : \`${epicUsername}\`.\nSoyez présent à 17h00 tapantes pour le lancement des Opens !`, ephemeral: true });
            }
        } catch (err) { 
            console.error("[INTERACTION ERROR]", err); 
        }
    });

    // =========================================================================
    // ÉVÉNEMENT : TOUTES LES COMMANDES DU SYSTÈME (STAFF & JOUEUR)
    // =========================================================================
    client.on("messageCreate", async (message) => {
        try {
            if (message.author.bot) return;

            const db = readDB();

            // 🌟 COMMANDE JOUEUR : !mystats
            if (message.content === "!mystats") {
                const player = db.participants.find(p => p.id === message.author.id);
                if (!player) {
                    return message.reply("❌ Tu n'es pas inscrit au tournoi actuel. Utilise le bouton dans le salon d'inscription pour nous rejoindre !");
                }

                const statsEmbed = new EmbedBuilder()
                    .setColor("#00ffcc")
                    .setTitle(`📊 FICHE COMPÉTITEUR • ${message.author.username}`)
                    .setDescription(
                        `🎮 **Pseudo Epic Games :** \`${player.epic}\`\n` +
                        `📋 **Statut Actuel :** ${player.status === "Eliminated" ? "❌ Éliminé" : "🟢 En lice / Qualifié"}\n\n` +
                        `🎁 **Récompense Finale :** Une grosse campagne de pub (Shoutout) sur tous les réseaux de la structure **Aeroz Esports** + Rôle exclusif !`
                    )
                    .setFooter({ text: "Aeroz Competitive Tracker" });

                return message.reply({ embeds: [statsEmbed] });
            }

            if (!message.content.startsWith("!tournament")) return;
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return message.reply("❌ Seul le Staff Supérieur d'Aeroz Esports peut utiliser cette commande.");
            }

            const args = message.content.split(" ");
            const cmd = args[1];

            // 🛠️ COMMANDES ADMIN 1 : !tournament setup
            if (cmd === "setup") {
                const embed = new EmbedBuilder()
                    .setColor("#ff6b00")
                    .setTitle("🏆 AEROZ REALISTIC TOURNAMENT • OPENS")
                    .setDescription(
                        `🔥 **Le grand tournoi 1v1 d'Aeroz Esports ouvre ses portes !**\n\n` +
                        `📌 **Événement Officiel Discord :** [Clique ici pour t'abonner à l'événement](${LINK_EVENT})\n\n` +
                        `⚠️ **RÈGLES D'ENGAGEMENT STRICTES :**\n` +
                        `• 🔒 **Aucun désengagement possible :** Si tu cliques, tu t'engages à participer. Les absents recevront un forfait immédiat.\n` +
                        `• ⏳ **Zéro retard toléré :** Les matchs s'enchaînent toutes les 10 minutes.\n` +
                        `• 🚫 **Zéro Trash-talk / Insulte :** Sanction immédiate par une disqualification définitive du joueur.\n\n` +
                        `🎁 **À GAGNER :** Une grosse mise en avant (Pub complète) sur tous nos réseaux Aeroz Esports + Rôle de Champion unique !`
                    )
                    .setFooter({ text: "Renseigne ton Epic Games en cliquant ci-dessous ⏬" });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("tn_register").setLabel("Renseigner son Epic & S'inscrire 🎮").setStyle(ButtonStyle.Success)
                );

                await message.channel.send({ content: "@everyone 🚨 **INSCRIPTIONS OUVERTES !**", embeds: [embed], components: [row] });
                return message.reply("✅ Panneau d'inscription pro envoyé avec succès.");
            }

            // 🛠️ COMMANDES ADMIN 2 : !tournament open
            if (cmd === "open") {
                if (db.participants.length < 2) return message.reply("❌ Impossible de démarrer : Il n'y a pas assez de joueurs inscrits.");

                db.active = true;
                db.phase = "Opens";

                // Algorithme de tri et mélange aléatoire
                let players = [...db.participants].sort(() => Math.random() - 0.5);
                db.matchups = [];

                let startTime = new Date();
                startTime.setHours(17, 10, 0, 0);

                for (let i = 0; i < players.length; i += 2) {
                    let matchTime = new Date(startTime.getTime() + (i / 2) * 10 * 60000);
                    let timeStr = `${matchTime.getHours().toString().padStart(2, '0')}h${matchTime.getMinutes().toString().padStart(2, '0')}`;
                    
                    if (players[i + 1]) {
                        db.matchups.push({ p1: players[i], p2: players[i + 1], time: timeStr, winner: null });
                    } else {
                        db.matchups.push({ p1: players[i], p2: null, time: timeStr, winner: players[i].id });
                    }
                }

                // Modification asynchrone et accélérée des rôles sur le salon Conférence
                const conf = message.guild.channels.cache.get(CONFERENCE_CHANNEL_ID);
                if (conf) {
                    const roles = await message.guild.roles.fetch();
                    const permPromises = roles.map(role => {
                        if (role.managed) return Promise.resolve();
                        return conf.permissionOverwrites.edit(role.id, {
                            ViewChannel: true, Connect: true, Speak: role.id === TOURNAMENT_ROLE_ID, SendMessages: true, ReadMessageHistory: true
                        }).catch(() => {});
                    });
                    await Promise.all(permPromises);
                }

                const arbreChan = message.guild.channels.cache.get(ARBRE_CHANNEL_ID);
                if (arbreChan) {
                    const sentMsg = await arbreChan.send({ embeds: [generateTreeEmbed(db)] });
                    db.treeMessageId = sentMsg.id;
                }

                const annoncesChan = message.guild.channels.cache.get(ANNONCES_CHANNEL_ID);
                if (annoncesChan) {
                    await annoncesChan.send({ 
                        content: `@everyone 🏆 **LES OPENS SONT OFFICIELLEMENT LANCÉS !**\n🎙️ Rejoignez immédiatement la <#${CONFERENCE_CHANNEL_ID}> pour assister au briefing des règles et suivre la diffusion des streams en direct !` 
                    });
                }

                writeDB(db);
                return message.reply("🏆 Les Opens sont ouverts, les permissions ont été débloquées pour tout le monde et l'arbre initial est créé !");
            }

            // 🛠️ COMMANDES ADMIN 3 : !tournament eliminate @joueur
            if (cmd === "eliminate") {
                const target = message.mentions.members.first();
                if (!target) return message.reply("❌ Syntaxe incorrecte. Exemple: `!tournament eliminate @joueur`");

                let matchFound = db.matchups.find(m => (m.p1.id === target.id || (m.p2 && m.p2.id === target.id)) && !m.winner);
                if (!matchFound) return message.reply("❌ Ce compétiteur n'a aucun match en cours ou actif.");

                const loserObj = matchFound.p1.id === target.id ? matchFound.p1 : matchFound.p2;
                const winnerObj = matchFound.p1.id === target.id ? matchFound.p2 : matchFound.p1;
                matchFound.winner = winnerObj.id;

                const pIndex = db.participants.findIndex(p => p.id === target.id);
                if (pIndex !== -1) db.participants[pIndex].status = "Eliminated";

                const role = message.guild.roles.cache.get(TOURNAMENT_ROLE_ID);
                if (role) await target.roles.remove(role).catch(() => {});

                writeDB(db);

                // Édition en temps réel du message de l'arbre
                const arbreChan = message.guild.channels.cache.get(ARBRE_CHANNEL_ID);
                if (arbreChan && db.treeMessageId) {
                    const treeMsg = await arbreChan.messages.fetch(db.treeMessageId).catch(() => null);
                    if (treeMsg) await treeMsg.edit({ embeds: [generateTreeEmbed(db)] });
                }

                // Envoi de la pluie de GG dans la conférence textuelle
                const confChan = message.guild.channels.cache.get(CONFERENCE_CHANNEL_ID);
                if (confChan) {
                    await confChan.send({
                        content: `🎉🎉 **PLUIE DE GG DANS LE CHAT !** 🎉🎉\n\n🏆 Fin du match ! Un énorme **GG** à nos deux compétiteurs Aeroz :\n👑 **Vainqueur :** <@${winnerObj.id}> (qualifié pour la suite !)\n👏 **Adversaire :** <@${loserObj.id}> (merci d'avoir tout donné !)\n\n💥 *Lâchez vos plus beaux GG l'équipe !*`
                    }).catch(() => {});
                }

                return message.reply(`✅ Match traité. L'arbre a été mis à jour et la pluie de GG est lancée.`);
            }

            // 🛠️ COMMANDES ADMIN 4 : !tournament next
            if (cmd === "next") {
                let qualifiedPlayers = db.participants.filter(p => p.status !== "Eliminated");
                if (qualifiedPlayers.length < 2) return message.reply("❌ Pas assez de survivants pour générer l'étape supérieure.");

                // Gestion automatique du nom de l'arbre en fonction des qualifiés restants
                if (qualifiedPlayers.length > 8 && qualifiedPlayers.length <= 16) db.phase = "8èmes de Finale";
                else if (qualifiedPlayers.length > 4 && qualifiedPlayers.length <= 8) db.phase = "Quarts de Finale";
                else if (qualifiedPlayers.length > 2 && qualifiedPlayers.length <= 4) db.phase = "Demi-Finales";
                else db.phase = "Grande Finale 👑";

                db.matchups = [];
                let startTime = new Date();
                startTime.setHours(17, 10, 0, 0); // Reprise à 17h10 le jour suivant

                for (let i = 0; i < qualifiedPlayers.length; i += 2) {
                    let matchTime = new Date(startTime.getTime() + (i / 2) * 15 * 60000); // 15 minutes d'intervalle pour les phases finales
                    let timeStr = `${matchTime.getHours().toString().padStart(2, '0')}h${matchTime.getMinutes().toString().padStart(2, '0')}`;
                    
                    if (qualifiedPlayers[i + 1]) {
                        db.matchups.push({ p1: qualifiedPlayers[i], p2: qualifiedPlayers[i + 1], time: timeStr, winner: null });
                    } else {
                        db.matchups.push({ p1: qualifiedPlayers[i], p2: null, time: timeStr, winner: qualifiedPlayers[i].id });
                    }
                }

                const arbreChan = message.guild.channels.cache.get(ARBRE_CHANNEL_ID);
                if (arbreChan && db.treeMessageId) {
                    const treeMsg = await arbreChan.messages.fetch(db.treeMessageId).catch(() => null);
                    if (treeMsg) await treeMsg.edit({ embeds: [generateTreeEmbed(db)] });
                }

                const annoncesChan = message.guild.channels.cache.get(ANNONCES_CHANNEL_ID);
                if (annoncesChan) {
                    await annoncesChan.send({
                        content: `@everyone 🚨 **LES OPENS SONT CLÔTURÉS !**\n\n🌿 L'arbre a été mis à jour dans <#${ARBRE_CHANNEL_ID}>.\nLes qualifiés s'affronteront demain à partir de **17h00** pour les **${db.phase}** en élimination directe ! 🔥`
                    });
                }

                writeDB(db);
                return message.reply(`🏆 Étape validée ! L'arbre affiche maintenant : **${db.phase}**.`);
            }

            // 🛠️ COMMANDES ADMIN 5 : !tournament summon
            if (cmd === "summon") {
                const conf = message.guild.channels.cache.get(CONFERENCE_CHANNEL_ID);
                if (!conf) return message.reply("❌ Salon conférence introuvable.");
                
                let count = 0;
                const voiceChannels = message.guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice && c.id !== CONFERENCE_CHANNEL_ID);
                
                for (const [_, chan] of voiceChannels) {
                    for (const [_, m] of chan.members) {
                        if (m.roles.cache.has(TOURNAMENT_ROLE_ID)) { 
                            await m.voice.setChannel(conf).catch(() => {}); 
                            count++; 
                        }
                    }
                }
                return message.reply(`📢 **Téléportation :** ${count} participants regroupés en conférence.`);
            }

            // 🛠️ COMMANDES ADMIN 6 : !tournament reset
            if (cmd === "reset") {
                writeDB({ active: false, phase: "Inscriptions", treeMessageId: null, participants: [], matchups: [] });
                return message.reply("🔄 Base de données du tournoi entièrement réinitialisée et nettoyée.");
            }

        } catch (err) { 
            console.error("[MESSAGE PROCESS ERROR]", err); 
        }
    });
};
