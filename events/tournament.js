const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// --- CONFIGURATION AEROZ ESPORTS ---
const REGLEMENT_CHANNEL_ID = "1501626010049712180";
const ROLES_A_DONNER = ["1501625972896825434", "1501920728302223381"]; 

// On exporte une fonction que ton index.js va appeler en lui passant le "client"
module.exports = (client) => {

    client.on('ready', async () => {
        console.log(`🤖 Bot connecté en tant que ${client.user.tag} !`);

        try {
            const channel = await client.channels.fetch(REGLEMENT_CHANNEL_ID);
            if (!channel) return console.error("❌ Salon règlement introuvable.");

            const messages = await channel.messages.fetch({ limit: 50 });
            const botMessage = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0);

            if (botMessage) {
                console.log("✅ Le règlement est déjà en place dans le salon. Aucune action requise.");
                return;
            }

            console.log("⏳ Règlement introuvable... Génération automatique des Embeds Aeroz Esports...");

            const embed1 = new EmbedBuilder()
                .setColor('#00ffcc')
                .setTitle('🛡️ RÈGLEMENT GÉNÉRAL — AEROZ ESPORTS')
                .setDescription(
                    "> **PREAMBULE ET DISPOSITIONS GÉNÉRALES**\n" +
                    "> En rejoignant cette communauté, vous acceptez sans réserve le présent règlement. Tout utilisateur actif est présumé en avoir pris connaissance et s'engage à le respecter scrupuleusement.\n>\n" +
                    "> *Le présent règlement n’est pas exhaustif. L’équipe d’administration et de modération se réserve le droit de sanctionner tout comportement visé ou jugé néfaste, même si celui-ci n’est pas explicitement mentionné ci-dessous.*\n\n" +
                    "### ⚖️ SECTION I : CADRE LÉGAL ET SÉCURITÉ\n\n" +
                    "**Article 1 — Conformité Légale & Discriminations**\n" +
                    "Tout membre doit respecter la législation. Les propos haineux, racistes, homophobes, sexistes, ou toute forme de harcèlement envers un individu ou une communauté sont strictement interdits, y compris sous couvert d'humour.\n\n" +
                    "**Article 2 — Protection des Mineurs**\n" +
                    "Les contenus à caractère NSFW (Not Safe For Work), pornographiques, choquants, violents ou extrêmes sont formellement interdits sur l'ensemble du serveur.\n\n" +
                    "**Article 3 — Respect de la Vie Privée (Doxxing)**\n" +
                    "Il est strictement interdit de diffuser des informations privées (identité réelle, adresse, numéro de téléphone, photos personnelles) de n’importe quel utilisateur.\n\n" +
                    "**Article 4 — Conditions Discord**\n" +
                    "Le serveur est soumis aux [Conditions d'Utilisation de Discord](https://discord.com/terms) et à sa [Charte de la Communauté](https://discord.com/guidelines)."
                );

            const embed2 = new EmbedBuilder()
                .setColor('#00ffcc')
                .setDescription(
                    "### 👤 SECTION II : IDENTITÉ ET PROFIL DES MEMBRES\n\n" +
                    "**Article 5 — Profils Inappropriés (Quarantaine)**\n" +
                    "Les photos de profil, bannières, statuts ou pseudos à caractère déplacé, insultant ou provocateur sont interdits. En cas d'infraction, le membre sera placé sous un statut de quarantaine.\n\n" +
                    "**Article 6 — Usurpation d'Identité**\n" +
                    "L'utilisation d'un pseudonyme ou d'un avatar copiant ou ressemblant fortement à ceux d'un membre du Staff est strictement interdite.\n\n" +
                    "### 📝 SECTION III : COMPORTEMENT TEXTUEL & SALONS VOCAUX\n\n" +
                    "**Article 7 — Modération du Langage**\n" +
                    "L'usage d'insultes et de langage vulgaire est proscrit. Le contournement des filtres de censure automatique ou manuel entraînera un avertissement immédiat.\n\n" +
                    "**Article 8 — Régulation du Spam**\n" +
                    "Le flood, le spam de messages, l'abus d'émojis, de majuscules ou l'utilisation excessive de mentions sans motif valable sont interdits.\n\n" +
                    "**Article 9 — Surveillance des Textuels Vocaux & Temporaires**\n" +
                    "Il est **strictement interdit** d'écrire ou d'utiliser le chat textuel intégré des salons vocaux, ainsi que les salons écrits/vocaux temporaires pour y commettre des infractions ou contourner la surveillance du Staff. Ces espaces sont activés, archivés et surveillés de près.\n\n" +
                    "**Article 10 — Publicité Clandestine**\n" +
                    "La publicité non sollicitée est interdite sur le serveur ainsi que dans les Messages Privés (MP) envoyés aux membres."
                );

            const embed3 = new EmbedBuilder()
                .setColor('#00ffcc')
                .setDescription(
                    "### 🔊 SECTION IV : COMPORTEMENT VOCAL\n\n" +
                    "**Article 11 — Nuisances Sonores**\n" +
                    "Les bruits insupportables, cris, soufflements dans le micro ou l'utilisation abusive de soundboards/modificateurs de voix sont interdits.\n\n" +
                    "**Article 12 — Enregistrements**\n" +
                    "Conformément à l'article 226-1 du Code pénal, il est strictement interdit d'enregistrer une conversation vocale sans le consentement explicite de l'ensemble des participants.\n\n" +
                    "### 🔨 SECTION V : RECOURS, SANCTIONS & CLAUSE UNIVERSELLE\n\n" +
                    "**Article 13 — Échelle des Sanctions (Warns)**\n" +
                    "Le cumul d'avertissements déclenche automatiquement les sanctions suivantes :\n" +
                    "• `4 warns` = Mute de 1 heure.\n" +
                    "• `8 warns` = Mute de 1 jour.\n" +
                    "• `14 warns` = Mute de 7 jours.\n" +
                    "• `18 warns` = Bannissement de 24 jours.\n\n" +
                    "**Article 14 — Clause Universelle Anti-Faille (⚠️ IMPORTANT)**\n" +
                    "**Tout acte, bêtise ou comportement malveillant commis dans le fait de nuire à Aeroz Esports, de provoquer le Staff ou de contourner ce règlement sera sanctionné, qu'il soit textuellement listé ici ou non.** Le bon sens et la décision de la modération priment dans tous les cas.\n\n" +
                    "**Article 15 — Souveraineté du Staff**\n" +
                    "L'équipe du Staff a toujours le dernier mot. Contester une sanction de manière non constructive en dehors d'un Ticket officiel donnera lieu à un avertissement supplémentaire."
                )
                .setFooter({ text: 'Aeroz Esports • Cliquez sur le bouton ci-dessous pour accepter le règlement.' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('accept_rules_aeroz')
                    .setLabel('Accepter le règlement')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅')
            );

            await channel.send({ embeds: [embed1, embed2, embed3], components: [row] });
            console.log("✅ Règlement envoyé avec succès !");

        } catch (error) {
            console.error("❌ Erreur lors de l'initialisation du règlement :", error);
        }
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;

        if (interaction.customId === 'accept_rules_aeroz') {
            const member = interaction.member;
            const aDejaLeRole = ROLES_A_DONNER.every(roleId => member.roles.cache.has(roleId));

            if (aDejaLeRole) {
                return interaction.reply({ 
                    content: "❌ Vous avez déjà accepté le règlement et possédez déjà vos rôles de membre !", 
                    ephemeral: true 
                });
            }

            try {
                await member.roles.add(ROLES_A_DONNER);
                return interaction.reply({ 
                    content: "✅ **Merci !** Vous avez accepté le règlement d'Aeroz Esports. Vos rôles vous ont été attribués et l'accès complet au serveur est débloqué !", 
                    ephemeral: true 
                });
            } catch (error) {
                console.error("❌ Impossible d'attribuer les rôles :", error);
                return interaction.reply({ 
                    content: "⚠️ Une erreur est survenue lors de l'attribution de vos rôles. Merci de contacter un administrateur.", 
                    exact: true,
                    ephemeral: true 
                });
            }
        }
    });

}; // Ne pas oublier de fermer l'accolade du module.exports tout à la fin
