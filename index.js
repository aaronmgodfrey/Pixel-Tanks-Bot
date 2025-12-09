const fs = require('fs');
const token = fs.readFileSync('token.txt', 'utf8');
console.log(token);

const {Client, GatewayIntentBits, Partials} = require("discord.js");
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent  // only needed if using prefix commands
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.Channel]
});

const Data = {};
const Load = _ => {
  console.log('Loading Bot Data...');
  Data.ReactionRoles = {};
  try {
    if (fs.existsSync('reaction_roles.json')) Data.ReactionRoles = JSON.parse(fs.readFileSync('reaction_roles.json', 'utf8')); else console.log(`'reaction_roles.json' does not exist!`);
  } catch(e) {
    console.log('Warning! Failed to load reaction roles!');
  }
}
const Save = _ => fs.WriteFileSync('reaction_roles.json', JSON.stringify(Data.ReactionRoles), 'utf8');

const commandPrefix = '!g ';
const setRole = async(user, reaction, rid, add) => {
  let member = reaction.message.guild.members.cache.get(user.id);
  if (!member) member = await reaction.message.guild.members.fetch(user.id);
  const role = reaction.message.guild.roles.cache.get(rid);
  if (!role || !member) return;
  await member.roles[add ? 'add' : 'remove'](role, 'Reaction role '+(add ? 'added' : 'removed'));
}
client.on('messageCreate', async message => {
  if (message.author.bot || !message.content.startsWith(commandPrefix)) return;
  const [_, command, ...args] = message.content.split(' ');
  if (command == 'rr') { // !g rr <messageid> <emoji> <role> <emoji> <role> etc.
    if (args.length%2 != 1) return message.reply('Invalid parameters');
    let msg;
    for (const channel of message.guild.channels.cache.values()) {
      if (!channel.isTextBased()) continue;
      msg = await channel.messages.fetch(args[0]).catch(_ => _);
      if (msg) break;
    }
    if (!msg) return message.reply('Message not found');
    Data.ReactionRoles[args[0]] = {};
    for (let i = 1; i < args.length; i += 2) {
      const emoji = args[i], role = args[i+1];
      Data.ReactionRoles[args[0]][emoji] = role;
      await msg.react(emoji);
    }
    Save();
  }
});
client.on('messageReactionAdd', async(reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch();
  if (reaction.message.partial) await reaction.message.fetch();
  for (const message in Data.ReactionRoles) {
    if (message != reaction.message.id) continue;
    for (const emoji in Data.ReactionRoles[message]) setRole(user, reaction, Data.ReactionRoles[message][emoji], reaction.emoji.toString() === emoji);
  }
});
client.on('messageReactionRemove', async(reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch();
  if (reaction.message.partial) await reaction.message.fetch();
  for (const message in Data.ReactionRoles) {
    if (message != reaction.message.id) continue;
    for (const emoji in Data.ReactionRoles[message]) if (reaction.emoji.toString() === emoji) setRole(user, reaction, Data.ReactionRoles[message][emoji], false);
  }
});
console.log('asdfasdf');
client.login(token);
