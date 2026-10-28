package sim

// Layout of the state buffer (float64s) the page reads for telemetry. The TypeScript copy in
// src/features/three-body/engine-layout.ts is checked against these by a unit test.
const (
	StateKinetic   = 0
	StatePotential = 1
	StateTotal     = 2
	StateDrift     = 3
	StateGhostGap  = 4
	StateSimTime   = 5
	StateMomentumX = 6
	StateMomentumY = 7
	StateAngular   = 8
	StatePreset    = 9
	StateGhostOn   = 10
	StateEra       = 11
	StateCivil     = 12
	StateLights    = 13
	StateCritical  = 14
	StateBodies    = 15 // how many rows of the bodies buffer are in use
	StateStars     = 16 // per star: kind, phase, temperature, radius, progress, class
	StateStarWidth = 6
	StateLen       = StateStars + 3*StateStarWidth
)

// Layout of the bodies buffer (float64s) the observation deck reads: one row per body in
// the system, stars first (rows 0–2 are always stars 0–2).
const (
	BodyX      = 0
	BodyY      = 1
	BodyVX     = 2
	BodyVY     = 3
	BodyMass   = 4
	BodyKind   = 5 // 0 star, 1 planet, 2 fragment
	BodyExtra  = 6 // star: luminosity in Suns; planet: received light (Sun = 1); fragment: age in s
	BodyWidth  = 7
	BodiesRows = 64 // physics.MaxBodies
	BodiesLen  = BodiesRows * BodyWidth
)

// Event kinds in the event ring.
const (
	EventCollision   = 1 // a, b: the two stars
	EventSupernova   = 2 // a: the star
	EventEngulfment  = 3 // a: the giant, b: the victim (PlanetBody for the planet)
	EventEjection    = 4 // a: the body (PlanetBody for the planet)
	EventGiant       = 5 // a: the star leaving the main sequence
	EventRemnant     = 6 // a: the star, b: its new phase
	EventCriticalOn  = 7
	EventCriticalOff = 8
	EventElectrical  = 9 // the planet's civilisation reached the electrical era
)

// PlanetBody stands for the planet in event arguments (its body index can change).
const PlanetBody = 99

// EventSlots is the ring size. The buffer is int32s: [count, then EventSlots × (seq, kind, a, b)].
const (
	EventSlots  = 32
	EventStride = 4
	EventsLen   = 1 + EventSlots*EventStride
)
