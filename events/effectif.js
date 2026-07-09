const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

// --- CONFIGURATION DE L'EFFECTIF AEROZ ESPORTS ---
const EFFECTIF_CHANNEL_ID = "1501626021772792050"; // ID mis à jour selon ta demande
const DB_PATH = path.join(__dirname, "../data/effectif_message.json");

// Structure exacte de ton organigramme
const ORGANIGRAMME = [
    // Pôle Présidence / Direction
    { type: "SEPARATEUR", nom: "🛑 PÔLE PRÉSIDENTIEL" },
    { type: "ROLE", id: "1501625944148934758", nom: "👑 CEO / Fondateur" },
    { type: "SEPARATEUR", nom: "💼 PÔLE DIRECTION" },
    { type: "ROLE", id: "1522699972733305173", nom: "🚀 Directeur Général" },
    { type: "SEPARATEUR", nom: "⚙️ PÔLE ADMINISTRATEUR" },
    { type: "ROLE", id: "1501625946661191690", nom: "🛠️ Responsable Administrateur" },
    { type: "ROLE", id: "1501625948125003917", nom: "🛡️ Administrateur" },
    
    // Pôle Staff & Modération
    { type: "SEPARATEUR", nom: "⚔️ PÔLE MODÉRATION" },
    { type: "ROLE", id: "1501625950952227018", nom: "👮 Responsable Modération" },
    { type: "ROLE", id: "1522699178294378587", nom: "⭐ Super Modérateur" },
    { type: "ROLE", id: "1501625952223101208", nom: "🛡️ Modérateur" },
    { type: "SEPARATEUR", nom: "📝 PÔLE TEST STAFF" },
    { type: "ROLE", id: "1501625955427422378", nom: "🔎 Test Modérateur" },

    // Pôle Tech / Esport / Crea
    { type: "SEPARATEUR", nom: "🧠 PÔLE COACH" },
    { type: "ROLE", id: "1522699426475409469", nom: "📋 Coach" },
    { type: "SEPARATEUR", nom: "🎨 PÔLE AUDIOVISUEL" },
    { type: "ROLE", id: "1501625964524863598", nom: "🖌️ Graphiste" },
    { type: "ROLE", id: "1501625965498073169", nom: "🎬 Monteur" },
    { type: "ROLE", id: "1501625966324351116", nom: "🧱 Mappeur" },
    { type: "ROLE", id: "1501625967259418707", nom: "🎙️ Caster" },
    { type: "ROLE", id: "1501625968295542955", nom: "🎥 Content Creator" },

    // Pôle Joueurs / Esport
    { type: "SEPARATEUR", nom: "🏆 PÔLE OFFICIEL" },
    { type: "ROLE", id: "1501625970564534304", nom: "🥇 Joueur Officiel" },
    { type: "SEPARATEUR", nom: "🎓 PÔLE ACADÉMIQUE" },
    { type: "ROLE", id: "1501625971420434515", nom: "🥈 Joueur Académie" },
    { type: "SEPARATEUR", nom: "🌱 PÔLE ESPOIR" },
    { type: "ROLE", id: "1501920362491936818", nom: "🥉 Joueur Espoir" }
];

// Extraction de tous les IDs de rôles pour écouter les changements rapidement
const TOUS_LES_ROLES_IDS = ORGANIGRAMME.filter(x => x.type === "ROLE").map(x => x.id);

module.exports = async (client) => {

    // S'assurer que le fichier data existe pour stocker l'ID du message
    if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({ messageId: null }));

    // Fonction globale pour générer le contenu textuel de l'organigramme
    async function genererContenuEffectif(guild) {
        // On force le fetch de tous les membres pour avoir le cache à jour en temps réel
        await guild.members.fetch();
        
        let description = "Bienvenue sur l'organigramme officiel d'**Aeroz Esports**. Cette liste est mise à jour automatiquement en temps réel.\n";

        for (const element of ORGANIGRAMME) {
            if (element.type === "SEPARATEUR") {
                description += `\n**▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬**\n**${element.nom}**\n**▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬**\n`;
            } else if (element.type === "ROLE") {
                const role = guild.roles.cache.get(element.id);
                if (!role) {
                    description += `\n> **${element.nom}**\n*Rôle introuvable*\n`;
                    continue;
                }

                description += `\n> **${element.nom}** (${role.members.size})`;
                
                if (role.members.size > 0) {
                    // Tri des membres du rôle par pseudo pour garder l'ordre alphabétique
                    const membresTries = role.members.sort((a, b) => a.displayName.localeCompare(b.displayName));
                    
                    // Ajout d'un retour à la ligne + tiret moderne pour chaque membre sous le rôle
                    membresTries.forEach(member => {
                        description += `\n▪️ ${member.toString()}`;
                    });
                    description += `\n`; // Ligne vide de séparation après la liste
                } else {
                    description += `\n*Aucun membre affecté*\n`;
                }
            }
        }
        return description;
    }

    // Fonction pour poster ou mettre à jour le message de l'organigramme
    async function refreshEffectif() {
        try {
            const channel = await client.channels.fetch(EFFECTIF_CHANNEL_ID);
            if (!channel) return console.error("❌ Salon effectif introuvable.");

            const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
            const embedDescription = await genererContenuEffectif(channel.guild);

            const embed = new EmbedBuilder()
                .setColor('#00ffcc')
                .setTitle('📋 ORGANIGRAMME & EFFECTIF — AEROZ ESPORTS')
                .setDescription(embedDescription)
                .setTimestamp()
                .setFooter({ text: 'Mise à jour automatique instantanée • Aeroz Esports' });

            let msg = null;
            if (data.messageId) {
                msg = await channel.messages.fetch(data.messageId).catch(() => null);
            }

            if (msg) {
                await msg.edit({ embeds: [embed] });
                console.log("🔄 Effectif Aeroz Esports mis à jour avec succès (Edit).");
            } else {
                const nouveauMsg = await channel.send({ embeds: [embed] });
                fs.writeFileSync(DB_PATH, JSON.stringify({ messageId: nouveauMsg.id }));
                console.log("✅ Premier message d'effectif envoyé et ID sauvegardé.");
            }
        } catch (error) {
            console.error("❌ Erreur lors du refresh de l'effectif :", error);
        }
    }

    // Exécution automatique au démarrage
    await refreshEffectif();

    // Écouteur en temps réel : Dès qu'un membre change de rôle
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        const rolesModifies = oldMember.roles.cache.size !== newMember.roles.cache.size;
        if (!rolesModifies) return;

        const aUnRoleConcerne = TOUS_LES_ROLES_IDS.some(id => 
            oldMember.roles.cache.has(id) !== newMember.roles.cache.has(id)
        );

        if (aUnRoleConcerne) {
            console.log(`⚡ Changement de rôle détecté pour ${newMember.user.tag}. Actualisation de l'effectif...`);
            await refreshEffectif();
        }
    });
};
