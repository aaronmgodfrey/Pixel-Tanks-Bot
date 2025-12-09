const fs = require('fs');
const token = fs.readFileSync('token.txt', 'utf8').replace(/ /g, '').replace(/\n/g, '');

const {Client, GatewayIntentBits, Partials} = require("discord.js");
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.Channel]
});

const Data = {};
const Load = _ => {
  console.log('Loading Bot Data...');
  Data.ReactionRoles = {};
  try {
    if (fs.existsSync('reaction_roles.json')) Data.ReactionRoles = JSON.parse(fs.readFileSync('reaction_roles.json', 'utf-8')); else console.log(`'reaction_roles.json' does not exist!`);
  } catch(e) {
    console.log('Warning! Failed to load reaction roles!');
  }
}
const Save = _ => fs.writeFileSync('reaction_roles.json', JSON.stringify(Data.ReactionRoles), 'utf-8');

const reminders = [`Shouldn't you be making menus right now?`, `A menu a day keeps the set loss away`, `Where's my menus?`, `Aren't you going to make menus?`, `Menus????`, `Hello? Menus?`, ` should be making menus right now...`];
const LoafReminder = _ => {
  setTimeout(() => {
    const web = client.channels.cache.get('1442234725996695632');
    web.send('<@1180677005407166546> '+reminders[Math.floor(reminders.length*Math.random())]);
  }, 1000*60*60*24*Math.random());
}
setInterval(LoafReminder, 1000*60*60*24);

const setRole = async(user, reaction, rid, add) => {
  rid = rid.replaceAll('<', '').replaceAll('>', '').replaceAll('@', '').replaceAll('&', '');
  let member = reaction.message.guild.members.cache.get(user.id);
  if (!member) member = await reaction.message.guild.members.fetch(user.id);
  const role = reaction.message.guild.roles.cache.get(rid);
  if (!role || !member) return;
  await member.roles[add ? 'add' : 'remove'](role, 'Reaction role '+(add ? 'added' : 'removed'));
}
const commandPrefix = '!g ';
const greetings = ['Hi', 'Hello', 'Hey', 'Hey there', 'Hi', 'Heya', 'Sup', 'Hoi', 'Hia'], emoticons = ['^V^', ':)', ':]', ':D', '=)', '=]', '=D'];
client.on('messageCreate', async message => {
  const lower = message.content.toLowerCase();
  if (message.content.includes('<@1447959380787200021>') && (lower.includes('hi') || lower.includes('hey')) message.reply(greetings[Math.floor(Math.random()*greetings.length)]+' '+emoticons[Math.floor(Math.random()*emoticons.length)]);
  if (message.author.bot || !message.content.startsWith(commandPrefix)) return;
  const [_, command, ...args] = message.content.split(' ');
  if (command == 'rr') { // !g rr <messageid> <emoji> <role> <emoji> <role> etc.
    if (args.length%2 != 1) return message.reply('Invalid parameters');
    const msg = await message.channel.messages.fetch(args[0]);
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
client.login(token);
Load();
