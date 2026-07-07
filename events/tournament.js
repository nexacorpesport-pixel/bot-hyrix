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

// CONFIGURATION DU CHOC DES TITANS (TÊTE D'AFFICHE OBLIGATOIRE MATCH #1)
const HEADLINER_1 = "1031138060445945866"; // Rio
const HEADLINER_2 = "1264673063350304830"; // Yaska

const DB_PATH = path.join(__dirname, "../data/tournament_database.json");

// Initialisation de la base de données V2
if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
if (!fs.existsSync(DB_PATH)) {
    resetDatabase();
}

function readDB() {
    try {
        return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    } catch (err) {
        console.error("[TOURNAMENT DB READ ERROR]", err);
        return { active: false, phase: "Inscriptions", treeMessageId: null, participants: [], matchups: [], history: [] };
    }
}

function writeDB(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 4), "utf-8");
    } catch (err) {
        console.error("[TOURNAMENT DB WRITE ERROR]", err);
    }
}

function resetDatabase() {
    fs.writeFileSync(DB_PATH, JSON.stringify({ 
        active: false, 
        phase: "Inscriptions", 
        treeMessageId: null, 
        participants: [], 
        matchups: [],
        history: [] // Pour la commande !tournament undo
    }, null, 4));
}

// Générateur d'arbre V2 (Sans horaires, affichage propre par Match #X)
function generateTreeEmbed(db) {
    let title = `🏆 BRACKET OFFICIEL • ${db.phase.toUpperCase()}`;
    let description = `### 🌿 ÉTAPE ACTUELLE : ${db.phase.toUpperCase()}\n`;
    description += `*Les matchs s'enchaînent en direct. Restez attentifs aux annonces vocales !*\n\n`;
    
    if (!db.matchups || db.matchups.length === 0) {
        description += "*Aucun match programmé.*";
    } else {
        db.matchups.forEach((m) => {
            let matchLabel = `**Match #${m.matchId}**`;
            
            if (!m.p2) {
                description += `🔹 ${matchLabel}\n👑 <@${m.p1.id}> (Epic: \`${m.p1.epic}\`) ➜ *Qualifié d'office*\n\n`;
            } else {
                let p1Display = m.winner === m.p1.id ? `👑 **<@${m.p1.id}> (\`${m.p1.epic}\`)**` : (m.winner ? `❌ ~~<@${m.p1.id}>~~` : `<@${m.p1.id}> (\`${m.p1.epic}\`)`);
                let p2Display = m.winner === m.p2.id ? `👑 **<@${m.p2.id}> (\`${m.p2.epic}\`)**` : (m.winner ? `❌ ~~<@${m.p2.id}>~~` : `<@${m.p2.id}> (\`${m.p2.epic}\`)`);
                
                description += `🔹 ${matchLabel}\n👉 ${p1Display}\n 🆚 \n👉 ${p2Display}\n\n`;
            }
        });
    }

    return new EmbedBuilder()
        .setColor("#deff9a")
        .setTitle(title)
        .setDescription(description)
        .setFooter({ text: "Aeroz Esports • Système Synchrone Automatisé V2" })
        .setTimestamp();
}

// Sauvegarde l'état actuel pour le système anti-erreur (Undo)
function saveToHistory(db) {
    // On garde uniquement les données nécessaires pour restaurer l'état précédent
    db.history.push({
        phase: db.phase,
        participants: JSON.parse(JSON.stringify(db.participants)),
        matchups: JSON.parse(JSON.stringify(db.matchups))
    });
    // Limite l'historique aux 5 dernières actions pour ne pas surcharger le fichier
    if (db.history.length > 5) db.history.shift();
}

