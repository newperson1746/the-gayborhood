require('dotenv-extended').load();
import Discord from 'discord.js';
import Raven from 'raven';
import fs from 'fs';
import logger from './logger';
import { instantiate } from './deploy_commands';

import aggregateEvents from './events';

import net from 'net'; // for sockets
import mysql from 'mysql2';
import { createStdEmbed } from './utils/embeds';
import { statuses } from './utils/statuses';

// SQL init
import {getMySQLVersion, getMySQLVersionMC } from './utils/mysql_init';

getMySQLVersion();
getMySQLVersionMC();

// Discord client itself
class DiscordClient extends Discord.Client {
  constructor(s: Discord.ClientOptions) {
    super(s);
  }

  commands: Discord.Collection<string, any>;
}

// Instantiations of Discord.js, Discord Collection, Sentry
const client = new DiscordClient({
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMessages,
    Discord.GatewayIntentBits.GuildMessageReactions,
    Discord.GatewayIntentBits.MessageContent,
  ],
  partials: [Discord.Partials.Channel],
});
const events: Discord.Collection<string, any> = new Discord.Collection();
Raven.config(process.env.SENTRY_DSN).install();

// Staff member role ID (@Staff)
const staffRoleId: string = process.env.STAFF_ROLE_ID;
// Staff member role ID (@Staff)
const staffReportRoleId: string = process.env.STAFF_REPORT_ROLE_ID;

// Channel IDs
const reportsChannel: string = process.env.REPORTS_CHANNEL_ID; // #reports

client.login(process.env.DISCORD_TOKEN);
client.commands = new Discord.Collection();
const commandFiles = fs.readdirSync('./src/commands');

aggregateEvents(events); // Require all events

client.on(Discord.Events.ClientReady, async () => {
  // eslint-disable-next-line
  await logger.info("I'm ready!");


  setInterval(function() {
    let blurb = statuses[Math.floor(Math.random()*statuses.length)];
    //client.user.setActivity(status, {type: "PLAYING"});
    client.user.setPresence({
      status: 'idle',
      activities: [{
        type: Discord.ActivityType.Custom,
        name: 'gay',
        state: blurb
      }]
    }) 
  },
  300000)

  const guild = await client.guilds.fetch(process.env.GUILD_ID);
  const channel = await guild.channels.fetch(process.env.BOT_MESSAGES_CHANNEL_ID) as Discord.TextChannel | null;
  await channel.send(`I'm ready to be edgy meow heheh meow`)

  for (const file of commandFiles) {
    const name = file.endsWith('.ts')
      ? file.replace('.ts', '')
      : file.replace('.js', '');
    const command = require(`./commands/${name}`);

    // Instantiate class
    const c = instantiate(command.default, null);

    // Save commands to an object with name of slash command
    client.commands.set(c.command.name, c);

    await logger.debug(`Loaded command "${name}"`, command);
  }

  // UNIX Sockets IPC
  const socketPath = '/var/run/sillybots/meowbotipc';
  const SoHoVc = await guild.channels.fetch(process.env.SOHO_VC_ID) as Discord.VoiceChannel;
  const SoHoTc = await guild.channels.fetch(process.env.SOHO_TC_ID) as Discord.TextChannel;
  // Remove existing socket file if it exists
  try {
      fs.unlinkSync(socketPath);
  } catch (error) {
      // Ignore file not found error
  }
  
  const server = net.createServer((socket) => {
      console.log('Socket client connected');

      socket.on('data', (data) => {
          const message = JSON.parse(data.toString());

          if (message.type === 'SoHoUpdate') {
              console.log('Received SoHoUpdate message with data:', message.data);
              const perpetrator = 
                message.data.discordid ? `${message.data.discordid}` : "No perpetrator provided";
              const SoHoEmbed = createStdEmbed(client);
              SoHoEmbed.setTitle('SoHo Status Update');
              SoHoEmbed.setDescription(
                `Room status is now: **${message.data.status}**\n` +
                `Set by ${perpetrator}\n` +
                `<t:${message.data.time}:R>`
              );
              SoHoTc.send({ content: `<@&${process.env.SOHO_HANGOUTS_ROLE_ID}>`, 
                            embeds: [SoHoEmbed] });
              switch(message.data.status) {
                case "open":
                  SoHoVc.setName(`SoHo: 🟢 Open`)
                  break;
                case "closed":
                  SoHoVc.setName(`SoHo: 🔴 Closed`);
                  break;
                case "knock":
                  SoHoVc.setName(`SoHo: 🟡 Knock`);
                  break;
                case "dnd":
                  SoHoVc.setName(`SoHo: ⛔️ DnD`);
                  break;
                default:
                  SoHoVc.setName(`SoHo: ${message.data.status}`);
              }
          } else if (message.type === 'otherType') { // for the future teehee
              console.log('Received otherType message with data:', message.data);
              // Handle this later heheh ribbet
          } else {
             console.log('Unknown message type:', message.type);
          }
     });

      socket.on('end', () => {
          console.log('Socket client disconnected');
      });
  });

  server.listen(socketPath, () => {
     console.log('UNIX socket ipc listening on', socketPath);
     fs.chmod(socketPath, 0o770, (err) => {
       if (err) {
         console.error('Error setting file permissions:', err);
       }
     });

     fs.chown(socketPath, 1004, 1015, (err) => {
       if (err) {
         console.error('Error setting file owner/group:', err);
       }
     });

  });
  // end unix sockets ipc

}); // end: client.on ready

