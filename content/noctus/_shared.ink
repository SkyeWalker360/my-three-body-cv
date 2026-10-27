// Shared by every act. Included at the top of each act file.
// roll(stat, dc) rolls d20 + modifier against the DC and returns true on a pass;
// the runner prints the roll. rollD100Mine() returns the mine-shift haul.
EXTERNAL roll(stat, dc)
EXTERNAL rollD100Mine()

VAR passes = 0
VAR fails = 0

=== function check(stat, dc) ===
~ temp ok = roll(stat, dc)
{ ok:
    ~ passes = passes + 1
- else:
    ~ fails = fails + 1
}
~ return ok

=== recap ===
Recap: {passes} {passes == 1:check|checks} passed, {fails} failed.
-> END
