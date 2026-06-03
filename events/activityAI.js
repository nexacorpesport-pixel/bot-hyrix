const { EmbedBuilder } = require("discord.js");
const { OpenAI } = require("openai");
const fs = require("fs");
const path = require("path");

// Chemin vers ton nouveau fichier de config épuré
const CONFIG_PATH = path.join(__dirname, "../data/botAIConfig.json");

let config = {};
if (fs.existsSync(CONFIG_PATH)) {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
} else {
    console.log("[🤖 HOVEX-AI] Erreur : Le fichier data/botAIConfig.json est introuvable.");
}

// Initialisation de l'IA avec la bonne clé du fichier botAIConfig
const openai = config.OPENAI_KEY ? new OpenAI({ apiKey: config.OPENAI_KEY }) : null;

module.exports = async (client) => {
    if (!openai) {
        return console.log("[🤖 HOVEX-AI] Clé API manquante dans botAIConfig.json. Le module discussion est désactivé.");
    }

    console.log("[🤖 HOVEX-AI] Module de discussion et d'activité HoveX chargé avec succès !");

    client.on("messageCreate", async (message) => {
        // On ignore les bots et les messages hors du salon dédié au chill
        if (message.author.bot || !message.guild) return;
        if (message.channel.id !== config.CHILL_AI_CHANNEL) return;

        // Liste de mots-clés de salutation pour animer la discussion
        const greetings = ["salut", "bonjour", "yo", "wsh", "cc", "hello", "slt", "hey"];
        const messageLower = message.content.toLowerCase();
        
        const isGreeting = greetings.some(greet => messageLower.includes(greet));
        const mentionsBot = message.mentions.has(client.user.id);

        // 50% de chance de répondre aux messages normaux pour ne pas spammer, mais 100% si on lui dit bonjour ou qu'on le mentionne
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
