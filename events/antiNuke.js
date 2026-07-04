const {
    PermissionsBitField,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    MessageFlags // Ajouté pour corriger le warning "ephemeral"
} = require("discord.js");
const fs = require("fs");
const path = require("path");

// Chemin pour la persistance locale de la structure du serveur
const DB_PATH = path.join(__dirname, "fortress_security_db.json");

// Initialisation de la base de données locale
let backupDatabase = { channels: {}, roles: {}, bunkerActive: false };
if (fs.existsSync(DB_PATH)) {
    try {
        backupDatabase = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    } catch (e) {
        console.error("[👑 FORTERESSE] Erreur de lecture de la base de données locale, réinitialisation...");
    }
}

const saveDatabase = () => {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(backupDatabase, null, 2), "utf-8");
    } catch (e) {
        console.error("[👑 FORTERESSE] Erreur d'écriture dans la base de données locale.");
    }
};

// Configurations strictes du système
const TIME_WINDOW = 10 * 1000; 
const ACTION_LIMIT = 2;        // Seuil ultra-serré pour un blocage immédiat
const ACCOUNT_AGE_LIMIT = 24 * 60 * 60 * 1000; 

// Flux de Raid Global
const RAID_FLUX_WINDOW = 30 * 1000; 
const RAID_FLUX_LIMIT = 5;          
let globalJoinTimestamps = [];
let FLUX_RAID_ALERT_ACTIVE = false;

// Configuration du Mode Bunker Récupéré
const BUNKER_SECRET_KEY = "PX-99X-BUNK-7421-ZOR";
const BUNKER_CATEGORY_ID = "1522353418226896997"; // ID fourni
const BUNKER_ROLE_ID = "1522354308635689040";

// Mémoires tampons (RAM) pour l'analyse comportementale
const staffScoreCounter = new Map();
const actionTimestamps = new Map();

