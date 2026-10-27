// Adapted from "Noctus Umbra - Season Three - Family Duty Crimson".
INCLUDE _shared.ink

VAR round_dc = 10
VAR charges = 0
VAR misses = 0

ACT III: THE MOTHER'S MIRROR AND THE FEYWILD FISSURE #heading
-> fort

=== fort ===
At Fort Yeagar, Zane Boulderdown and Staff Sergeant Ulric Glorybluff send you into the Wildlands, toward the changeling Village Tree.
* [Watch the road (Perception, DC 12)]
    { check("Perception", 12):
        You notice the arm, and the dire troll beside it, before it notices you. The broken ODM gear is yours.
    - else:
        The dire troll jumps you.
    }
- At the tree, Qin and the twins Mars and Tairs cast zone of truth on the party.
* [Answer truthfully (CHA save, DC 16)]
    { check("CHA", 16):
        You choose your words, and they are all true.
    - else:
        The truth spills out.
    }
- "Are you the group Noctus Umbra?" Elder Golding takes you in.
-> mirror

=== mirror ===
Beneath the Changeling Temple, water drips from the Mother's Heart Crystal into a pool: the Mother's Mirror. Cav steps in and the room grows humid.
-> rising

= rising
{ round_dc > 14:
    -> reflections
}
+ [Endure (CON save, DC {round_dc})]
    { check("CON", round_dc):
        You hold.
    - else:
        The pool beckons.
    }
    ~ round_dc = round_dc + 2
    -> rising

= reflections
Two reflections rise from the water: Cav as a frightened young boy, and Cav as a stern grey changeling.
"We want to go home, this place, look at what it's done to us."
"We have been concentrating for far too long on what we are but not who we are. Who are we?"
Together: "What do we want?"
* [Face them (WIS save, DC 16)]
    { check("WIS", 16):
        You blink, and your reflection is gone. You pass out. Twelve hours later, you wake with your real face.
    - else:
        The reflections fade, unanswered, and you surface.
    }
- -> feywild

=== feywild ===
A fissure into the Feywild opens. You save a firbolg father and son, and in the Fey city Cav learns that Kassey is missing. He finds her diary.
Demons, a dark fog over Ywain, a Nabassu. In the Grand Hall the trail leads to Keaya.
* [Press for news of Keaya (Persuasion, DC 18)]
    { check("Persuasion", 18):
        "The root of the corruption is in Callian."
    - else:
        Nobody will talk, but every road points to Callian.
    }
- -> callian

=== callian ===
Callian is sealed behind a wall of force. You break through, find Kassey sheltering beneath a temple, and Ness frees the Sword Wraith Commander, who drops the Sworn Pactbreaker.
At the top of the tower, past a Wastrilith, a Plane Shift machine hums. It drags you toward an Astral Dreadnought. "They are not meant to beat it. Run."
Three successes before two failures, all in a single round: power the small Dragonshards with third-level spell slots.
-> teleporter

= teleporter
{ charges >= 3:
    -> escaped
}
{ misses >= 2:
    -> lost
}
+ [Pour a third-level slot into a Dragonshard (Arcana, DC 15)]
    { check("Arcana", 15):
        ~ charges = charges + 1
        The shard flares. {charges} of 3.
    - else:
        ~ misses = misses + 1
        The shard sputters. {misses} of 2 failures.
    }
    -> teleporter

=== escaped ===
The machine tears you back to Callian, ahead of the Dreadnought's jaws. The Sibriex waits. You end it.
-> recap

=== lost ===
The machine fails. Seff and Cav each roll a d20, and whoever rolls lowest loses a loved one to the astral sea. You claw your way back to Callian and end the Sibriex.
-> recap
