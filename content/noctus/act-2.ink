// Adapted from "Sto-Side Quest 1".
INCLUDE _shared.ink

VAR goal = false
VAR pulls_won = 0
VAR sto_pull = false
VAR stage = 0
VAR chose_cav = false
VAR chose_seff = false
VAR chose_ai = false
VAR chose_ness = false
VAR chose_dahlea = false
VAR chose_arzhela = false
VAR chose_anni = false

ACT II: TUG OF WAR FOR STO'S SOUL #heading
-> midnight

=== midnight ===
A scream wakes Sto. When he reaches for his weapons, only the hand axe is there. A howl.
* [Run for the sound (Perception, DC 12)]
    { check("Perception", 12):
        No one else is in the streets. No one else seems to hear it at all.
    - else:
        You run blind through empty streets.
    }
- A werewolf claws at a broken door, and voices scream behind it. Sto cuts it down. Then a voice in his head tells him to stop.
* [Resist the voice (WIS save, DC 16)]
    { check("WIS", 16):
        You shake it off. Two more wolves step out behind you. One howls, and the voice starts to sing.
        { check("WIS", 16):
            You hold, and the wolves fall.
        - else:
            The song pulls you under.
        }
    - else:
        You are stunned. The voice, now singing, tells you to sleep.
    }
- -> inn

=== inn ===
You wake chained to a bed in an inn. On a stool by the door sits a tight-ponytailed Bryda Ginte, reading Pride and Prejudice and Goblins: Rise of the Lich by Stephen Peacock.
She knocks three times. Joyce brings eggs and bacon with what looks like purple salt. They found you in a rampage, she says, and kept an eye on you. Work for them a while: a safe place to sleep, and 500 to 1000gp a job.
The days fall into a formula: chains off at 4am, testing the power glove at Cornwallis, breakfast from Paulie at the Yawning Cow Inn, chains back on at night. Then one night, over cards, Bryda looks up.
"Do you really want to die? Don't you have anything to live for?"
"The strong forget that they are only their strongest when they have support. You can beat that thing, need only ask for help."
-> tavern

=== tavern ===
"Tomorrow we make our move." Bryda comes out dressed as a young half-elf man. In a no-name tavern in the Nobles Ward, a nervous man with bright red curls meets four men in new armour. His name is Ben, and he cleans at the Silver Flame church.
You follow the drop-off: a crate of Wroat-made armour, and two locked chests.
* [Search the first chest (Investigation, DC 15)]
    { check("Investigation", 15):
        You spot the trap, but the lock fights you and the chest goes off anyway.
    - else:
        You pick the lock. The chest explodes.
    }
- Six slips of paper, stacked and glowing. A long ringing, a bright flash, and darkness.
-> vision

=== vision ===
You are in a foreign body, duelling a tall young drow with red eyes and an evil smile. His sword takes the hand that holds the Flame Axe, its runes shining pure blue. As you die you grab the blade, and the runes turn red with vengeance.
The chain follows the axe from wielder to wielder, tragedy after tragedy, until it reaches you.
You wake chained, with Bryda burned and bandaged at your side. The men are dead. The papers were paper bombs: glyphs of explosion, powdered diamonds and all.
"Clearly you can't handle that axe by yourself, so get your shit together, push your pride to the side and ask for help, you thickhead." She tosses you the key.
Ai casts Remove Curse. The curse has grown too strong for the spell, so they begin a ritual.
-> void

=== void ===
You fall back into the void, holding the chain that binds your soul. From the red flame steps Capt. Orion, smirking, five spirits behind him.
"You know not when to give in. Soon we will eat your soul, and once we do I will have my revenge."
What is the Hollowbrand Guild to you?
* [They are here to help me with my goals]
    ~ goal = true
* [They are here to help me protect something dear]
    ~ goal = true
* [They are here to have my back]
    ~ goal = true
* [I don't know yet]
    ~ goal = false
- { goal: Knowing it steadies your grip. You have advantage. }
-> roles

=== roles ===
~ stage = stage + 1
{ stage > 5:
    -> sto_pulls
}
{ stage == 1:The anchor: who do you trust to hold you down?|}{ stage == 2:Who keeps you fighting, and picks you up when you're down?|}{ stage == 3:Who do you trust to fight alongside you and watch your back?|}{ stage == 4:Whose counsel do you trust to keep you on the right path?|}{ stage == 5:Who is someone you care about?|}
+ {not chose_cav} [Cav]
    ~ chose_cav = true
    -> pull
+ {not chose_seff} [Seff]
    ~ chose_seff = true
    -> pull
+ {not chose_ai} [Ai]
    ~ chose_ai = true
    -> pull
+ {not chose_ness} [Ness]
    ~ chose_ness = true
    -> pull
+ {not chose_dahlea} [Dahlea]
    ~ chose_dahlea = true
    -> pull
+ {not chose_arzhela} [Arzhela]
    ~ chose_arzhela = true
    -> pull
+ {not chose_anni} [Anni]
    ~ chose_anni = true
    -> pull

= pull
{ contest(5, false):
    ~ pulls_won = pulls_won + 1
    ~ passes = passes + 1
    The chain slides your way.
- else:
    ~ fails = fails + 1
    A spirit hauls back.
}
-> roles

=== sto_pulls ===
Last pull. It's yours.
* [Pull]
    { contest(5, goal):
        ~ sto_pull = true
        ~ pulls_won = pulls_won + 1
        ~ passes = passes + 1
    - else:
        ~ fails = fails + 1
    }
- -> verdict

=== verdict ===
{ pulls_won > 3 || (pulls_won == 3 && sto_pull):
    The void turns white. Your soul becomes a blue essence, and the Flame Axe appears in your hand with blue runes and a new ability.
    The flame engulfs the spirits. From it comes Orion, larger and misshapen, holding a red axe, leading his ghost knights. Roll initiative.
- else:
    Your soul is pulled into the flame. A demonic Sto steps out. Beat him, and the curse is broken, though the axe gains nothing new.
}
Near the end of the month Bryda finds you at the guild hall, throws you a pouch of 1000gp and says: "Your payment."
-> recap