module.exports = (client) => {

    client.on("interactionCreate", async (interaction) => {
        try {
            if (interaction.isButton() && interaction.customId === "tn_register") {
                const db = readDB();
                if (db.active) {
                    return interaction.reply({ content: "❌ **Inscriptions clôturées :** Le tournoi est en cours.", ephemeral: true });
                }
                if (db.participants.some(p => p.id === interaction.user.id)) {
                    return interaction.reply({ content: "❌ Tu es déjà inscrit à cet événement !", ephemeral: true });
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

                return interaction.reply({ content: `✅ **Inscription validée !** Pseudo Epic : \`${epicUsername}\`. Prépare-toi pour demain !`, ephemeral: true });
            }
        } catch (err) { 
            console.error("[INTERACTION ERROR]", err); 
        }
    });

    client.on("messageCreate", async (message) => {
        try {
            if (message.author.bot) return;
            const db = readDB();

            // 🌟 COMMANDE JOUEUR : !mystats
            if (message.content === "!mystats") {
                const player = db.participants.find(p => p.id === message.author.id);
                if (!player) {
                    return message.reply("❌ Tu n'es pas inscrit au tournoi. Utilise le panneau d'inscription !");
                }

                const statsEmbed = new EmbedBuilder()
                    .setColor("#deff9a")
                    .setTitle(`📊 FICHE COMPÉTITEUR • ${message.author.username}`)
                    .setDescription(
                        `🎮 **Pseudo Epic Games :** \`${player.epic}\`\n` +
                        `📋 **Statut Actuel :** ${player.status === "Eliminated" ? "❌ Éliminé" : "🟢 En lice / Qualifié"}\n\n` +
                        `🎁 **Récompense Finale :** Shoutout complet sur les réseaux d'**Aeroz Esports** + Rôle unique !`
                    );

                return message.reply({ embeds: [statsEmbed] });
            }

            if (!message.content.startsWith("!tournament")) return;
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return message.reply("❌ Seul le Staff Supérieur d'Aeroz Esports peut utiliser cette commande.");
            }

            const args = message.content.split(" ");
            const cmd = args[1];

            // 🛠️ !tournament setup
            if (cmd === "setup") {
                const embed = new EmbedBuilder()
                    .setColor("#ff6b00")
                    .setTitle("🏆 AEROZ REALISTIC TOURNAMENT • PHASES FINALES")
                    .setDescription(
                        `🔥 **Les Phases Finales (32 compétiteurs) d'Aeroz Esports vont commencer !**\n\n` +
                        `📌 **Événement Officiel Discord :** [Lien direct de l'événement](${LINK_EVENT})\n\n` +
                        `⚠️ **RÈGLES DU DIRECT (STRICTES) :**\n` +
                        `• ⏳ **Zéro retard toléré :** Les matchs s'enchaînent instantanément en stream.\n` +
                        `• 🔇 **Rôle :** Dès que vous perdez, votre rôle de participant saute automatiquement.\n` +
                        `• 🚫 **Zéro Trash-talk :** Disqualification définitive immédiate.\n\n` +
                        `🎁 **À GAGNER :** Visibilité maximale sur nos réseaux Aeroz Esports + Rôle Champion unique !`
                    )
                    .setFooter({ text: "Renseigne ton Epic Games en cliquant ci-dessous ⏬" });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("tn_register").setLabel("S'inscrire aux Phases Finales 🎮").setStyle(ButtonStyle.Danger)
                );

                await message.channel.send({ content: "@everyone 🚨 **PRÉPARATION DE L'ARBRE DE DEMAIN !**", embeds: [embed], components: [row] });
                return message.reply("✅ Panneau d'inscription envoyé.");
            }

            // 🛠️ !tournament open (Génération verrouillée à 32 joueurs max, sans horaires + Tête d'affiche)
            if (cmd === "open") {
                if (db.participants.length < 2) return message.reply("❌ Pas assez de joueurs.");

                saveToHistory(db);
                db.active = true;
                db.phase = "16èmes de Finale";

                let players = [...db.participants];
                
                // Extraction forcée de la tête d'affiche (Rio et Yaska)
                let p1Head = players.find(p => p.id === HEADLINER_1);
                let p2Head = players.find(p => p.id === HEADLINER_2);

                if (p1Head && p2Head) {
                    players = players.filter(p => p.id !== HEADLINER_1 && p.id !== HEADLINER_2);
                    // On mélange le reste des joueurs aléatoirement
                    players.sort(() => Math.random() - 0.5);
                    // On remet notre tête d'affiche tout en haut de la liste
                    players.unshift(p1Head, p2Head);
                } else {
                    players.sort(() => Math.random() - 0.5);
                }

                db.matchups = [];
                let matchIdCounter = 1;

                for (let i = 0; i < players.length; i += 2) {
                    if (players[i + 1]) {
                        db.matchups.push({ matchId: matchIdCounter++, p1: players[i], p2: players[i + 1], winner: null });
                    } else {
                        db.matchups.push({ matchId: matchIdCounter++, p1: players[i], p2: null, winner: players[i].id });
                    }
                }

                // Ajustement asynchrone des permissions du salon conférence
                const conf = message.guild.channels.cache.get(CONFERENCE_CHANNEL_ID);
                if (conf) {
                    await conf.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: true, Connect: true, Speak: false });
                    const role = message.guild.roles.cache.get(TOURNAMENT_ROLE_ID);
                    if (role) await conf.permissionOverwrites.edit(role, { Speak: true });
                }

                const arbreChan = message.guild.channels.cache.get(ARBRE_CHANNEL_ID);
                if (arbreChan) {
                    const sentMsg = await arbreChan.send({ embeds: [generateTreeEmbed(db)] });
                    db.treeMessageId = sentMsg.id;
                }

                const annoncesChan = message.guild.channels.cache.get(ANNONCES_CHANNEL_ID);
                if (annoncesChan) {
                    await annoncesChan.send({ 
                        content: `@everyone 🏆 **L'ARBRE DES 16ÈMES DE FINALE EST EN LIGNE !**\n🎙️ Rejoignez immédiatement <#${CONFERENCE_CHANNEL_ID}>, le stream commence ! Le gros choc de l'ouverture opposera <@${HEADLINER_1}> à <@${HEADLINER_2}> ! 🔥` 
                    });
                }

                writeDB(db);
                return message.reply("🏆 Arbre des 16èmes généré au millimètre ! Prêt à stream.");
            }

            // 🛠️ !tournament eliminate (Supporte Mention OU ID brut, indexation sécurisée et transition automatique)
            if (cmd === "eliminate") {
                let targetId = null;
                
                // Détection de l'argument (soit une mention, soit un ID brut de chiffres)
                if (message.mentions.members.first()) {
                    targetId = message.mentions.members.first().id;
                } else if (args[2] && /^\d+$/.test(args[2])) {
                    targetId = args[2];
                }

                if (!targetId) return message.reply("❌ Syntaxe incorrecte. Exemple: `!tournament eliminate @joueur` ou `!tournament eliminate ID_DISCORD`");

                let matchFound = db.matchups.find(m => (m.p1.id === targetId || (m.p2 && m.p2.id === targetId)) && !m.winner);
                if (!matchFound) return message.reply("❌ Ce joueur n'a aucun match actif dans cette phase.");

                saveToHistory(db);

                const loserId = targetId;
                const winnerObj = matchFound.p1.id === loserId ? matchFound.p2 : matchFound.p1;
                
                matchFound.winner = winnerObj.id;

                // Changement de statut dans la base
                const pIndex = db.participants.findIndex(p => p.id === loserId);
                if (pIndex !== -1) db.participants[pIndex].status = "Eliminated";

                // Retrait immédiat du rôle participant
                const targetMember = await message.guild.members.fetch(loserId).catch(() => null);
                if (targetMember) {
                    const role = message.guild.roles.cache.get(TOURNAMENT_ROLE_ID);
                    if (role) await targetMember.roles.remove(role).catch(() => {});
                }

                // Édition en direct de l'arbre visuel
                const arbreChan = message.guild.channels.cache.get(ARBRE_CHANNEL_ID);
                if (arbreChan && db.treeMessageId) {
                    const treeMsg = await arbreChan.messages.fetch(db.treeMessageId).catch(() => null);
                    if (treeMsg) await treeMsg.edit({ embeds: [generateTreeEmbed(db)] });
                }

                // Annonce dynamique du résultat dans le salon Conférence
                const confChan = message.guild.channels.cache.get(CONFERENCE_CHANNEL_ID);
                if (confChan) {
                    await confChan.send({
                        content: `🎯 **[MATCH #${matchFound.matchId} TERMINÉ]**\n👑 **<@${winnerObj.id}>** l'emporte avec brio et accède à l'étape suivante !\n❌ Subissant la loi du stream, <@${loserId}> est éliminé. Un maximum de GG à lui pour son parcours ! 👏`
                    }).catch(() => {});
                }

                // VERIFICATION AUTOMATIQUE : Est-ce que tous les matchs de la phase sont finis ?
                let roundFinished = db.matchups.every(m => m.winner !== null);
                if (roundFinished) {
                    writeDB(db);
                    await message.channel.send(`🚨 **Tous les matchs de cette phase sont terminés !** Lancement automatique de l'étape supérieure...`);
                    return triggerNextPhase(message, db);
                }

                writeDB(db);
                return message.reply(`✅ Match enregistré. Gagnant : <@${winnerObj.id}>.`);
            }

            // 🛠️ !tournament undo (Le protocole de secours ultime anti-fausse manip)
            if (cmd === "undo") {
                if (!db.history || db.history.length === 0) return message.reply("❌ Aucune action en mémoire à annuler.");

                const previousState = db.history.pop();
                
                db.phase = previousState.phase;
                db.participants = previousState.participants;
                db.matchups = previousState.matchups;

                // Remettre le rôle aux joueurs éventuellement éliminés par erreur lors de la dernière action
                const role = message.guild.roles.cache.get(TOURNAMENT_ROLE_ID);
                if (role) {
                    for (const p of db.participants) {
                        if (p.status === "En lice") {
                            const member = await message.guild.members.fetch(p.id).catch(() => null);
                            if (member && !member.roles.cache.has(TOURNAMENT_ROLE_ID)) {
                                await member.roles.add(role).catch(() => {});
                            }
                        }
                    }
                }

                const arbreChan = message.guild.channels.cache.get(ARBRE_CHANNEL_ID);
                if (arbreChan && db.treeMessageId) {
                    const treeMsg = await arbreChan.messages.fetch(db.treeMessageId).catch(() => null);
                    if (treeMsg) await treeMsg.edit({ embeds: [generateTreeEmbed(db)] });
                }

                writeDB(db);
                return message.reply("🔄 **[PROTOCOLE SÉCURITÉ]** La dernière commande a été annulée avec succès, l'arbre et les rôles ont été restaurés !");
            }

            // 🛠️ !tournament summon
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
                return message.reply(`📢 Téléportation effectuée : ${count} participants regroupés.`);
            }

            // 🛠️ !tournament reset
            if (cmd === "reset") {
                resetDatabase();
                return message.reply("🔄 Base de données entièrement nettoyée et réinitialisée à zéro.");
            }

        } catch (err) { 
            console.error("[MESSAGE PROCESS ERROR]", err); 
        }
    });

    // ÉXÉCUTION AUTOMATIQUE DE LA TRANSITION DES ARBRES (16èmes ➜ 8èmes ➜ Quarts ➜ Demis ➜ Finale)
    async function triggerNextPhase(message, db) {
        let qualifiedPlayers = db.participants.filter(p => p.status !== "Eliminated");
        
        if (qualifiedPlayers.length === 1) {
            const annoncesChan = message.guild.channels.cache.get(ANNONCES_CHANNEL_ID);
            if (annoncesChan) {
                await annoncesChan.send({
                    content: `👑👑👑 **FIN DU TOURNOI Aeroz Esports** 👑👑👑\n\n🥇 Félicitations monumentales à <@${qualifiedPlayers[0].id}> (Epic: \`${qualifiedPlayers[0].epic}\`) qui remporte la Grande Finale et devient le champion incontesté ! Un immense merci à tous d'avoir suivi ce live de folie ! 🏎️💨`
                });
            }
            db.active = false;
            db.phase = "Terminé";
            writeDB(db);
            return;
        }

        // Calcul automatique du nom du palier
        if (qualifiedPlayers.length > 8 && qualifiedPlayers.length <= 16) db.phase = "8èmes de Finale";
        else if (qualifiedPlayers.length > 4 && qualifiedPlayers.length <= 8) db.phase = "Quarts de Finale";
        else if (qualifiedPlayers.length > 2 && qualifiedPlayers.length <= 4) db.phase = "Demi-Finales";
        else db.phase = "Grande Finale 👑";

        db.matchups = [];
        let matchIdCounter = 1;

        for (let i = 0; i < qualifiedPlayers.length; i += 2) {
            if (qualifiedPlayers[i + 1]) {
                db.matchups.push({ matchId: matchIdCounter++, p1: qualifiedPlayers[i], p2: qualifiedPlayers[i + 1], winner: null });
            } else {
                db.matchups.push({ matchId: matchIdCounter++, p1: qualifiedPlayers[i], p2: null, winner: qualifiedPlayers[i].id });
            }
        }

        // Edition immédiate du message de l'arbre
        const arbreChan = message.guild.channels.cache.get(ARBRE_CHANNEL_ID);
        if (arbreChan && db.treeMessageId) {
            const treeMsg = await arbreChan.messages.fetch(db.treeMessageId).catch(() => null);
            if (treeMsg) await treeMsg.edit({ embeds: [generateTreeEmbed(db)] });
        }

        // Notification globale Hype
        const annoncesChan = message.guild.channels.cache.get(ANNONCES_CHANNEL_ID);
        if (annoncesChan) {
            await annoncesChan.send({
                content: `🚨 **ALERTE TRANSITION • ${db.phase.toUpperCase()}** 🚨\n\nLe tri est fait, l'intensité monte d'un cran ! L'arbre vient d'être mis à jour dans <#${ARBRE_CHANNEL_ID}>.\nLes survivants, préparez-vous immédiatement en vocal, on enchaîne sans aucune coupure ! 🔥`
            });
        }

        writeDB(db);
    }
};
