// Package sim is the whole lab: three stars on a physics.System, their lifecycles, a
// planet, supernova fragments, the chaos ghost, trails, events and the renderer. It holds
// fixed-size arrays only, so a World can live in a global in TinyGo WebAssembly.
package sim

import (
	"math"

	"github.com/SkyeWalker360/my-three-body-cv/engine/physics"
	"github.com/SkyeWalker360/my-three-body-cv/engine/raster"
	"github.com/SkyeWalker360/my-three-body-cv/engine/rng"
	"github.com/SkyeWalker360/my-three-body-cv/engine/stars"
)

const (
	// SimSpeed is simulation time per real second, as in the TypeScript lab.
	SimSpeed = 0.75
	// MaxStepsPerFrame caps a long stall; fine-step presets get a higher cap.
	MaxStepsPerFrame = 50
	KickDV           = 0.075
	GhostDelta       = 1e-7
	// VisibleRadius is the world distance from the centre to the nearest frame edge.
	VisibleRadius = 2.0
	EscapeRadius  = 1.9
	TrailLength   = 80
	// The star radii in the stars package are for this many pixels per world unit
	// (a 270-pixel-high frame).
	referenceScale = 270 / (2 * VisibleRadius)

	planetOrbit     = 0.22
	planetRadius    = 3.5
	planetEscape    = 2.6
	planetRespawn   = 4.0 // real seconds
	electricalAfter = 20.0
	fragmentCount   = 16
	fragmentLife    = 40.0
	shellEvery      = 1.1
	shellLife       = 3.5
	shockLife       = 2.4
	collideCooldown = 2.0
)

type bodyKind uint8

const (
	kindStar bodyKind = iota
	kindPlanet
	kindFragment
)

type shell struct {
	star int
	born float64
	tone uint8
}

type shock struct{ x, y, born float64 }

// World is the lab's complete state.
type World struct {
	Sys, Ghost physics.System
	GhostOn    bool
	Stars      [3]stars.Star
	Preset     int
	rand       rng.PCG32
	seed       uint64
	e0         float64
	acc        float64
	SimTime    float64
	RealTime   float64

	kind   [physics.MaxBodies]bodyKind
	born   [physics.MaxBodies]float64
	tone   [physics.MaxBodies]uint8
	planet int // body index, or -1

	planetHost   int
	respawnAt    float64
	flux         float64
	Era          raster.Era
	Civilisation float64
	Lights       bool

	trails     [3][TrailLength][2]float64
	trailHead  int
	trailCount int

	shells     [8]shell
	shellCount int
	lastShell  [3]float64
	shocks     [4]shock
	shockCount int
	flash      int

	Critical    bool
	criticalOff float64
	lastCollide float64
	engulfed    [3][3]bool

	Frame raster.Frame
	bg    [raster.MaxPixels]uint8

	State  [StateLen]float64
	Bodies [BodiesLen]float64
	Events [EventsLen]int32
}

// Kinds per preset, by star index. K.A.R.L.'s host is the blue-white giant.
var presetKinds = [len(physics.Presets)][3]*stars.Kind{
	{&stars.RedDwarf, &stars.Sun, &stars.BlueGiant},
	{&stars.RedDwarf, &stars.Sun, &stars.BlueGiant},
	{&stars.RedDwarf, &stars.Sun, &stars.BlueGiant},
	{&stars.RedDwarf, &stars.Sun, &stars.BlueGiant},
	{&stars.RedDwarf, &stars.Sun, &stars.BlueGiant},
	// Close pair: the binary is the blue giant and the red dwarf; the distant Sun keeps the planet.
	{&stars.BlueGiant, &stars.RedDwarf, &stars.Sun},
}

