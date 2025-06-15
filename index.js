require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Events, EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const matchCommand = new SlashCommandBuilder()
  .setName('match')
  .setDescription('Look for players for a game')
  .addStringOption(o => o.setName('game').setDescription('Game name').setRequired(true))
  .addIntegerOption(o => o.setName('players').setDescription('Total players needed').setRequired(true))
  .addStringOption(o => o.setName('time').setDescription('Planned start time').setRequired(false));

const matchData = new Map();

async function ensureGamingChannel(guild) {
  let channel = guild.channels.cache.find(c => c.name === 'gaming' && c.isTextBased());
  if (!channel) {
    try {
      channel = await guild.channels.create({ name: 'gaming', reason: 'Needed for match commands' });
      console.log(`Created #gaming in ${guild.name}`);
    } catch (err) {
      console.warn(`Could not create #gaming in ${guild.name}: ${err.message}`);
    }
  }
  return channel;
}

function buildEmbed(game, players, time, joined) {
  return new EmbedBuilder()
    .setTitle(`Looking for players: ${game}`)
    .addFields(
      { name: 'Players needed', value: String(players), inline: true },
      { name: 'Time (optional)', value: time || 'Not specified', inline: true },
      { name: `Joined (${joined.length})`, value: joined.join('\n') || '\u200b' }
    );
}

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  for (const guild of client.guilds.cache.values()) {
    await ensureGamingChannel(guild);
  }
  try {
    const commands = await client.application.commands.fetch();
    if (!commands.some(c => c.name === 'match')) {
      await client.application.commands.create(matchCommand);
      console.log('Registered /match command');
    }
  } catch (err) {
    console.error('Failed to register slash command:', err);
  }
});

async function handleMatchCommand(message, game, playersStr, time) {
  const players = parseInt(playersStr, 10);
  if (isNaN(players)) {
    const reply = 'Usage: /match <game> <players> [time] - players must be an integer.';
    if (message.reply) return message.reply(reply);
    else return message.followUp({ content: reply, ephemeral: true });
  }
  const gamingChannel = message.guild.channels.cache.find(c => c.name === 'gaming' && c.isTextBased());
  if (!gamingChannel) {
    return message.reply ? message.reply('Gaming channel not found.') : message.followUp({ content: 'Gaming channel not found.', ephemeral: true });
  }
  if (message.channel.id !== gamingChannel.id) {
    try {
      await message.member.send('Please use the #gaming channel for match requests.');
    } catch (err) {
      console.warn('Could not DM user:', err.message);
    }
    if (message.reply) {
      return message.reply('Check your DMs for instructions.');
    } else {
      return message.followUp({ content: 'Check your DMs for instructions.', ephemeral: true });
    }
  }
  const embed = buildEmbed(game, players, time, []);
  const sent = await gamingChannel.send({ embeds: [embed] });
  await sent.react('👍');
  matchData.set(sent.id, { players, joined: [], game, time, locked: false });
  if (message.reply) return message.reply({ content: 'Match posted!', ephemeral: true });
}

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'match') return;
  const game = interaction.options.getString('game');
  const playersStr = String(interaction.options.getInteger('players'));
  const time = interaction.options.getString('time');
  await handleMatchCommand(interaction, game, playersStr, time);
});

client.on(Events.MessageCreate, async msg => {
  if (msg.author.bot || !msg.content.startsWith('!match')) return;
  const args = msg.content.trim().split(/\s+/).slice(1);
  const [game, playersStr, ...timeParts] = args;
  const time = timeParts.join(' ');
  await handleMatchCommand(msg, game, playersStr, time);
});

async function updateJoined(reaction, user, add) {
  if (reaction.emoji.name !== '👍') return;
  const data = matchData.get(reaction.message.id);
  if (!data) return;
  const guild = reaction.message.guild;
  const member = await guild.members.fetch(user.id);
  const name = member.displayName;
  const joined = data.joined;

  if (add) {
    if (!joined.includes(name)) joined.push(name);
  } else {
    const idx = joined.indexOf(name);
    if (idx !== -1) joined.splice(idx, 1);
  }

  const embed = buildEmbed(data.game, data.players, data.time, joined);
  await reaction.message.edit({ embeds: [embed] });

  const existing = reaction.message.reactions.cache.find(r => r.emoji.name === '👍');
  if (joined.length >= data.players) {
    if (existing) await existing.remove();
    data.locked = true;
  } else if (data.locked) {
    await reaction.message.react('👍');
    data.locked = false;
  }
}

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch();
  await updateJoined(reaction, user, true);
});

client.on(Events.MessageReactionRemove, async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch();
  await updateJoined(reaction, user, false);
});

client.login(process.env.DISCORD_TOKEN);
