const {
    ChannelType,
    PermissionsBitField,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
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

if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
if (!fs.existsSync(DB_PATH)) {
    resetDatabase();
}

function readDB() {
    try {
        return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    } catch (err) {
        console.error("[TOURNAMENT DB READ ERROR]", err);
        return { active: false, phase: "Préparation", treeMessageId: null, participants: [], matchups: [], history: [] };
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
        phase: "Préparation", 
        treeMessageId: null, 
        participants: [], 
        matchups: [],
        history: []
    }, null, 4));
}

function generateTreeEmbed(db) {
    let title = `🏆 BRACKET OFFICIEL • ${db.phase.toUpperCase()}`;
    let description = `### 🌿 ÉTAPE ACTUELLE : ${db.phase.toUpperCase()}\n`;
    
    if (db.phase === "Préparation") {
        description += `📢 **L'arbre est en cours de génération par le staff...**`;
    } else {
        description += `*Les matchups sont scellés par le destin. Entraînez-vous, le stream commence demain à 16h00 !*\n\n`;
        if (!db.matchups || db.matchups.length === 0) {
            description += "*Aucun match programmé.*";
        } else {
            db.matchups.forEach((m) => {
                let matchLabel = `**Match #${m.matchId}**`;
                if (!m.p2) {
                    description += `🔹 ${matchLabel}\n👑 <@${m.p1.id}> ➜ *Qualifié d'office*\n\n`;
                } else {
                    let p1Display = m.winner === m.p1.id ? `👑 **<@${m.p1.id}>**` : (m.winner ? `❌ ~~<@${m.p1.id}>~~` : `<@${m.p1.id}>`);
                    let p2Display = m.winner === m.p2.id ? `👑 **<@${m.p2.id}>**` : (m.winner ? `❌ ~~<@${m.p2.id}>~~` : `<@${m.p2.id}>`);
                    description += `🔹 ${matchLabel}\n👉 ${p1Display}\n 🆚 \n👉 ${p2Display}\n\n`;
                }
            });
        }
    }

    return new EmbedBuilder()
        .setColor("#deff9a")
        .setTitle(title)
        .setDescription(description)
        .setFooter({ text: "Aeroz Esports • Système Synchrone Automatisé V2" })
        .setTimestamp();
}

function saveToHistory(db) {
    db.history.push({
        phase: db.phase,
        participants: JSON.parse(JSON.stringify(db.participants)),
        matchups: JSON.parse(JSON.stringify(db.matchups))
    });
    if (db.history.length > 5) db.history.shift();
}

