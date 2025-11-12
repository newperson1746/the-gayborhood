import dotenv from 'dotenv-extended';
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  GuildMember,
} from 'discord.js';
import { createStdEmbed } from '../utils/embeds';
import { sqlWriteSohoPeople } from '../utils/os_native_glue';

export default class SohoPplAdd {
  readonly command = new SlashCommandBuilder()
    .setName('in')
    .setDescription('Add yourself to the soho people list')
    .setDefaultMemberPermissions(0n) // disabled until roles are granted

  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;

    const public_success = createStdEmbed(interaction.client);
    public_success.setTitle('SoHo People Add');
    public_success.setDescription(
      
     `${interaction.member.user}, successfully added yourself to the soho people list`
    );

    const stdembed = createStdEmbed(interaction.client);
    stdembed.setTitle('SoHo People Add');
    stdembed.setDescription(`Please wait...`);
    interaction.reply({
      embeds: [stdembed],
      ephemeral: true
    })
    .then( () => {
      sqlWriteSohoPeople(member.id.toString(), (error, results, fields) => {
        if (error) {
          console.log('Error in SoHo people add query:', error);
          stdembed.setDescription(`Error in sqlWriteSohoPeople: ${error}`);
          interaction.followUp({
            embeds: [stdembed],
            ephemeral: false
          })
        } else {
          interaction.followUp({
            embeds: [public_success]
          });
        }
      })
    })
  }
}