// Init resets the world from a seed and a preset index.
func (w *World) Init(seed uint64, preset int) {
	if preset < 0 || preset >= len(physics.Presets) {
		preset = 0
	}
	w.seed = seed
	w.rand = rng.New(seed)
	w.Preset = preset
	for i := range w.Stars {
		w.Stars[i].Reset(presetKinds[preset][i], float64(11+i*17))
	}
	w.Events[0] = 0
	w.Critical = false
	w.Civilisation, w.Lights, w.Era = 0, false, raster.EraNone
	w.load(0)
	if w.Frame.W == 0 {
		w.Resize(480, 270)
	}
	w.updateState()
}

// load puts the stars back at the preset's start (perturbed by up to perturb per axis) and
// clears particles, trails and effects. Star lifecycles survive a reload.
func (w *World) load(perturb float64) {
	p := &physics.Presets[w.Preset]
	w.Sys.Load(p)
	if perturb > 0 {
		for i := 0; i < 3; i++ {
			w.Sys.VX[i] += w.rand.Signed() * perturb
			w.Sys.VY[i] += w.rand.Signed() * perturb
		}
		w.Sys.Recenter()
		w.Sys.Accel()
	}
	for i := 0; i < 3; i++ {
		w.kind[i] = kindStar
	}
	k, u := w.Sys.Energy()
	w.e0 = k + u
	w.acc, w.SimTime = 0, 0
	w.trailHead, w.trailCount = 0, 0
	w.shellCount, w.shockCount, w.flash = 0, 0, 0
	w.planet = -1
	w.respawnAt = w.RealTime
	w.spawnPlanet()
	if w.GhostOn {
		w.spawnGhost()
	}
}

// Resize sets the framebuffer size and rebuilds the starfield.
func (w *World) Resize(width, height int) bool {
	if !w.Frame.Resize(width, height) {
		return false
	}
	w.Frame.Starfield(318)
	copy(w.bg[:width*height], w.Frame.Pix[:width*height])
	return true
}

// SetGhost turns the chaos ghost on or off.
func (w *World) SetGhost(on bool) {
	w.GhostOn = on
	if on {
		w.spawnGhost()
	}
	w.updateState()
}

func (w *World) spawnGhost() {
	w.Ghost = physics.System{N: 3, Massive: 3, Eps2: w.Sys.Eps2, Dt: w.Sys.Dt}
	for i := 0; i < 3; i++ {
		w.Ghost.M[i], w.Ghost.X[i], w.Ghost.Y[i] = w.Sys.M[i], w.Sys.X[i], w.Sys.Y[i]
		w.Ghost.VX[i], w.Ghost.VY[i] = w.Sys.VX[i], w.Sys.VY[i]
	}
	w.Ghost.X[0] += GhostDelta
	w.Ghost.Accel()
}

// Kick adds (dvx, dvy) to one star, or a seeded random Δv of up to ±KickDV per axis to every
// star when body < 0, then re-centres.
func (w *World) Kick(body int, dvx, dvy float64) {
	if body < 0 {
		for i := 0; i < 3; i++ {
			w.Sys.VX[i] += w.rand.Signed() * KickDV
			w.Sys.VY[i] += w.rand.Signed() * KickDV
		}
	} else if body < 3 {
		w.Sys.VX[body] += dvx
		w.Sys.VY[body] += dvy
	}
	w.Sys.Recenter()
	w.Sys.Accel()
	k, u := w.Sys.Energy()
	w.e0 = k + u
	if w.GhostOn {
		w.spawnGhost()
	}
	w.updateState()
}

// Age sends the shortest-lived main-sequence star that can still evolve onto the giant
// branch. It returns that star's index, or -1 if none can age.
func (w *World) Age() int {
	best := -1
	for i := range w.Stars {
		s := &w.Stars[i]
		if s.CanAge() && (best < 0 || s.Kind.LifetimeGyr < w.Stars[best].Kind.LifetimeGyr) {
			best = i
		}
	}
	if best < 0 {
		return -1
	}
	w.Stars[best].StartGiant()
	w.lastShell[best] = w.RealTime
	w.engulfed[best] = [3]bool{}
	w.emit(EventGiant, best, 0)
	if !w.Critical {
		w.Critical = true
		w.emit(EventCriticalOn, best, 0)
	}
	w.criticalOff = math.Inf(1)
	w.updateState()
	return best
}