module.exports = (client) => {

    client.on("ready", async () => {
        console.log("[TOURNAMENT] Bot connecté et prêt pour le tirage full aléatoire.");
    });

    client.on("messageCreate", async (message) => {
        try {
            if (message.author.bot) return;
            const db = readDB();

            if (!message.content.startsWith("!tournament")) return;
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return message.reply("❌ Seul le Staff Supérieur d'Aeroz Esports peut utiliser cette commande.");
            }

            const args = message.content.split(" ");
            const cmd = args[1];

            // 🛠️ !tournament setup : Aspire le rôle et mélange TOUT LE MONDE à 100%
            if (cmd === "setup") {
                saveToHistory(db);
                
                const role = message.guild.roles.cache.get(TOURNAMENT_ROLE_ID);
                if (!role) return message.reply("❌ Impossible de trouver le rôle participant.");
                
                await message.guild.members.fetch();
                const currentParticipants = role.members.map(m => ({ id: m.id, tag: m.user.tag, epic: "In Game", status: "En lice" }));

                if (currentParticipants.length < 2) {
                    return message.reply(`❌ Il n'y a pas assez de membres avec le rôle pour générer un arbre.`);
                }

                db.participants = currentParticipants;
                
                // Détermination automatique du nom de la phase de départ selon le nombre de joueurs
                if (db.participants.length > 32) db.phase = "32èmes de Finale";
                else db.phase = "16èmes de Finale";
                
                db.active = false; 

                // Mélange 100% Aléatoire (Full hasard)
                let players = [...db.participants];
                players.sort(() => Math.random() - 0.5);

                db.matchups = [];
                let matchIdCounter = 1;

                for (let i = 0; i < players.length; i += 2) {
                    if (players[i + 1]) {
                        db.matchups.push({ matchId: matchIdCounter++, p1: players[i], p2: players[i + 1], winner: null });
                    } else {
                        db.matchups.push({ matchId: matchIdCounter++, p1: players[i], p2: null, winner: players[i].id });
                    }
                }

                const arbreChan = message.guild.channels.cache.get(ARBRE_CHANNEL_ID);
                if (arbreChan) {
                    const messages = await arbreChan.messages.fetch({ limit: 10 });
                    if (messages.size > 0) await arbreChan.bulkDelete(messages).catch(() => {});

                    const sentMsg = await arbreChan.send({ embeds: [generateTreeEmbed(db)] });
                    db.treeMessageId = sentMsg.id;
                }

                writeDB(db);
                return message.reply(`🎲 **Tirage au sort effectué !** L'arbre géant à l'état brut avec \`${db.participants.length}\` joueurs est publié dans <#${ARBRE_CHANNEL_ID}> !`);
            }

            // 🛠️ !tournament open : À taper demain à 16h pour ouvrir la conférence et envoyer la sauce
            if (cmd === "open") {
                if (db.matchups.length === 0) return message.reply("❌ Tu dois d'abord générer l'arbre avec `!tournament setup` !");

                db.active = true;

                const conf = message.guild.channels.cache.get(CONFERENCE_CHANNEL_ID);
                if (conf) {
                    await conf.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: true, Connect: true, Speak: false });
                    const role = message.guild.roles.cache.get(TOURNAMENT_ROLE_ID);
                    if (role) await conf.permissionOverwrites.edit(role, { Speak: true });
                }

                const annoncesChan = message.guild.channels.cache.get(ANNONCES_CHANNEL_ID);
                if (annoncesChan) {
                    await annoncesChan.send({ 
                        content: `@everyone 🏆 **LE TOURNOI Aeroz Esports COMMENCE TOUT DE SUITE !**\n🎙️ Les brackets sont tirés au sort ! Rejoignez immédiatement la <#${CONFERENCE_CHANNEL_ID}> ! Le stream est officiellement lancé, place au Match #1 ! 🔥` 
                    });
                }

                writeDB(db);
                return message.reply("🏆 Le tournoi est ouvert ! Que le meilleur gagne.");
            }

            // 🛠️ !tournament eliminate
            if (cmd === "eliminate") {
                let targetId = null;
                if (message.mentions.members.first()) {
                    targetId = message.mentions.members.first().id;
                } else if (args[2] && /^\d+$/.test(args[2])) {
                    targetId = args[2];
                }

                if (!targetId) return message.reply("❌ Syntaxe incorrecte.");

                let matchFound = db.matchups.find(m => (m.p1.id === targetId || (m.p2 && m.p2.id === targetId)) && !m.winner);
                if (!matchFound) return message.reply("❌ Ce joueur n'a aucun match actif.");

                saveToHistory(db);

                const loserId = targetId;
                const winnerObj = matchFound.p1.id === loserId ? matchFound.p2 : matchFound.p1;
                
                matchFound.winner = winnerObj.id;

                const pIndex = db.participants.findIndex(p => p.id === loserId);
                if (pIndex !== -1) db.participants[pIndex].status = "Eliminated";

                const targetMember = await message.guild.members.fetch(loserId).catch(() => null);
                if (targetMember) {
                    const role = message.guild.roles.cache.get(TOURNAMENT_ROLE_ID);
                    if (role) await targetMember.roles.remove(role).catch(() => {});
                }

                const arbreChan = message.guild.channels.cache.get(ARBRE_CHANNEL_ID);
                if (arbreChan && db.treeMessageId) {
                    const treeMsg = await arbreChan.messages.fetch(db.treeMessageId).catch(() => null);
                    if (treeMsg) await treeMsg.edit({ embeds: [generateTreeEmbed(db)] });
                }

                const confChan = message.guild.channels.cache.get(CONFERENCE_CHANNEL_ID);
                if (confChan) {
                    await confChan.send({
                        content: `🎯 **[MATCH #${matchFound.matchId} TERMINÉ]**\n👑 **<@${winnerObj.id}>** l'emporte avec brio et accède à l'étape suivante !\n❌ Subissant la loi du stream, <@${loserId}> est éliminé. Un maximum de GG à lui ! 👏`
                    }).catch(() => {});
                }

                let roundFinished = db.matchups.every(m => m.winner !== null);
                if (roundFinished) {
                    writeDB(db);
                    await message.channel.send(`🚨 **Tous les matchs de cette phase sont terminés !** Lancement de l'étape supérieure...`);
                    return triggerNextPhase(message, db);
                }

                writeDB(db);
                return message.reply(`✅ Match enregistré.`);
            }

            // 🛠️ !tournament undo
            if (cmd === "undo") {
                if (!db.history || db.history.length === 0) return message.reply("❌ Aucune action en mémoire.");

                const previousState = db.history.pop();
                db.phase = previousState.phase;
                db.participants = previousState.participants;
                db.matchups = previousState.matchups;

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
                return message.reply("🔄 **[PROTOCOLE SÉCURITÉ]** Dernière commande annulée, l'arbre et les rôles sont restaurés !");
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
                const arbreChan = message.guild.channels.cache.get(ARBRE_CHANNEL_ID);
                if (arbreChan && db.treeMessageId) {
                    const treeMsg = await arbreChan.messages.fetch(db.treeMessageId).catch(() => null);
                    if (treeMsg) await treeMsg.edit({ embeds: [generateTreeEmbed({ active: false, phase: "Préparation", participants: [], matchups: [] })] });
                }
                return message.reply("🔄 Base de données entièrement nettoyée.");
            }

        } catch (err) { 
            console.error("[MESSAGE PROCESS ERROR]", err); 
        }
    });

    async function triggerNextPhase(message, db) {
        let qualifiedPlayers = db.participants.filter(p => p.status !== "Eliminated");
        
        if (qualifiedPlayers.length === 1) {
            const annoncesChan = message.guild.channels.cache.get(ANNONCES_CHANNEL_ID);
            if (annoncesChan) {
                await annoncesChan.send({
                    content: `👑👑👑 **FIN DU TOURNOI Aeroz Esports** 👑👑👑\n\n🥇 Félicitations monumentales à <@${qualifiedPlayers[0].id}> qui remporte la Grande Finale et devient le champion incontesté ! 🏎️💨`
                });
            }
            db.active = false;
            db.phase = "Terminé";
            writeDB(db);
            return;
        }

        if (qualifiedPlayers.length > 16 && qualifiedPlayers.length <= 32) db.phase = "16èmes de Finale";
        else if (qualifiedPlayers.length > 8 && qualifiedPlayers.length <= 16) db.phase = "8èmes de Finale";
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

        const arbreChan = message.guild.channels.cache.get(ARBRE_CHANNEL_ID);
        if (arbreChan && db.treeMessageId) {
            const treeMsg = await arbreChan.messages.fetch(db.treeMessageId).catch(() => null);
            if (treeMsg) await treeMsg.edit({ embeds: [generateTreeEmbed(db)] });
        }

        const annoncesChan = message.guild.channels.cache.get(ANNONCES_CHANNEL_ID);
        if (annoncesChan) {
            await annoncesChan.send({
                content: `🚨 **ALERTE TRANSITION • ${db.phase.toUpperCase()}** 🚨\n\nL'arbre vient d'être mis à jour dans <#${ARBRE_CHANNEL_ID}> ! On enchaîne en vocal ! 🔥`
            });
        }

        writeDB(db);
    }
};
