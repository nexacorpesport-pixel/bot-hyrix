const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "../data/antilink.json");

// =========================================
// CREATE FILE
// =========================================

if (!fs.existsSync(path.join(__dirname, "../data"))) {
    fs.mkdirSync(path.join(__dirname, "../data"));
}

if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({}, null, 4));
}

// =========================================
// LOAD / SAVE
// =========================================

function loadData() {
    return JSON.parse(fs.readFileSync(CONFIG_PATH));
}

function saveData(data) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 4));
}

// =========================================
// DETECTION REGEX
// =========================================

const discordInvite =
    /(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)/gi;

const urlRegex =
    /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;

const shorteners =
    /(bit\.ly|tinyurl\.com|t\.co|goo\.gl|cutt\.ly|rebrand\.ly|grabify\.link|iplogger|2no\.co)/gi;

const suspicious =
    /(grabify|iplogger|token|free-nitro|steamcommunity\-giveaway|nitro-free|dlscord)/gi;

// =========================================
// MODULE
// =========================================

module.exports = (client) => {

    console.log("[ANTILINK] Système chargé.");

    // =========================================
    // MESSAGE CREATE
    // =========================================

    client.on("messageCreate", async (message) => {

        try {

            if (!message.guild) return;
            if (message.author.bot) return;

            const data = loadData();

            if (!data[message.guild.id]) return;

            const config = data[message.guild.id];

            if (!config.enabled) return;

            // =========================================
            // WHITELIST ROLE
            // =========================================

            if (config.whitelistRoles?.length) {

                const hasWhitelist = message.member.roles.cache.some(r =>
                    config.whitelistRoles.includes(r.id)
                );

                if (hasWhitelist) return;
            }

            // =========================================
            // ADMIN BYPASS
            // =========================================

            if (
                message.member.permissions.has("Administrator")
            ) return;

            const content = message.content.toLowerCase();

            let detected = false;
            let reason = "";

            // =========================================
            // DISCORD INVITE
            // =========================================

            if (
                config.discordInvites &&
                discordInvite.test(content)
            ) {

                detected = true;
                reason = "Invitation Discord";
            }

            // =========================================
            // NORMAL LINKS
            // =========================================

            if (
                config.links &&
                urlRegex.test(content)
            ) {

                detected = true;
                reason = "Lien";
            }

            // =========================================
            // SHORTENERS
            // =========================================

            if (
                config.shorteners &&
                shorteners.test(content)
            ) {

                detected = true;
                reason = "Lien raccourci";
            }

            // =========================================
            // SUSPICIOUS
            // =========================================

            if (
                config.suspicious &&
                suspicious.test(content)
            ) {

                detected = true;
                reason = "Lien suspect";
            }

            if (!detected) return;

            // =========================================
            // DELETE MESSAGE
            // =========================================

            await message.delete().catch(() => {});

            // =========================================
            // TIMEOUT 5 MIN
            // =========================================

            if (message.member.moderatable) {

                await message.member.timeout(
                    5 * 60 * 1000,
                    `AntiLien: ${reason}`
                ).catch(() => {});
            }

            // =========================================
            // ALERT
            // =========================================

            await message.channel.send({

                content:
                `🚨 ${message.author} a envoyé un contenu interdit.\n` +
                `📌 Raison: **${reason}**\n` +
                `⏳ Timeout: **5 minutes**`

            }).then(msg => {

                setTimeout(() => {
                    msg.delete().catch(() => {});
                }, 10000);

            });

            console.log(
                `[ANTILINK] ${message.author.tag} -> ${reason}`
            );

        } catch (err) {

            console.log("[ANTILINK ERROR]", err);

        }

    });

    // =========================================
    // COMMANDS
    // PREFIX = +
    // =========================================

    client.on("messageCreate", async (message) => {

        try {

            if (!message.guild) return;
            if (message.author.bot) return;

            if (!message.content.startsWith("+")) return;

            const args = message.content.slice(1).trim().split(/ +/);
            const command = args.shift()?.toLowerCase();

            const data = loadData();

            if (!data[message.guild.id]) {

                data[message.guild.id] = {

                    enabled: false,

                    links: false,
                    discordInvites: false,
                    shorteners: false,
                    suspicious: false,

                    whitelistRoles: []

                };
            }

            const config = data[message.guild.id];

            // =========================================
            // PERMISSION
            // =========================================

            if (
                !message.member.permissions.has("Administrator")
            ) {

                return;
            }

            // =========================================
            // +antilink on
            // =========================================

            if (command === "antilink") {

                const option = args[0];

                if (!option) {

                    return message.reply(`
📌 Commandes:

+antilink on
+antilink off

+discordinvites on/off
+links on/off
+shorteners on/off
+suspicious on/off

+whitelist @role
+unwhitelist @role
                    `);
                }

                if (option === "on") {

                    config.enabled = true;

                    saveData(data);

                    return message.reply(
                        "✅ AntiLien activé."
                    );
                }

                if (option === "off") {

                    config.enabled = false;

                    saveData(data);

                    return message.reply(
                        "❌ AntiLien désactivé."
                    );
                }
            }

            // =========================================
            // TOGGLES
            // =========================================

            const systems = {

                links: "links",
                discordinvites: "discordInvites",
                shorteners: "shorteners",
                suspicious: "suspicious"

            };

            if (systems[command]) {

                const value = args[0];

                if (!["on", "off"].includes(value)) {

                    return message.reply(
                        "❌ Utilise on/off"
                    );
                }

                config[systems[command]] =
                    value === "on";

                saveData(data);

                return message.reply(
                    `✅ ${command} -> ${value}`
                );
            }

            // =========================================
            // WHITELIST
            // =========================================

            if (command === "whitelist") {

                const role = message.mentions.roles.first();

                if (!role) {

                    return message.reply(
                        "❌ Mentionne un rôle."
                    );
                }

                if (
                    config.whitelistRoles.includes(role.id)
                ) {

                    return message.reply(
                        "❌ Déjà whitelist."
                    );
                }

                config.whitelistRoles.push(role.id);

                saveData(data);

                return message.reply(
                    `✅ ${role} ajouté whitelist.`
                );
            }

            // =========================================
            // UNWHITELIST
            // =========================================

            if (command === "unwhitelist") {

                const role = message.mentions.roles.first();

                if (!role) {

                    return message.reply(
                        "❌ Mentionne un rôle."
                    );
                }

                config.whitelistRoles =
                    config.whitelistRoles.filter(
                        r => r !== role.id
                    );

                saveData(data);

                return message.reply(
                    `✅ ${role} retiré whitelist.`
                );
            }

            // =========================================
            // STATUS
            // =========================================

            if (command === "antilinkstatus") {

                return message.reply(`

🛡️ AntiLien: ${config.enabled ? "ON" : "OFF"}

🔗 Liens: ${config.links ? "ON" : "OFF"}

📨 Invitations Discord:
${config.discordInvites ? "ON" : "OFF"}

📎 Shorteners:
${config.shorteners ? "ON" : "OFF"}

⚠️ Suspicious:
${config.suspicious ? "ON" : "OFF"}

👑 Whitelist rôles:
${config.whitelistRoles.length}

                `);
            }

        } catch (err) {

            console.log("[COMMAND ERROR]", err);

        }

    });

};
