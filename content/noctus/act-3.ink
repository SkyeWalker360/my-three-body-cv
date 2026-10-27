// DRAFT SCAFFOLD — structure and DC mechanics only.
// TODO(luke): rewrite the prose from your Season 3 notes before shipping.
INCLUDE _shared.ink

VAR round_dc = 10
VAR charges = 0
VAR misses = 0

ACT III: THE MOTHER'S MIRROR AND THE FEYWILD FISSURE #heading
-> fort

=== fort ===
Past Fort Jaegar, a dire troll's cave waits.
* [Search the cave (Perception, DC 12)]
    { check("Perception", 12):
        You recover three broken sets of ODM gear.
    - else:
        You leave with nothing but the smell.
    }
- At the Changeling Village Tree, First Brother Qin bars the elevator.
* [Answer truthfully in the Zone of Truth (CHA, DC 16)]
    { check("CHA", 16):
        Qin nods. Elder Golding will see you.
    - else:
        Qin hesitates, then lets you pass under watch.
    }
- -> mirror

=== mirror ===
Cavalier enters the humid chamber of The Mother's Mirror. Water rises with every round.
-> rising

= rising
{ round_dc > 14:
    -> pool
}
+ [Hold on (CON save, DC {round_dc})]
    { check("CON", round_dc):
        You hold.
    - else:
        You choke, but hold.
    }
    ~ round_dc = round_dc + 2
    -> rising

= pool
* [Dive into the deep blue pool (WIS save, DC 16)]
    { check("WIS", 16):
        Two reflections ask in unison, "What do we want?" You answer, and your true face returns.
    - else:
        The reflections fade, unanswered, but you surface.
    }
- -> dreadnought

=== dreadnought ===
A Plane Shift machine drags you into an Astral Dreadnought's demiplane. Four small Dragonshards must be charged in one round: three successes before two failures.
-> charge

= charge
{ charges >= 3:
    -> escaped
}
{ misses >= 2:
    -> stranded
}
+ [Charge a Dragonshard with a 3rd-level slot (Arcana, DC 14)]
    { check("Arcana", 14):
        ~ charges = charges + 1
        The shard hums. {charges} of 3.
    - else:
        ~ misses = misses + 1
        The shard sputters. {misses} of 2 failures.
    }
    -> charge

=== escaped ===
The teleporter tears you back to Callian, where you slay the Sibriex.
-> recap

=== stranded ===
The teleporter fails. Cavalier and Seff roll to see who loses a loved one before you claw your way back to Callian.
-> recap
