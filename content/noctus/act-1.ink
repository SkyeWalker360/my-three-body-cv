// Adapted from "Noctus Umbra - Season Two - Night Of The Wolves" (the Crescent Mountain tomb).
// The notes set up the slave uprising but never resolve it, so the act ends there.
INCLUDE _shared.ink

VAR haul = 0
VAR exhaustion = 0

ACT I: THE CRESCENT MOUNTAIN TOMB #heading
-> summons

=== summons ===
The Mayor summons the Hollowbrand Guild: "a group of nobodies, a group who not only saved my life but a group who saved this city."
Members of the Finders Guild were sent to a newly found tomb in the mines of the Crescent Mountain that may hold Dragonshards. They never came back. The pay is 1000gp, plus 500gp for each chunk found.
Bwali Bloodgrip of Gold Dragon House explains: the Finders Guild "was sent into a newly discovered Tomb during a cave in mine four." An hour down the pulley elevator, fifteen minutes by mine cart, and you are at the door.
* [Check the entrance for traps (Insight, DC 13)]
    { check("Insight", 13):
        A string runs across the threshold at ankle height. You step over it.
    - else:
        The string snaps under your boot. Somewhere below, the Duergar know you are coming.
    }
- -> lobby

=== lobby ===
Two stone plates press together and the tomb opens onto a lobby of giant murals. Three blue doors carry a Hammer, a Sickle and a Chisel; three red doors a Shield, a Sword and a Bow.
* [Study the murals (History, DC 18)]
    { check("History", 18):
        This tomb was made in this century. It is not an ancient tomb at all.
    - else:
        Giants, battles, a lost age. Nothing rings any bells.
    }
* [Watch the shadows (Perception, DC 18)]
    { check("Perception", 18):
        You feel like giants are looking at you. The eyes in the murals have been cut through.
    - else:
        You feel like you are being watched, and can't say by whom.
    }
- -> red_shield

=== red_shield ===
Behind the Shield door, platforms jut out over a pit of snakes.
* [Leap the platforms (Acrobatics, DC 15)]
    { check("Acrobatics", 15):
        You land on each one without an issue.
    - else:
        Your foot slides off the edge.
        { check("DEX", 18):
            You grab the platform and haul yourself up.
        - else:
            You drop among the snakes and claw your way out, bitten and furious.
        }
    }
- -> gas_pods

=== gas_pods ===
In the Bow chamber every hand must press the same button. The colour you choose is the chamber that floods with gas, and the door opens.
* [Press red together and hold your breath (CON save, DC 18)]
    { check("CON", 18):
        Half the damage and none of the poison. The door grinds open.
    - else:
        4d10 of poison and an hour of retching. The door opens all the same.
    }
- Beyond the Blue door, a stone sink asks for a blood sacrifice of about 30 hit points. A flask of any liquid does the job.
-> room_nine

=== room_nine ===
In Room Nine the floor drops beneath you.
You land in a Dark Elf Mining Camp: Capt. Golineth Orren's house, sixty slaves, and an enforcer called SIX. Over the gate, carved in stone: "May our Mother reigns be eternal."
The Finders Guild are here. Thomas has lost his right hand. Kevin and Yosston are in Slave Pit One. Zane is in Slave Pit Two; they cut out his tongue.
-> shift

=== shift ===
Sixteen hours in the mines: three four-hour sessions with two one-hour breaks.
-> session(1)

= session(n)
{ n > 3:
    -> uprising
}
{ n == 1:Early morning.|}{ n == 2:Afternoon.|}{ n == 3:Late noon.|}
+ [Swing the pick (Athletics, DC 15)]
    { check("Athletics", 15):
        ~ temp find = rollD100Mine()
        ~ haul = haul + 1
        You haul out {find}.
    - else:
        Your arms give out.
        { roll("CON", 6 + n * 4):
            You keep your feet.
        - else:
            ~ exhaustion = exhaustion + 1
            You gain a point of exhaustion.
        }
    }
    -> session(n + 1)

=== uprising ===
Zane can't speak, but he can make the slaves believe again. "With his help the group can cause an uprising by giving the people here confidence."
{ exhaustion > 0:You carry {exhaustion} {exhaustion == 1:point|points} of exhaustion into the night.}
* [Give Zane the signal]
    The pits stir. Sixty slaves look to the Hollowbrand Guild. The uprising begins next session.
- -> recap
