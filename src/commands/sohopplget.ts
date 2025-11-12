import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { createStdEmbed } from '../utils/embeds';
import { sqlGetSohoPeople } from '../utils/os_native_glue';

export default class SoHoPplGet {
  readonly command = new SlashCommandBuilder()
    .setName('list')
    .setDescription('Get people currently in SoHo');

  async execute(interaction: ChatInputCommandInteraction) {
    const stdembed = createStdEmbed(interaction.client);
    const public_success = createStdEmbed(interaction.client);
    public_success.setTitle('SoHo Get People');

    stdembed.setTitle('SoHo Get People');
    stdembed.setDescription(`Please wait...`);
    
    interaction.reply({
      embeds: [stdembed],
      ephemeral: false
    })
    .then( () => {
    sqlGetSohoPeople((error, results, fields) => {
      if (error) {
        console.log('Error in SoHo people get query:', error);
        stdembed.setDescription(`Error in sqlGetSoHoPeople: ${error}`);
        interaction.followUp({
          embeds: [stdembed],
          ephemeral: false
        })
      } else {
        if (results.length === 0) {
          public_success.setDescription(
            `Nobody is currently in Soho.`
          );
        } else {
         // results is an array, and map is a new array with func appl to elems
         const peopleList = results.map(row => `• <@${row.discordid}>`).join('\n');

         public_success.setDescription(
            `**People currently in Soho:**\n\n` +
            `${peopleList}`
          );
        }
        interaction.followUp({
          embeds: [public_success]
        });
      }
     })
    })
  }
}
