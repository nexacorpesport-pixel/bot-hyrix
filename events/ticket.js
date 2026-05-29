const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const config = require("../data/ticketConfig");

const ticketCooldown = new Map();

module.exports = async (client) => {

  // =========================
  // PANEL
  // =========================
  const channel = await client.channels.fetch(config.PANEL_CHANNEL).catch(() => null);
  if (!channel) return console.log("[TICKET] Panel introuvable");

  const embed = new EmbedBuilder()
    .setColor("#ffb347")
    .setTitle("🎫 Support System")
    .setDescription("Choisis une catégorie pour ouvrir un ticket.");

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket_select")
    .setPlaceholder("Choisis une catégorie")
    .addOptions([
      { label: "Staff", value: "staff", emoji: "🛡️" },
      { label: "Joueur", value: "joueur", emoji: "🎮" },
      { label: "Audiovisuel", value: "audiovisuel", emoji: "🎬" },
      { label: "Assistance", value: "aide", emoji: "🆘" },
      { label: "Partenariat", value: "partenariat", emoji: "🤝" },
      { label: "Autre", value: "autre", emoji: "📩" }
    ]);

  await channel.send({
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(menu)]
  });

  // =========================
  // INTERACTIONS
  // =========================
  client.on("interactionCreate", async (i) => {

    // =========================
    // MENU
    // =========================
    if (i.isStringSelectMenu() && i.customId === "ticket_select") {

      const type = i.values[0];

      const existing = i.guild.channels.cache.find(
        c => c.name === `ticket-${i.user.username}`
      );

      if (existing)
        return i.reply({ content: "Ticket déjà existant", ephemeral: true });

      const category = config.CATEGORIES[type];

      const channel = await i.guild.channels.create({
        name: `ticket-${i.user.username}`,
        type: ChannelType.GuildText,
        parent: category,
        permissionOverwrites: [
          {
            id: i.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: i.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory
            ]
          }
        ]
      });

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("delete").setLabel("Delete").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("help").setLabel("Help").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("form_joueur").setLabel("Formulaire").setStyle(ButtonStyle.Success)
      );

      await channel.send({
        content: `<@${i.user.id}>`,
        embeds: [
          new EmbedBuilder()
            .setTitle("🎫 Ticket ouvert")
            .setColor("#ffb347")
        ],
        components: [buttons]
      });

      return i.reply({ content: "Ticket créé", ephemeral: true });
    }

    // =========================
    // FORM JOUEUR (MODAL)
    // =========================
    if (i.isButton() && i.customId === "form_joueur") {

      const modal = new ModalBuilder()
        .setCustomId("joueur_form")
        .setTitle("Recrutement Joueur");

      const pr = new TextInputBuilder()
        .setCustomId("pr")
        .setLabel("PR EU")
        .setStyle(TextInputStyle.Short);

      const age = new TextInputBuilder()
        .setCustomId("age")
        .setLabel("Âge")
        .setStyle(TextInputStyle.Short);

      modal.addComponents(
        new ActionRowBuilder().addComponents(pr),
        new ActionRowBuilder().addComponents(age)
      );

      return i.showModal(modal);
    }

    // =========================
    // MODAL SUBMIT
    // =========================
    if (i.isModalSubmit() && i.customId === "joueur_form") {

      const pr = parseInt(i.fields.getTextInputValue("pr"));
      const age = i.fields.getTextInputValue("age");

      let roleToGive = null;

      for (const r of config.PR_ROLES) {
        if (pr >= r.min && pr < r.max) {
          roleToGive = r.role;
          break;
        }
      }

      if (roleToGive) {
        await i.member.roles.add(roleToGive).catch(() => {});
      }

      return i.reply({
        content: `✅ Formulaire validé (PR: ${pr}, âge: ${age})`,
        ephemeral: true
      });
    }

    // =========================
    // BUTTONS CLASSIQUES
    // =========================
    if (!i.isButton()) return;

    if (i.customId === "claim") {
      return i.reply(`📌 Claim par ${i.user}`);
    }

    if (i.customId === "close") {
      await i.channel.permissionOverwrites.edit(i.guild.roles.everyone, {
        SendMessages: false
      });
      return i.reply("🔒 fermé");
    }

    if (i.customId === "delete") {
      await i.reply("🗑️ delete dans 5s");
      setTimeout(() => i.channel.delete().catch(() => {}), 5000);
    }

    if (i.customId === "help") {
      return i.reply({
        ephemeral: true,
        content: "Support staff va arriver"
      });
    }

  });
};