// Advance runs as many fixed steps as ms of real time needs (capped at 100 ms per call), so
// speed is the same at any refresh rate, then updates lifecycles, the planet and events.
func (w *World) Advance(ms float64) {
	real := math.Min(math.Max(ms, 0), 100) / 1000
	w.RealTime += real
	w.acc += real * SimSpeed
	dt := w.Sys.Dt
	limit := int(math.Max(MaxStepsPerFrame, math.Ceil(SimSpeed*0.1/dt)))
	steps := 0
	for w.acc >= dt && steps < limit {
		w.Sys.Step()
		if w.GhostOn {
			w.Ghost.Step()
		}
		w.acc -= dt
		w.SimTime += dt
		steps++
	}
	if steps == limit {
		w.acc = 0
	}
	w.updateStars(real)
	w.checkStars()
	w.updatePlanet(real)
	w.updateFragments()
	w.recordTrail()
	if w.Critical && w.RealTime >= w.criticalOff {
		w.Critical = false
		w.emit(EventCriticalOff, 0, 0)
	}
	if w.flash > 0 {
		w.flash--
	}
	w.updateState()
}

func (w *World) updateStars(real float64) {
	for i := range w.Stars {
		s := &w.Stars[i]
		if s.Phase == stars.Giant && w.RealTime-w.lastShell[i] > shellEvery {
			w.lastShell[i] = w.RealTime
			w.addShell(i, raster.StellarTones[stars.Class(s.Temperature)][3])
		}
		if !s.Update(real, w.SimTime) {
			continue
		}
		w.emit(EventRemnant, i, int(s.Phase))
		if s.Kind.Explodes() {
			w.supernova(i)
			w.criticalOff = w.RealTime + 3
		} else {
			w.criticalOff = w.RealTime + 1.5
		}
	}
}

func (w *World) supernova(i int) {
	w.emit(EventSupernova, i, 0)
	if !w.Critical {
		w.Critical = true
		w.emit(EventCriticalOn, i, 0)
	}
	w.flash = 10
	w.shellCount = 0
	if w.shockCount < len(w.shocks) {
		w.shocks[w.shockCount] = shock{w.Sys.X[i], w.Sys.Y[i], w.SimTime}
		w.shockCount++
	}
	for k := 0; k < fragmentCount; k++ {
		a := (float64(k)/fragmentCount)*2*math.Pi + w.rand.Float()*0.3
		v := 0.5 + w.rand.Float()*0.7
		b := w.Sys.AddParticle(w.Sys.X[i], w.Sys.Y[i], w.Sys.VX[i]+math.Cos(a)*v, w.Sys.VY[i]+math.Sin(a)*v)
		if b < 0 {
			break
		}
		w.kind[b], w.born[b] = kindFragment, w.SimTime
		w.tone[b] = raster.GoldRamp
		if w.rand.Float() < 0.5 {
			w.tone[b] = raster.RedRamp
		}
	}
}

// checkStars handles escapes, collisions and giants swallowing their neighbours.
func (w *World) checkStars() {
	if r := w.Sys.MaxRadius(); r >= EscapeRadius {
		far := 0
		for i := 1; i < 3; i++ {
			if math.Hypot(w.Sys.X[i], w.Sys.Y[i]) > math.Hypot(w.Sys.X[far], w.Sys.Y[far]) {
				far = i
			}
		}
		w.emit(EventEjection, far, 0)
		// Chaotic systems get a fresh, slightly different run; others restart cleanly.
		perturb := 0.0
		if physics.Presets[w.Preset].Chaotic {
			perturb = 0.02
		}
		w.load(perturb)
		return
	}
	scale := w.scale()
	for i := 0; i < 3; i++ {
		for j := i + 1; j < 3; j++ {
			d := math.Hypot(w.Sys.X[i]-w.Sys.X[j], w.Sys.Y[i]-w.Sys.Y[j]) * scale
			ri, rj := w.radiusPx(i, scale), w.radiusPx(j, scale)
			if w.Stars[i].Phase == stars.Giant || w.Stars[j].Phase == stars.Giant {
				g, v := i, j
				if w.Stars[j].Phase == stars.Giant {
					g, v = j, i
				}
				if d < w.radiusPx(g, scale) && !w.engulfed[g][v] {
					w.engulfed[g][v] = true
					w.emit(EventEngulfment, g, v)
				}
			} else if d < (ri+rj)*0.8 && w.RealTime-w.lastCollide > collideCooldown {
				w.lastCollide = w.RealTime
				w.emit(EventCollision, i, j)
			}
		}
	}
}

