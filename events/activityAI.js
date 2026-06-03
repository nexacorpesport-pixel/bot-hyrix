const { EmbedBuilder } = require("discord.js");
const { OpenAI } = require("openai");
const fs = require("fs");
const path = require("path");

// Chemin vers ton fichier de config
const CONFIG_PATH = path.join(__dirname, "../data/botAIConfig.json");

let config = {};
if (fs.existsSync(CONFIG_PATH)) {
    try {
        config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    } catch (e) {
        console.log("[🤖 HOVEX-AI] Erreur de lecture du fichier JSON, utilisation des variables d'environnement.");
    }
}

// 🔥 CORRECTION : Priorité à la variable d'environnement Render, sinon le JSON
const apiKey = process.env.OPENAI_KEY || config.OPENAI_KEY;
const channelId = config.CHILL_AI_CHANNEL || "1505330791268487319"; // ID de secours si le JSON n'est pas lu

const openai = apiKey && apiKey !== "PROCESS_ENV" ? new OpenAI({ apiKey: apiKey }) : null;

module.exports = async (client) => {
    // Si l'IA n'est pas initialisée, on met un message clair dans les logs au lieu de crash
    if (!openai) {
        return console.log("[🤖 HOVEX-AI] Clé API manquante ou invalide. Renseigne OPENAI_KEY sur Render. Module désactivé.");
    }

    console.log("[🤖 HOVEX-AI] Module de discussion et d'activité HoveX chargé avec succès !");

    client.on("messageCreate", async (message) => {
        // On ignore les bots et les messages hors du salon dédié au chill
        if (message.author.bot || !message.guild) return;
        if (message.channel.id !== channelId) return;

        // Liste de mots-clés de salutation pour animer la discussion
        const greetings = ["salut", "bonjour", "yo", "wsh", "cc", "hello", "slt", "hey"];
        const messageLower = message.content.toLowerCase();
        
        const isGreeting = greetings.some(greet => messageLower.includes(greet));
        const mentionsBot = message.mentions.has(client.user.id);

        // 50% de chance de répondre aux messages normaux, 100% si bonjour ou mention
        if (!isGreeting && !mentionsBot && Math.random() > 0.5) return;

        // Effet "Le bot écrit..."
        await message.channel.sendTyping();

        try {
            const personalPrompt = `Tu es HoveX-AI, l'IA mascotte et super sympa du serveur Team HoveX.
            Ton but est de parler avec les membres du serveur, de mettre de l'ambiance et de créer de l'activité.
            Quand on te dit bonjour, salut, yo, wsh ou qu'on te parle, réponds toujours de manière hyper cool, détendue et amicale (style gamer/peer bienveillant).
            Demande-leur régulièrement comment va leur journée, ce qu'ils font de beau ou s'ils ont prévu de lancer des games.
            Utilise des émojis, tutoie les gens, sois court, dynamique et ne fais pas de longs textes ennuyeux. Relance la conversation à la fin de ton message.`;

            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: personalPrompt },
                    { role: "user", content: `${message.author.username} dit : ${message.content}` }
                ],
                max_tokens: 150,
                temperature: 0.8
            });

            const replyText = response.choices[0].message.content;

            // Réponse directe au joueur
            await message.reply({ content: replyText });

        } catch (error) {
            console.error("Erreur d'activité HoveX-AI :", error);
        }
    });
};
