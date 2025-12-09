const fs = require('fs');
const token = fs.readFileSync('token.txt', 'utf8').replace(/ /g, '').replace(/\n/g, '');

const {Client, GatewayIntentBits, Partials} = require("discord.js");
const express = require('express');

const app = express();
app.use(express.json());

const e = _ => _;

const forumChannel = '1407752313522880512';
const ensureThreadForIssue = async (repoFullName, issueNumber, issueTitle, issueUrl, issueBody) => {
  console.log('Ensure thread');
  if (Data.Issues[issueNumber]) {
    try {
      const storedChannel = await client.channels.fetch(Data.Issues[issueNumber].channel).catch(e);
      if (storedChannel) {
        const storedThread = await client.channels.fetch(Data.Issues[issueNumber].thread).catch(e);
        if (storedThread && storedThread.isThread()) return storedThread;
      }
    } catch (e) {}
  }
  console.log('asdf');
  const channel = await client.channels.fetch(forumChannel).catch(e);
  console.log(channel);
  console.log(channel.isTextBased());
  if (!channel || !channel.isTextBased()) return;

  const messageContent = `**Issue #${issueNumber}: ${issueTitle}**\n${issueUrl}\n\n${issueBody || '(no description)'}`;
  const threadName = `Issue #${issueNumber}: ${issueTitle}`.slice(0, 100); // keep it reasonable
  console.log('making thread');
  const thread = await channel.threads.create({
    name: threadName,
    autoArchiveDuration: 10080,
    message: {content: messageContent},
  }).catch(err => console.error('Failed to create forum post/thread:', err));
  if (!thread) return;

  Data.Issues[issueNumber] = {channel: channel.id, thread: thread.id};
  Save();
  return thread;
}

app.post('/webhook', async(req, res) => {
  console.log('REQUEST RECEIVED');
  try {
    const event = (req.get('X-Gitea-Event') || req.get('X-GitHub-Event') || '').toLowerCase();
    const payload = req.body || {};
    if (event === 'issues' || event === 'issue' || event === 'issue_comment' || event === 'issue_comment.created' || event === 'comment') {
      const issue = payload.issue || payload;
      const repo = payload.repository || payload.repo || {};
      if (!issue || !repo) return res.status(200).send('ignored');

      const repoFull = repo.full_name || `${repo.owner?.login || repo.owner?.name}/${repo.name}`;
      const issueNumber = issue.number;
      const issueTitle = issue.title || '(no title)';
      const issueUrl = issue.html_url || issue.url || '';
      const issueBody = issue.body || issue.content || '';

      const thread = await ensureThreadForIssue(repoFull, issueNumber, issueTitle, issueUrl, issueBody);
      if (!thread) return res.status(500).send('no-thread');

      if (event === 'issues' || event === 'issue') {
        const action = payload.action || 'unknown';
        await thread.send({ content: `Issue ${action}: **${issueTitle}**\n${issueUrl}` }).catch(e => console.warn('send err', e));
        return res.status(200).send('ok');
      } else {
        const comment = payload.comment || {};
        const author = comment.user?.login || comment.user?.name || 'unknown';
        const commentBody = comment.body || comment.content || '';
        const commentUrl = comment.html_url || comment.url || '';
        const text = `**Comment by ${author}:**\n${commentBody}\n\n${commentUrl}`;
        await thread.send({content: text}).catch(e => console.warn('send err', e));
        return res.status(200).send('ok');
      }
    }
    return res.status(200).send('ignored');
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).send('server error');
  }
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
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
  Data.Issues = {};
  try {
    if (fs.existsSync('issues.json')) Data.Issues = JSON.parse(fs.readFileSync('issues.json', 'utf-8')); else console.log(`'issues.json does not exist!`);
  } catch(e) {
    console.log('Warning! Failed to load issues!');
  }
}
const Save = _ => {
  fs.writeFileSync('reaction_roles.json', JSON.stringify(Data.ReactionRoles), 'utf-8');
  fs.writeFileSync('issues.json', JSON.stringify(Data.Issues), 'utf-8');
}

const issueNumberForThread = async(id) => {
  for (const [issueNumber, info] of Object.entries(Data.Issues)) {
    if (info && info.thread === id) return issueNumber;
  }
  return;
}
const postCommentToCodeberg = async(issueNumber, bodyMarkdown) => {
  try {
    const url = `https://codeberg.org/api/v1/repos/cs641311/PixelTanks/issues/${issueNumber}/comments`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'fdba24e2d6e5ffcfc9b0d8ed5ca99ebb834c0498',
      },
      body: JSON.stringify({body: bodyMarkdown}),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '<no body>');
      console.warn(`Failed to post comment to Codeberg: ${res.status} ${res.statusText} — ${text}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error posting comment to Codeberg:', err);
    return false;
  }
}

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
  let lower = message.content.toLowerCase();
  if (lower.includes('] ben')) lower = lower.replace('] be', 'ezlb');
  if (lower.includes('greg') || message.content.includes('<@1447959380787200021>')) {
    if (lower.includes('[owner] r3gress1on')) lower = lower.replace('] r3', 'ezlb');
    if (greetings.some(g => lower.includes(g.toLowerCase()))) message.reply(greetings[Math.floor(Math.random()*greetings.length)]+' '+emoticons[Math.floor(Math.random()*emoticons.length)]);
    if (lower.includes('r3')) message.reply('<@783362675761348629>');
  }
  if (lower.includes('oops')) message.reply('hotdog'); // TEMP
  if (lower.includes('ben')) message.reply('10'); // TEMP

  if (message.channel.id == forumChannel && message.channel.isThread()) {
    const issueNumber = issueNumberForThread(message.channel.id);
    if (!issueNumber) return;

    let md = `**From Discord — ${message.author.tag}**\n\n${message.content || ''}`;
    if (message.attachments && message.attachments.size > 0) {
      const urls = message.attachments.map(a => a.url).join('\n');
      md += `\n\n**Attachments:**\n${urls}`;
    }
    if (message.url) md += `\n\n[View on Discord](${message.url})`;

    // post to Codeberg
    const ok = await postCommentToCodeberg(issueNumber, md);
    if (!ok) console.log('Failed to sync forum thread to codeberg');
  }

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
app.listen(35612, () => console.log(`Listening for webhooks on http://0.0.0.0:35612/webhook`));
Load();