// spawnPlanet puts the planet on a circular orbit around the brightest living star.
func (w *World) spawnPlanet() {
	host, best := -1, 0.0
	for i := range w.Stars {
		if l := w.Stars[i].Luminance(); w.Stars[i].Phase != stars.Giant && l > best && w.Stars[i].Kind != &stars.BlueGiant {
			host, best = i, l
		}
	}
	if host < 0 {
		return
	}
	a := w.rand.Float() * 2 * math.Pi
	v := math.Sqrt(w.Sys.M[host] / planetOrbit)
	x, y := w.Sys.X[host]+math.Cos(a)*planetOrbit, w.Sys.Y[host]+math.Sin(a)*planetOrbit
	b := w.Sys.AddParticle(x, y, w.Sys.VX[host]-math.Sin(a)*v, w.Sys.VY[host]+math.Cos(a)*v)
	if b < 0 {
		return
	}
	w.kind[b], w.born[b] = kindPlanet, w.SimTime
	w.planet, w.planetHost = b, host
	w.flux = 1
}

func (w *World) loseplanet(event, by int) {
	w.emit(event, by, PlanetBody)
	w.removeBody(w.planet)
	w.planet = -1
	w.respawnAt = w.RealTime + planetRespawn
	w.Civilisation, w.Lights, w.Era = 0, false, raster.EraNone
}

func (w *World) updatePlanet(real float64) {
	if w.planet < 0 {
		if w.RealTime >= w.respawnAt {
			w.spawnPlanet()
		}
		return
	}
	p := w.planet
	px, py := w.Sys.X[p], w.Sys.Y[p]
	if math.Hypot(px, py) > planetEscape {
		w.loseplanet(EventEjection, PlanetBody)
		return
	}
	scale := w.scale()
	flux := 0.0
	for i := range w.Stars {
		d := math.Hypot(w.Sys.X[i]-px, w.Sys.Y[i]-py)
		if d*scale < w.radiusPx(i, scale) && w.Stars[i].Phase != stars.BlackHole {
			w.loseplanet(EventEngulfment, i)
			return
		}
		flux += w.Stars[i].Luminance() / math.Max(d*d, 1e-4)
	}
	// Normalise so the Sun alone at the spawn orbit gives 1, then smooth over ~1 s.
	flux *= planetOrbit * planetOrbit
	w.flux += (flux - w.flux) * math.Min(1, real*1.5)
	switch {
	case w.flux > 3:
		w.Era = raster.EraScorched
	case w.flux < 0.3:
		w.Era = raster.EraFrozen
	default:
		w.Era = raster.EraStable
		w.Civilisation += real
		if !w.Lights && w.Civilisation >= electricalAfter {
			w.Lights = true
			w.emit(EventElectrical, 0, 0)
		}
	}
}

func (w *World) updateFragments() {
	for b := w.Sys.N - 1; b >= 3; b-- {
		if w.kind[b] != kindFragment {
			continue
		}
		if w.SimTime-w.born[b] > fragmentLife || math.Hypot(w.Sys.X[b], w.Sys.Y[b]) > 3 {
			w.removeBody(b)
		}
	}
}

// removeBody drops a test particle; the last body moves into its slot, metadata with it.
func (w *World) removeBody(b int) {
	last := w.Sys.N - 1
	if b < 3 || b > last {
		return
	}
	w.Sys.RemoveParticle(b)
	w.kind[b], w.born[b], w.tone[b] = w.kind[last], w.born[last], w.tone[last]
	if w.planet == last {
		w.planet = b
	}
}

