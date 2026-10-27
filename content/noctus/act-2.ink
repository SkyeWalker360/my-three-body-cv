// DRAFT SCAFFOLD — structure and DC mechanics only.
// TODO(luke): rewrite the prose from Sto-Side Quest 1 before shipping.
INCLUDE _shared.ink

VAR stage = 0
VAR tug = 0

ACT II: TUG OF WAR FOR STO'S SOUL #heading
-> midnight

=== midnight ===
A scream at midnight. Stoiskur grabs his hand axe and walks the empty streets.
* [Track the scream (Perception, DC 12)]
    { check("Perception", 12):
        You find the werewolf clawing at a family's door and cut it down.
    - else:
        You arrive late, but the axe finds the werewolf all the same.
    }
- A song drifts through the street, heavy with sleep.
* [Resist the psychic song (WIS save, DC 16)]
    { check("WIS", 16):
        You resist long enough to see Bryda Ginte before the song takes you.
    - else:
        The world goes dark.
    }
- -> inn

=== inn ===
You wake chained to a bed in Paulie's Yawning Cow Inn. Bryda Ginte reads nearby.
"The strong forget that they are only their strongest when they have support."
* [Search the trapped chest at the drop-off (Investigation, DC 15)]
    { check("Investigation", 15):
        You spot the trap and see a vision on purpose: Orion forging the axe's red soul-chain.
    - else:
        The trap fires, and a dying vision shows you Orion forging the axe's red soul-chain.
    }
- Ai casts Remove Curse. Orion's spirits pull against you.
-> ideal

=== ideal ===
Declare Sto's core ideal.
* [Loyalty]
* [Freedom]
* [Strength]
- The guild feels it. The chain loosens a little.
~ tug = 1
-> tug_of_war

=== tug_of_war ===
~ stage = stage + 1
{ stage > 6:
    -> verdict
}
Stage {stage} of 6. Which companion holds the line?
+ [The Anchor] -> pull
+ [The Lifter] -> pull
+ [The Vanguard] -> pull
+ [The Counselor] -> pull
+ [The Cared-For] -> pull

= pull
{ check("Spirit", 14):
    ~ tug = tug + 1
    The chain slides your way.
- else:
    ~ tug = tug - 1
    Orion's grip tightens.
}
-> tug_of_war

=== verdict ===
{ tug >= 3:
    The runes on the Flame Axe turn pure blue. Orion's Ghost Knights roll initiative.
- else:
    The runes burn red. Demonic Sto rises.
}
-> recap
