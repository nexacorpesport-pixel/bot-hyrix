const userMessages = new Map();
const userWarnings = new Map();

// ⚙️ CONFIG
const MESSAGE_LIMIT = 5;
const TIME_WINDOW = 5000;
const MAX_EMOJIS = 6;
const MAX_CAPS_PERCENT = 70;

// 🧠 blacklist mots (modifiable)
const bannedWords = ["pute", "merde", "fdp"];

// 🔇 SANCTIONS (en ms)
const sanctions = {
    5: 60 * 60 * 1000,        // 1h
    7: 24 * 60 * 60 * 1000,   // 1j
    9: 3 * 24 * 60 * 60 * 1000,
    11: 7 * 24 * 60 * 60 * 1000,
    13: 24 * 24 * 60 * 60 * 1000
};

// 📊 UTILS
function countEmojis(text) {
    return (text.match(/<a?:\w+:\d+>|[\u{1F300}-\u{1FAFF}]/gu) || []).length;
}

function isSpam(userId) {
    const now = Date.now();

    if (!userMessages.has(userId)) {
        userMessages.set(userId, []);
    }

    const timestamps = userMessages.get(userId);
    timestamps.push(now);

    const recent = timestamps.filter(t => now - t < TIME_WINDOW);
    userMessages.set(userId, recent);

    return recent.length >= MESSAGE_LIMIT;
}

function isCaps(text) {
    const letters = text.replace(/[^a-zA-Z]/g, "");
    if (letters.length < 5) return false;

    const upper = letters.replace(/[^A-Z]/g, "").length;
    return (upper / letters.length) * 100 > MAX_CAPS_PERCENT;
}

function containsBadWords(text) {
    return bannedWords.some(word => text.toLowerCase().includes(word));
}

// ⚠️ WARN SYSTEM
async function addWarning(member, message) {
    const userId = member.id;

    if (!userWarnings.has(userId)) {
        userWarnings.set(userId, 0);
    }

    let warns = userWarnings.get(userId) + 1;
    userWarnings.set(userId, warns);

    let response = `⚠️ ${member}, avertissement (${warns})`;

    // 🔇 appliquer sanction
    if (sanctions[warns]) {
        try {
            await member.timeout(sanctions[warns]);
            response += `\n🔇 Tu es mute pendant ${sanctions[warns] / 1000 / 60} minutes.`;
        } catch (err) {
            console.error("Erreur mute :", err);
        }
    }

    const warnMsg = await message.channel.send(response);
    setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
}

// 🚨 MAIN
module.exports = async (message) => {
    if (!message.guild || message.author.bot) return;

    const member = message.member;
    const content = message.content;

    try {
        // 🚫 SPAM
        if (isSpam(member.id)) {
            await message.delete();
            return addWarning(member, message);
        }

        // 😀 EMOJIS
        if (countEmojis(content) > MAX_EMOJIS) {
            await message.delete();
            return addWarning(member, message);
        }

        // 🔠 MAJUSCULES
        if (isCaps(content)) {
            await message.delete();
            return addWarning(member, message);
        }

        // 🧠 AUTO-MOD (mots interdits)
        if (containsBadWords(content)) {
            await message.delete();
            return addWarning(member, message);
        }

    } catch (err) {
        console.error("Erreur modération :", err);
    }
};