module.exports = (client) => {

    console.log("[👑 FORTERESSE DIVINE] Architecture Bunker Lourde et Système Anti-Nuke de Niveau Industriel Armés.");

    const WHITELIST_CEO_ID = "1501625944148934758";
    const SUSPECT_ROLE_ID = "1522353482252947508"; // ID fourni
    
    const CHANNELS = {
        ANTI_RAID: "1522354528626802728",
        LOGS_SALONS: "1522354627633217597",
        LOGS_ROLES: "1522354480631517204",
        LOGS_MODERATION: "1522354679831461949"
    };

    const sendLog = async (channelId, embed) => {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (channel) channel.send({ embeds: [embed.setTimestamp()] }).catch(() => {});
    };

    // Algorithme d'isolation instantané des privilèges du Staff ou Blacklist des bots
    const isolateStaff = async (guild, member, reason) => {
        if (member.id === WHITELIST_CEO_ID || member.id === guild.ownerId) return false;

        if (member.user.bot) {
            await member.ban({ reason: `🚨 BLACKLIST BOT EXTRÊME : ${reason}` }).catch(() => {});
            return true;
        }

        const rolesToRemove = member.roles.cache.filter(r => r.id !== guild.roles.everyone.id);
        await member.roles.remove(rolesToRemove, `Sécurité Anti-Nuke : ${reason}`).catch(() => {});

        const emergencyEmbed = new EmbedBuilder()
            .setColor("#8b0000") // Corrigé : Code Hexa pour Rouge Foncé 🔴
            .setTitle("🚨 DESTITUTION IMMÉDIATE DU COMPTE STAFF 🚨")
            .setDescription(`**Auteur :** ${member.user} (\`${member.id}\`)\n**Raison :** ${reason}\n\n🔒 **Mesure :** Quarantaine totale appliquée par retrait des rôles.`);

        const logChannel = await guild.channels.fetch(CHANNELS.ANTI_RAID).catch(() => null);
        if (logChannel) {
            logChannel.send({ content: `<@${WHITELIST_CEO_ID}>`, embeds: [emergencyEmbed] }).catch(() => {});
        }
        return true;
    };

    // Analyse comportementale par accumulation de score
    const checkHeuristicLimit = async (guild, executorId, scoreCost, actionTypeStr) => {
        if (executorId === WHITELIST_CEO_ID || executorId === guild.ownerId) return false;

        const now = Date.now();
        if (!actionTimestamps.has(executorId)) actionTimestamps.set(executorId, []);
        
        let timestamps = actionTimestamps.get(executorId).filter(t => now - t < TIME_WINDOW);
        timestamps.push(now);
        actionTimestamps.set(executorId, timestamps);

        let currentScore = (staffScoreCounter.get(executorId) || 0) + scoreCost;
        staffScoreCounter.set(executorId, currentScore);

        // Réinitialisation progressive du score hors de la fenêtre
        setTimeout(() => {
            let s = staffScoreCounter.get(executorId) || 0;
            if (s > 0) staffScoreCounter.set(executorId, Math.max(0, s - scoreCost));
        }, TIME_WINDOW);

        if (timestamps.length >= ACTION_LIMIT || currentScore >= 10) {
            const staffMember = await guild.members.fetch(executorId).catch(() => null);
            if (staffMember) {
                await isolateStaff(guild, staffMember, `Détection Heuristique : Abus d'actions administratives (${actionTypeStr})`);
                return true;
            }
        }
        return false;
    };

    // =====================================================
    // 📨 ACTIVATION ET VERROUILLAGE TOTAL DU MODE BUNKER
    // =====================================================
    client.on("messageCreate", async (message) => {
        if (!message.guild || message.author.bot) return;

        // Blocage hermétique des liens internet sous confinement Bunker
        if (backupDatabase.bunkerActive && message.author.id !== WHITELIST_CEO_ID) {
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            if (urlRegex.test(message.content)) {
                await message.delete().catch(() => {});
                return message.channel.send(`⚠️ ${message.author}, le partage de liens et de médias externes est rigoureusement interdit pendant le protocole Bunker.`)
                    .then(m => setTimeout(() => m.delete().catch(() => {}), 4000));
            }
        }

        // Commande +bunker-on
        if (message.content.startsWith("+bunker-on")) {
            if (message.author.id !== WHITELIST_CEO_ID) {
                const intruder = message.member;
                if (intruder) await isolateStaff(message.guild, intruder, "Tentative d'activation illégale du Mode Bunker");
                return await message.delete().catch(() => {});
            }

            const args = message.content.split(" ");
            if (args[1] === BUNKER_SECRET_KEY) {
                backupDatabase.bunkerActive = true;
                saveDatabase();
                await message.delete().catch(() => {});
                
                const bunkerEmbed = new EmbedBuilder()
                    .setColor("#8b0000") // Corrigé : Code Hexa pour Rouge Foncé 🔴
                    .setTitle("🛡️ ÉTAT DE SIÈGE : ENCLENCHEMENT DU BUNKER")
                    .setDescription(`🔒 **La catégorie de confinement <#${BUNKER_CATEGORY_ID}> est sous protection militaire.**\n\n⚡ **Contrôles stricts appliqués :**\n• Révocation définitive de toutes les invitations du serveur.\n• Nettoyage et déconnexion instantanée des salons vocaux.\n• Injection automatique du rôle de restriction à tous les membres.\n• Chasse et blocage dynamique des flux HTTP/HTTPS.`);
                sendLog(CHANNELS.ANTI_RAID, bunkerEmbed);

                const guild = message.guild;

                const invites = await guild.invites.fetch().catch(() => null);
                if (invites) {
                    invites.forEach(invite => invite.delete("Protocole Bunker Actif").catch(() => {}));
                }

                const members = await guild.members.fetch();
                members.forEach(member => {
                    if (member.voice.channelId) {
                        member.voice.disconnect("Alerte Confinement Bunker").catch(() => {});
                    }
                    if (!member.user.bot && member.id !== WHITELIST_CEO_ID) {
                        member.roles.add(BUNKER_ROLE_ID, "Alerte Sécurité : Confinement Bunker").catch(() => {});
                    }
                });
                return;
            } else {
                return message.reply("❌ Clé de sécurité maîtresse invalide.").then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
            }
        }

        // Commande +bunker-off
        if (message.content.startsWith("+bunker-off")) {
            if (message.author.id !== WHITELIST_CEO_ID) return;
            
            const args = message.content.split(" ");
            if (args[1] === BUNKER_SECRET_KEY) {
                backupDatabase.bunkerActive = false;
                saveDatabase();
                await message.delete().catch(() => {});
                
                const bunkerOffEmbed = new EmbedBuilder()
                    .setColor("#2ecc71") // Corrigé : Vert Hexa stable 🟢
                    .setTitle("🔓 NORMALISATION DU SERVEUR : FIN DU SIÈGE")
                    .setDescription("♻️ Retrait globalisé du rôle de confinement et réouverture ordonnée de la structure.");
                sendLog(CHANNELS.ANTI_RAID, bunkerOffEmbed);

                const members = await message.guild.members.fetch();
                members.forEach(member => {
                    if (member.roles.cache.has(BUNKER_ROLE_ID)) {
                        member.roles.remove(BUNKER_ROLE_ID, "Fin du protocole de crise").catch(() => {});
                    }
                });
                return;
            } else {
                return message.reply("❌ Clé de sécurité maîtresse invalide.").then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
            }
        }
    });

    // Protection des pseudos sous Bunker
    client.on("guildMemberUpdate", async (oldMember, newMember) => {
        if (!backupDatabase.bunkerActive) return;
        if (newMember.id === WHITELIST_CEO_ID) return;

        if (oldMember.nickname !== newMember.nickname) {
            await newMember.setNickname(oldMember.nickname, "Sécurité Bunker : Verrouillage des identités").catch(() => {});
        }
    });

    // =====================================================
    // ⚙️ PROTECTION DE LA STRUCTURE ET DU SERVEUR (ANTI-NUKE)
    // =====================================================
    
    // Protection contre les modifications malveillantes du serveur (Nom, Icône, Vanité)
    client.on("guildUpdate", async (oldGuild, newGuild) => {
        const auditLogs = await newGuild.fetchAuditLogs({ limit: 1, type: 1 }).catch(() => null);
        const entry = auditLogs?.entries.first();
        if (!entry) return;

        const executor = entry.executor;
        if (executor.id === WHITELIST_CEO_ID || executor.id === newGuild.ownerId) return;

        // Rétablissement immédiat des paramètres critiques
        if (oldGuild.name !== newGuild.name) await newGuild.setName(oldGuild.name).catch(() => {});
        if (oldGuild.icon !== newGuild.icon) await newGuild.setIcon(oldGuild.iconURL()).catch(() => {});
        if (oldGuild.features.includes("VANITY_URL") && oldGuild.vanityURLCode !== newGuild.vanityURLCode) {
            // Optionnel : Remettre le code si disponible via l'API avancée
        }

        const staffMember = await newGuild.members.fetch(executor.id).catch(() => null);
        if (staffMember) await isolateStaff(newGuild, staffMember, "Tentative d'altération des paramètres globaux du serveur");
    });

    // Surveillance de l'effacement de salons
    client.on("channelDelete", async (channel) => {
        if (!channel.guild) return;
        const guild = channel.guild;
        const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: 12 }).catch(() => null);
        const entry = auditLogs?.entries.first();
        if (!entry) return;

        const executor = entry.executor;

        // Sauvegarde miroir automatisée en base de données locale
        backupDatabase.channels[channel.id] = {
            name: channel.name,
            type: channel.type,
            parentId: channel.parentId,
            position: channel.position,
            permissionOverwrites: channel.permissionOverwrites.cache.map(o => ({ id: o.id, type: o.type, allow: o.allow.bitfield.toString(), deny: o.deny.bitfield.toString() }))
        };
        saveDatabase();

        if (backupDatabase.bunkerActive && (channel.id === BUNKER_CATEGORY_ID || channel.parentId === BUNKER_CATEGORY_ID)) {
            const staffMember = await guild.members.fetch(executor.id).catch(() => null);
            if (staffMember) {
                await isolateStaff(guild, staffMember, "Tentative de sabotage de la zone Bunkerisée");
                
                // Recréation instantanée à la position exacte
                await guild.channels.create({
                    name: channel.name,
                    type: channel.type,
                    parent: channel.parentId,
                    position: channel.position,
                    permissionOverwrites: channel.permissionOverwrites.cache.map(o => ({ id: o.id, type: o.type, allow: o.allow.bitfield, deny: o.deny.bitfield }))
                }).catch(() => {});
            }
            return;
        }

        const logEmbed = new EmbedBuilder()
            .setColor("#e67e22") // Corrigé : Orange Hexa stable 🟠
            .setTitle("🗑️ Salon Supprimé")
            .setDescription(`**Nom :** \`#${channel.name}\`\n**Auteur :** <@${executor.id}>`);
        sendLog(CHANNELS.LOGS_SALONS, logEmbed);

        await checkHeuristicLimit(guild, executor.id, 4, "Suppression de salon");
    });

    // Surveillance de la création de salons
    client.on("channelCreate", async (channel) => {
        if (!channel.guild) return;
        const guild = channel.guild;
        const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: 10 }).catch(() => null);
        const entry = auditLogs?.entries.first();
        if (!entry) return;

        const executor = entry.executor;

        if (backupDatabase.bunkerActive && executor.id !== WHITELIST_CEO_ID) {
            await channel.delete("Mode Bunker strict actif").catch(() => {});
            const staffMember = await guild.members.fetch(executor.id).catch(() => null);
            if (staffMember) await isolateStaff(guild, staffMember, "Modification géographique interdite sous Bunker");
            return;
        }

        const logEmbed = new EmbedBuilder()
            .setColor("#2ecc71") // Corrigé : Vert Hexa stable 🟢
            .setTitle("➕ Salon Créé")
            .setDescription(`**Salon :** ${channel}\n**Auteur :** <@${executor.id}>`);
        sendLog(CHANNELS.LOGS_SALONS, logEmbed);

        await checkHeuristicLimit(guild, executor.id, 3, "Création de salon");
    });

    // =====================================================
    // 🚪 FLUX ENTRÉES : FILTRAGE ANTI-RAID AUTOMATISÉ
    // =====================================================
    client.on("guildMemberAdd", async (member) => {
        const guild = member.guild;
        const now = Date.now();

        globalJoinTimestamps = globalJoinTimestamps.filter(t => now - t < RAID_FLUX_WINDOW);
        globalJoinTimestamps.push(now);

        if (globalJoinTimestamps.length >= RAID_FLUX_LIMIT && !FLUX_RAID_ALERT_ACTIVE) {
            FLUX_RAID_ALERT_ACTIVE = true;
            const alertFluxEmbed = new EmbedBuilder()
                .setColor("#e67e22") // Corrigé : Orange Hexa stable 🟠
                .setTitle("⚠️ SEUILS DE FLUX ATTEINTS : ATTAQUE SOUÇONNÉE")
                .setDescription(`Une grappe de \`${globalJoinTimestamps.length}\` connexions simultanées détectée.\n\n🛡️ Activation du verrouillage systématique par étiquette **Suspect**.`);
            sendLog(CHANNELS.ANTI_RAID, alertFluxEmbed);
        }

        // Interception absolue des injections de bots tiers
        if (member.user.bot) {
            const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: 28 }).catch(() => null);
            const entry = auditLogs?.entries.first();
            
            if (entry && entry.executor.id !== WHITELIST_CEO_ID) {
                await member.ban({ reason: "Bot tiers non certifié par la Whitelist" }).catch(() => {});
                const staffMember = await guild.members.fetch(entry.executor.id).catch(() => null);
                if (staffMember) await isolateStaff(guild, staffMember, `Infiltration de bot non répertorié : (${member.user.tag})`);
            } else if (!entry) {
                await member.kick("Sécurité : Entrée de bot suspecte").catch(() => {});
            }
            return;
        }

        // Isolement automatique des comptes récents
        const accountAge = now - member.user.createdTimestamp;
        if (accountAge < ACCOUNT_AGE_LIMIT || FLUX_RAID_ALERT_ACTIVE || backupDatabase.bunkerActive) {
            const suspectRole = guild.roles.cache.get(SUSPECT_ROLE_ID);
            if (suspectRole) await member.roles.add(suspectRole).catch(() => {});

            let activeReason = "Compte trop récent (<24h)";
            if (backupDatabase.bunkerActive) activeReason = "Mode Bunker Actif (Quarantaine)";
            else if (FLUX_RAID_ALERT_ACTIVE) activeReason = "Protection de Flux Actif (Alerte Raid)";

            const suspectEmbed = new EmbedBuilder()
                .setColor("#e67e22") // Corrigé : Orange Hexa stable 🟠
                .setTitle("🔍 ISOLEMENT AUTOMATIQUE D'UN NOUVEAU MEMBRE")
                .setDescription(`**Membre :** ${member.user} (\`${member.id}\`)\n**Raison :** ${activeReason}`)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }));
            sendLog(CHANNELS.ANTI_RAID, suspectEmbed);
        }
    });

    // =====================================================
    // 👑 CONTRE-SABOTAGE DES PRIVILÈGES (RÔLES)
    // =====================================================
    client.on("roleDelete", async (role) => {
        const guild = role.guild;
        const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: 32 }).catch(() => null);
        const entry = auditLogs?.entries.first();
        if (!entry) return;

        const executor = entry.executor;

        backupDatabase.roles[role.id] = {
            name: role.name,
            color: role.color,
            hoist: role.hoist,
            permissions: role.permissions.bitfield.toString(),
            mentionable: role.mentionable
        };
        saveDatabase();

        const logEmbed = new EmbedBuilder()
            .setColor("#e74c3c") // Corrigé : Rouge Hexa stable 🔴
            .setTitle("🗑️ Rôle Supprimé")
            .setDescription(`**Rôle :** \`@${role.name}\`\n**Auteur :** <@${executor.id}>`);
        sendLog(CHANNELS.LOGS_ROLES, logEmbed);

        await checkHeuristicLimit(guild, executor.id, 5, "Suppression de rôle");
    });

    client.on("roleUpdate", async (oldRole, newRole) => {
        const guild = newRole.guild;
        const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: 31 }).catch(() => null);
        const entry = auditLogs?.entries.first();
        if (!entry) return;

        const executor = entry.executor;
        if (executor.id === WHITELIST_CEO_ID) return;

        const hadAdmin = oldRole.permissions.has(PermissionsBitField.Flags.Administrator);
        const hasAdmin = newRole.permissions.has(PermissionsBitField.Flags.Administrator);

        // Blocage d'élévation illégale de privilèges
        if (!hadAdmin && hasAdmin) {
            await newRole.setPermissions(oldRole.permissions.bitfield, "Anti-Nuke : Élévation interdite").catch(() => {});
            const staffMember = await guild.members.fetch(executor.id).catch(() => null);
            if (staffMember) await isolateStaff(guild, staffMember, `Tentative d'octroi de droits Administrateur sur le rôle @${newRole.name}`);
        }
    });

    // =====================================================
    // 🎛️ RESTAURATION MIROIR DEPUIS LA BASE DE DONNÉES LOCALE
    // =====================================================
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        
        if (interaction.customId === "nuke_clear_flux") {
            if (interaction.user.id !== WHITELIST_CEO_ID) return;
            FLUX_RAID_ALERT_ACTIVE = false;
            // Corrigé : Remplacement d'ephemeral par flags pour effacer le warning
            return interaction.reply({ content: "🔓 Alerte de flux réinitialisée.", flags: [MessageFlags.Ephemeral] });
        }

        if (interaction.customId !== "nuke_restore_all") return;
        if (interaction.user.id !== WHITELIST_CEO_ID) {
            // Corrigé : Remplacement d'ephemeral par flags
            return interaction.reply({ content: "❌ Autorisation refusée.", flags: [MessageFlags.Ephemeral] });
        }

        await interaction.deferUpdate();
        const guild = interaction.guild;

        // Reconstruction asynchrone ordonnée des salons sauvegardés
        for (const [id, ch] of Object.entries(backupDatabase.channels)) {
            await guild.channels.create({
                name: ch.name,
                type: ch.type,
                parent: ch.parentId,
                position: ch.position,
                permissionOverwrites: ch.permissionOverwrites.map(o => ({ id: o.id, type: o.type, allow: BigInt(o.allow), deny: BigInt(o.deny) }))
            }).catch(() => {});
        }
        backupDatabase.channels = {};

        // Reconstruction des rôles sauvegardés
        for (const [id, rl] of Object.entries(backupDatabase.roles)) {
            await guild.roles.create({
                name: rl.name,
                color: rl.color,
                hoist: rl.hoist,
                permissions: BigInt(rl.permissions),
                mentionable: rl.mentionable
            }).catch(() => {});
        }
        backupDatabase.roles = {};
        saveDatabase();

        const successEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor("#2ecc71") // Corrigé : Vert Hexa stable 🟢
            .setTitle("✅ PROTOCOLE DE RESTAURATION EXÉCUTÉ")
            .setDescription("Les configurations et structures sauvegardées localement ont été injectées et restaurées avec succès.");
        await interaction.editReply({ embeds: [successEmbed], components: [] }).catch(() => {});
    });
};
