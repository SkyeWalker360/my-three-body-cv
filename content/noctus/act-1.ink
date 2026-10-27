// DRAFT SCAFFOLD — structure and DC mechanics only.
// TODO(luke): rewrite the prose from your Season 1–2 notes before shipping.
INCLUDE _shared.ink

ACT I: SHADOWS OF HEATHERHAVEN AND THE CRESCENT MINES #heading
-> heatherhaven

=== heatherhaven ===
Six citizens of Heatherhaven are missing. Mayor Robin de Beck asks the Hollowbrand Guild to find them.
* [Decode Jarin Ashglade's ciphered journal (Investigation, DC 15)]
    { check("Investigation", 15):
        His bookmark is the key. The journal points to the Crescent Mountain Mines.
    - else:
        The cipher holds, but a mine token falls from the pages. The Crescent Mines, then.
    }
* [Inspect the necrotic soil at Luinda Rowentree's farm (Perception, DC 12)]
    { check("Perception", 12):
        Drag marks lead from the grapevines toward the Crescent Mountain Mines.
    - else:
        The soil tells you little, but a farmhand saw carts heading for the mines.
    }
- -> tomb

=== tomb ===
Under Bwali Bloodgrip's guidance you enter Mine 4 and the nine-room Giant Tomb. Red and blue gas pods line the walls.
* [Disarm the gas pods (CON save, DC 18)]
    { check("CON", 18):
        You hold your breath and seal every pod.
    - else:
        The gas bursts. You stagger through, burned but alive.
    }
* [Study the giant murals (History, DC 15)]
    { check("History", 15):
        The murals are new. This tomb is a trap built by Capt. Golineth Orren's slavers.
    - else:
        You admire the murals a moment too long, and the trap springs shut.
    }
- -> mine_shift

=== mine_shift ===
Captured, the party is forced into a four-hour mining shift.
* [Swing the pickaxe (Athletics, DC 15)]
    { check("Athletics", 15):
        ~ temp find = rollD100Mine()
        Your haul: {find}.
    - else:
        Your arms give out. The overseer marks you down.
    }
- -> uprising

=== uprising ===
With Zane of the Finders Guild beside you, the slaves are ready to rise.
* [Lead the uprising]
    The chains come off and the Finders Guild walks free.
- -> recap
