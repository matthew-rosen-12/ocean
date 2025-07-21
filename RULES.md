Each of the players controls an animal

There are npc groups the contain varying number of npcs - each npc group is just a collection of filenames, where the top filename of the group is what gets rendered and there's a number above the npc group displaying the total number of npcs in the group and the size of the rendered group depends on the number of npcs in the group

The animals can capture npc groups, and once captured the npc group follows the animal

The user can press space once to throw an npc from its captured npc group or hold down space to charge up a throw which will throw more npcs from its captured npc group ('thrown npcs' is just 1 npc group that gets created and thrown and those filenames removed from the captured npc group)

If two npc groups collide then the smaller one gets merged into the bigger one

if same size then they bounce off each other
move around with arrow keys or wasd

The winner is whichever user has captured the most npcs when time is up - not including thrown npcs! Only npcs that are captured and following the user.