// Slash commands
client.on(Discord.Events.InteractionCreate, async (interaction) => {
  if (!interaction.isCommand()) return;

  await logger.trace('Retrieving slash command logic');

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  await logger.debug(`Executing slash command "${interaction.commandName}"`);

  try {
    // Mention command needs Discord collection
    await command.execute(interaction);
  } catch (error) {
    await logger.error(error);
  }
});

// Buttons
client.on(Discord.Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  await logger.trace('Retrieving button logic');

  // format: interaction::[0-infty], e.g. report::0, report::1, report::2
  const [action, id] = interaction.customId.split('::');

  await logger.debug(`Executing button ${action}::${id}`);

  if (!client.commands.has(action)) return;

  const command = client.commands.get(action);

  if (!command) return;

  try {
    // Mention command needs Discord collection
    await command.executeButton(interaction, Number(id));
  } catch (error) {
    await logger.error(error);
  }
});

// Select menu
client.on(Discord.Events.InteractionCreate, async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;

  await logger.trace('Retrieving select menu logic');

  // format: interaction::[0-infty], e.g. report::0, report::1, report::2
  const [action, id] = interaction.customId.split('::');

  await logger.debug(`Executing select menu ${action}::${id}`);

  if (!client.commands.has(action)) return;

  const command = client.commands.get(action);

  if (!command) return;

  try {
    // Mention command needs Discord collection
    await command.executeMenu(interaction, Number(id));
  } catch (error) {
    await logger.error(error);
  }
});

// Context menu
client.on(Discord.Events.InteractionCreate, async (interaction) => {
  if (!interaction.isContextMenuCommand()) return;

  await logger.trace('Retrieving context menu logic');

  // format: interaction::[0-infty], e.g. report::0, report::1, report::2
  if (!client.commands.has(interaction.commandName)) return;

  const command = client.commands.get(interaction.commandName);

  await logger.debug(`Executing slash command "${interaction.commandName}"`);

  if (!command) return;

  try {
    // Mention command needs Discord collection
    await command.executeContextMenu(interaction);
  } catch (error) {
    await logger.error(error);
  }
});

// Modal
client.on(Discord.Events.InteractionCreate, async (interaction) => {
  if (!interaction.isModalSubmit()) return;

  await logger.trace('Retrieving modal logic');

  const [action, id] = interaction.customId.split('::');

  if (!client.commands.has(action)) return;

  await logger.debug(`Executing select menu ${action}::${id}`);

  const command = client.commands.get(action);

  if (!command) return;

  try {
    // Mention command needs Discord collection
    await command.executeModalSubmit(interaction, Number(id));
  } catch (error) {
    await logger.error(error);
  }
});

// Messages
client.on(Discord.Events.MessageCreate, async (message) => {
  try {
    const {
      cleanContent: content,
      member,
      author,
      channel,
      mentions,
    } = message;

    await logger.trace('Message create event triggered');

      // Void venting for prism
    if (channel.id === process.env.VOID_VENT_CHANNEL_ID && !message.author.bot) {
      try {
        await message.delete();
      } catch (err) {
        console.error('Failed to delete the message:', err);
      }
    }

    if (member) {
      const command = content.split(' ').shift().toLowerCase(); // Get first word of string
      const operator = content.slice(0, 1); // Get first letter of string

      if (author.id === client.user.id) return; // Ignore own bot's messages

      // events
      //   .get('message::dialogflow')
      //   .execute(message);

      // Reports are separate since stipulations are too general
      if (mentions.roles && channel.id !== reportsChannel) {
        const Report = events.get('message::report').default;

        new Report(message, reportsChannel, staffReportRoleId).execute();
      }

      // Commands
      if (
        command === '?gwarn' &&
        mentions.members &&
        member.roles.cache.has(staffRoleId)
      ) {
        const Warning = events.get('message::warning').default;

        new Warning(message).execute();
      }
    }
  } catch (error) {
    await logger.error(error);
    Raven.captureException(error);
  }
});
