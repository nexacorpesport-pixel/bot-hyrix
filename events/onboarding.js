const {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionsBitField,
    ChannelType
} = require("discord.js");

const captchaStorage = new Map();
const captchaAttempts = new Map();
const userChannels = new Map(); 
const renameChoice = new Map(); 
const cooldowns = new Set(); 

module.exports = (client) => {

    const LOGS_CHANNEL = "1510039415454568569";

    // Rôles principaux
    const ARRIVE_ROLE = "1505625588121997572";  
    const MEMBRE_ROLE = "1505330732187521035";  
    const VERIFIED_ROLE = "1505330731193335920"; 

    // Rôles optionnels
    const HOMME_ROLE = "1505330737187131544";
    const FEMME_ROLE = "1505330738772574208";
    const NP_ROLE = "1505330739753783458";

    const ANNONCES_ROLE = "1505330743721721956";
    const LIVES_ROLE = "1505330746301354024";
    const EVENTS_ROLE = "1505330745072156904";
    const RESEAUX_ROLE = "1505625990359945318";

    const JOUEUR_ROLE = "1505330740869599383";
    const STAFF_ROLE = "1505330741234567890";

    const BIENVENUE_CHANNEL = "1505330766047875242";
    const CEO_ROLE = "1505330692106485781";

    client.on("guildMemberAdd", async (member) => {
        try {
            if (member.user.bot) return;

            console.log(`\n=== 📥 CRÉATION DU SALON POUR : ${member.user.tag} ===`);

            // 1. TEST ET ATTRIBUTION DU RÔLE ARRIVANT
            console.log(`[ÉTAPE 1] Tentative d'attribution du rôle Arrivant (${ARRIVE_ROLE})...`);
            await member.roles.add(ARRIVE_ROLE)
                .then(() => console.log(`✅ Rôle Arrivant attribué avec succès à ${member.user.username}`))
                .catch((err) => {
                    console.error(`❌ Erreur Rôle Arrivant : Le bot n'a pas pu donner le rôle.`);
                    console.error(`👉 Raison Discord : ${err.message}`);
                });

            // 2. TENTATIVE DE CRÉATION DU SALON UNIQUE
            console.log(`[ÉTAPE 2] Tentative de création du salon '👋┃${member.user.username.toLowerCase()}' à la racine...`);
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
            }).catch((err) => {
                console.error(`❌ Erreur Salon : Impossible de créer le salon textuel.`);
                console.error(`👉 Raison Discord : ${err.message}`);
                return null;
            });

            if (!channel) {
                console.log(`❌ Arrêt du script : Le salon n'a pas pu être créé.`);
                return;
            }

            console.log(`✅ Salon créé avec succès ! ID du salon : ${channel.id}`);
            userChannels.set(member.id, channel.id);

            // Envoi de l'étape 1 (Genre)
            const genreMenu = new StringSelectMenuBuilder()
                .setCustomId("ob_genre")
                .setPlaceholder("🔮 Sélectionne ton genre...")
                .addOptions([
                    { label: "Homme", value: "homme", emoji: "👨" },
                    { label: "Femme", value: "femme", emoji: "👩" },
                    { label: "Non précisé", value: "np", emoji: "👤" }
                ]);

            const helpButton = new ButtonBuilder().setCustomId("ob_help").setLabel("Besoin d'aide").setStyle(ButtonStyle.Secondary).setEmoji("❓");
            const resetButton = new ButtonBuilder().setCustomId("ob_reset").setLabel("Recommencer").setStyle(ButtonStyle.Danger).setEmoji("🔄");
            const actionRowControls = new ActionRowBuilder().addComponents(helpButton, resetButton);

            const welcomeEmbed = new EmbedBuilder()
                .setColor("#ffb347")
                .setTitle("✨ Bienvenue sur Pyxar")
                .setDescription(`Bonjour ${member},\n\nBienvenue ! Merci de compléter ce formulaire interactif pour valider ton accès permanent.\n\n📊 Progression :\n🟩⬜⬜⬜⬜⬜⬜ **1/7 (Genre)**`);

            await channel.send({
                content: `${member}`,
                embeds: [welcomeEmbed],
                components: [new ActionRowBuilder().addComponents(genreMenu), actionRowControls]
            });
            
            console.log(`✅ Message d'onboarding envoyé dans le salon.`);

        } catch (criticalErr) {
            console.error(`❌ Erreur critique générale dans guildMemberAdd :`, criticalErr);
        }
    });
};
