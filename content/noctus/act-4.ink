// Adapted from "Noctus Umbra - Season Four - Into The Pitt". The notes stop before the Pit,
// so the act ends as the party heads for Wroat.
INCLUDE _shared.ink

ACT IV: SUNFLOWER DAY #heading
-> death_day

=== death_day ===
It is Rasneth's death day. He lays out an old copy of The Owlbear Press: "Sunflower Day: Multiple Killed At Sunflower Raceway", Year 284 AoM.
Rasneth, Trevor and Abbigail were investigating the Helianthus family for hiding a vampire during the Masquerade Race Parade. Rasneth still doesn't remember why he jumped in front of the Inkdragon.
-> day_off

=== day_off ===
Captain Bell takes a day off and takes you with her: a rock house, then Eve's Apple.
"Drow, werewolves and now bombings around the city. I thought I left the adventuring life behind."
"I don't remember that raid because I died. Don't remember much but a sword right through the heart."
She presses her Contract-Coin into Cav's hand. Find Trevor.
-> downtime

=== downtime ===
A letter arrives for Jasmine, from a secret admirer: Row = 1 \| Shelf = 1 \| Book = 1.
Cav wakes from a nightmare. "Her emerald green eyes wide open, staring at you, enraged."
A moth lands on Dahlea's sill.
* [Read the omen (Insight, DC 15)]
    { check("Insight", 15):
        A foreboding feeling creeps over you. Something is coming for the guild.
    - else:
        Just a moth. Probably.
    }
- Arzhela shows Nightshadow the city, and Nightshadow climbs the Heatherhaven Wall.
* [Follow her up (Acrobatics, DC 13)]
    { check("Acrobatics", 13):
        You reach the top beside her.
    - else:
        You scrape up the wall well behind her.
    }
- A carriage drawn by four black horses thunders straight at Nightshadow.
* [Pull her clear (DEX save, DC 15)]
    { check("DEX", 15):
        You get her out of the way.
    - else:
        You both go sprawling, bruised but alive.
    }
- -> lotus

=== lotus ===
Lotus Helianthus visits the guild hall to warn you: stay out of Wroat.
Then he leaves for the Lion's Ward police to take the silver books. Captain Bell stands in his way, and he nearly kills her.
* [Make for Wroat]
    Trevor is hunting the head of the Kathros in Wroat's Sewer Deep, the Hub. Into the Pit is still to be written.
- -> recap