func (w *World) addShell(star int, tone uint8) {
	if w.shellCount == len(w.shells) {
		copy(w.shells[:], w.shells[1:])
		w.shellCount--
	}
	w.shells[w.shellCount] = shell{star, w.RealTime, tone}
	w.shellCount++
}

func (w *World) recordTrail() {
	for i := 0; i < 3; i++ {
		w.trails[i][w.trailHead] = [2]float64{w.Sys.X[i], w.Sys.Y[i]}
	}
	w.trailHead = (w.trailHead + 1) % TrailLength
	if w.trailCount < TrailLength {
		w.trailCount++
	}
}

func (w *World) emit(kind, a, b int) {
	seq := w.Events[0] + 1
	w.Events[0] = seq
	o := 1 + int((seq-1)%EventSlots)*EventStride
	w.Events[o], w.Events[o+1], w.Events[o+2], w.Events[o+3] = seq, int32(kind), int32(a), int32(b)
}

func (w *World) scale() float64 {
	return float64(min(w.Frame.W, w.Frame.H)) / (2 * VisibleRadius)
}

func (w *World) radiusPx(i int, scale float64) float64 {
	return w.Stars[i].Radius * scale / referenceScale
}

// GhostGap is the distance between star 1 and its ghost.
func (w *World) GhostGap() float64 {
	if !w.GhostOn {
		return 0
	}
	return math.Hypot(w.Ghost.X[0]-w.Sys.X[0], w.Ghost.Y[0]-w.Sys.Y[0])
}

func (w *World) updateState() {
	k, u := w.Sys.Energy()
	px, py := w.Sys.Momentum()
	s := &w.State
	s[StateKinetic], s[StatePotential], s[StateTotal] = k, u, k+u
	s[StateDrift] = math.Abs((k + u - w.e0) / w.e0)
	s[StateGhostGap] = w.GhostGap()
	s[StateSimTime] = w.SimTime
	s[StateMomentumX], s[StateMomentumY] = px, py
	s[StateAngular] = w.Sys.AngularMomentum()
	s[StatePreset] = float64(w.Preset)
	s[StateGhostOn] = b2f(w.GhostOn)
	s[StateEra] = float64(w.Era)
	s[StateCivil] = w.Civilisation
	s[StateLights] = b2f(w.Lights)
	s[StateCritical] = b2f(w.Critical)
	for i := range w.Stars {
		st := &w.Stars[i]
		o := StateStars + i*StateStarWidth
		kind := 0.0
		switch st.Kind {
		case &stars.Sun:
			kind = 1
		case &stars.BlueGiant:
			kind = 2
		}
		s[o], s[o+1], s[o+2], s[o+3], s[o+4] = kind, float64(st.Phase), st.Temperature, st.Radius, st.Progress
		s[o+5] = float64(stars.Class(math.Max(st.Temperature, 1000)))
	}
	w.updateBodies()
}

// updateBodies copies positions, velocities and per-kind extras into the bodies buffer.
func (w *World) updateBodies() {
	n := w.Sys.N
	w.State[StateBodies] = float64(n)
	for i := 0; i < n; i++ {
		row := w.Bodies[i*BodyWidth : (i+1)*BodyWidth]
		row[BodyX], row[BodyY] = w.Sys.X[i], w.Sys.Y[i]
		row[BodyVX], row[BodyVY] = w.Sys.VX[i], w.Sys.VY[i]
		row[BodyMass] = w.Sys.M[i]
		row[BodyKind] = float64(w.kind[i])
		switch w.kind[i] {
		case kindStar:
			row[BodyExtra] = w.Stars[i].Luminance()
		case kindPlanet:
			row[BodyExtra] = w.flux
		default:
			row[BodyExtra] = w.RealTime - w.born[i]
		}
	}
}

func b2f(b bool) float64 {
	if b {
		return 1
	}
	return 0
}
