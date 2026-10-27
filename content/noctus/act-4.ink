// DRAFT SCAFFOLD — structure and DC mechanics only.
// TODO(luke): rewrite the prose from your Season 4 notes before shipping.
INCLUDE _shared.ink

ACT IV: SUNFLOWER DAY AND INTO THE PIT #heading
-> guildhall

=== guildhall ===
Year 298 AoM. Rasneth opens Trevor's secret box: an Owlbear Press front page about Sunflower Day.
Jasmine's secret admirer left a book cipher.
* [Row 1, Shelf 1, Book 1]
    ~ passes = passes + 1
    The right book. The message names the Helianthus family.
* [Row 3, Shelf 2, Book 7]
    ~ fails = fails + 1
    A cookbook. You try again and find the right shelf eventually.
- -> library

=== library ===
In the damaged Wizard Tome library, something is wrong.
* [Look closer (Insight, DC 15)]
    { check("Insight", 15):
        A dead moth. Someone was here before you.
    - else:
        You miss the dead moth on the sill.
    }
- -> wall

=== wall ===
A carriage drawn by four black warhorses races toward Nightshadow on the Heatherhaven Wall.
* [Dive for Nightshadow (Acrobatics, DC 13)]
    { check("Acrobatics", 13):
        You roll clear with Nightshadow in your arms.
    - else:
        You both tumble, bruised but alive.
    }
- -> rail

=== rail ===
Lotus Helianthus steals the Silver Books. You board the Lightning Rail for Wroat.
* [Fight the Bagman at the WinBag (Athletics, DC 15)]
    { check("Athletics", 15):
        The Bagman goes over the rail.
    - else:
        The Bagman escapes into the fog.
    }
- The Sewer Deep waits beneath the Masquerade Race Parade.
-> recap
