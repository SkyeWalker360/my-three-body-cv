// Shared by every act. Included at the top of each act file.
// roll(stat, dc): d20 + party modifier against the DC, true on a pass.
// rollD100Mine(): the Mining Rewards haul. contest(foeBonus, advantage): one tug-of-war pull.
// The runner prints every roll.
EXTERNAL roll(stat, dc)
EXTERNAL rollD100Mine()
EXTERNAL contest(foeBonus, advantage)

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
