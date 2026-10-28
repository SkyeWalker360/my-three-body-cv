// Package stars is a simplified stellar lifecycle from lookup tables, on a sped-up clock:
// main sequence → giant → white dwarf, neutron star or black hole. Not the full Hurley fits.
package stars

import "math"

// Phase is where a star is in its life.
type Phase uint8

const (
	MainSequence Phase = iota
	Giant
	WhiteDwarf
	NeutronStar
	BlackHole
)

// Kind is a row of the lookup table. Masses are for the lifecycle only: the dynamics keep
// each preset's own masses, so ageing a star never breaks a periodic orbit.
type Kind struct {
	Name string
	// SolarMasses picks the remnant; Temperature (K) and Radius (framebuffer pixels) are the
	// main-sequence values.
	SolarMasses, Temperature, Radius float64
	// Giant is the cool, swollen phase before the remnant. Lifetime orders who ages first.
	GiantTemperature, GiantScale float64
	LifetimeGyr                  float64
	Remnant                      Phase
	// Luminosity relative to the Sun on the main sequence, and the factor it reaches by the
	// end of the giant branch. Toned down for the blue giant so its light doesn't swamp the
	// planet from across the system; pixel radii can't stand in for physical ones here.
	Luminosity, GiantLuminosity float64
}

// The three kinds every preset uses. A red dwarf outlives the universe, so it never ages.
var (
	RedDwarf  = Kind{"Red dwarf", 0.3, 2600, 4, 0, 1, 1000, MainSequence, 0.02, 1}
	Sun       = Kind{"Yellow dwarf", 1.0, 5800, 5, 3600, 2.6, 10, WhiteDwarf, 1, 12}
	BlueGiant = Kind{"Blue-white giant", 20, 16000, 6, 3300, 3.2, 0.01, BlackHole, 20, 4}
)

// GiantSeconds is how long (real time) the giant phase lasts before the remnant forms.
const GiantSeconds = 6.0

// Star is one star's visual and lifecycle state.
type Star struct {
	Kind        *Kind
	Phase       Phase
	Temperature float64
	// Radius in framebuffer pixels, including the giant's pulse.
	Radius float64
	// Progress through the giant phase, 0 → 1.
	Progress float64
	// Seed varies the surface noise between stars.
	Seed float64
}

// Reset puts a star back on the main sequence.
func (s *Star) Reset(k *Kind, seed float64) {
	*s = Star{Kind: k, Phase: MainSequence, Temperature: k.Temperature, Radius: k.Radius, Seed: seed}
}

// CanAge reports whether the star still has a later phase to reach.
func (s *Star) CanAge() bool {
	return s.Phase == MainSequence && s.Kind.Remnant != MainSequence
}

// StartGiant moves a main-sequence star onto the giant branch.
func (s *Star) StartGiant() {
	if s.CanAge() {
		s.Phase = Giant
		s.Progress = 0
	}
}

// Update advances the giant phase by realSeconds; simTime drives the pulse. It returns true
// on the step where the giant finishes and the remnant forms.
func (s *Star) Update(realSeconds, simTime float64) bool {
	if s.Phase != Giant {
		return false
	}
	s.Progress = math.Min(1, s.Progress+realSeconds/GiantSeconds)
	k := s.Kind
	s.Temperature = k.Temperature + (k.GiantTemperature-k.Temperature)*s.Progress
	pulse := 1 + 0.1*s.Progress*math.Sin(simTime*5)
	s.Radius = k.Radius * (1 + (k.GiantScale-1)*s.Progress) * pulse
	if s.Progress < 1 {
		return false
	}
	s.Phase = k.Remnant
	switch s.Phase {
	case WhiteDwarf:
		s.Temperature, s.Radius = 25000, 2
	case NeutronStar:
		s.Temperature, s.Radius = 30000, 1.5
	case BlackHole:
		s.Temperature, s.Radius = 0, 5
	}
	return true
}

// Explodes reports whether the remnant forms in a supernova (neutron star or black hole).
func (k *Kind) Explodes() bool {
	return k.Remnant == NeutronStar || k.Remnant == BlackHole
}

// Luminance relative to the Sun's main sequence, from the lookup table: it climbs through the
// giant branch, and remnants are nearly dark.
func (s *Star) Luminance() float64 {
	switch s.Phase {
	case Giant:
		return s.Kind.Luminosity * (1 + (s.Kind.GiantLuminosity-1)*s.Progress)
	case WhiteDwarf:
		return 0.01
	case NeutronStar:
		return 0.001
	case BlackHole:
		return 0
	}
	return s.Kind.Luminosity
}

// helland is Tanner Helland's fit of blackbody colour to temperature, as 0–255 RGB.
func helland(temperature float64) (r, g, b float64) {
	t := temperature / 100
	if t <= 66 {
		r = 255
		g = 99.4708025861*math.Log(t) - 161.1195681661
	} else {
		r = 329.698727446 * math.Pow(t-60, -0.1332047592)
		g = 288.1221695283 * math.Pow(t-60, -0.0755148492)
	}
	switch {
	case t >= 66:
		b = 255
	case t <= 19:
		b = 0
	default:
		b = 138.5177312231*math.Log(t-10) - 305.0447927307
	}
	clamp := func(v float64) float64 { return math.Max(0, math.Min(255, v)) }
	return clamp(r), clamp(g), clamp(b)
}

// Reference temperatures for the six stellar ramp steps (deep red → blue-white).
var stepTemperatures = [6]float64{2400, 3600, 5000, 6600, 10000, 30000}

var stepColours = func() (out [6][3]float64) {
	for i, t := range stepTemperatures {
		out[i][0], out[i][1], out[i][2] = helland(t)
	}
	return
}()

// Class snaps a temperature to the nearest stellar ramp step (0–5) by blackbody colour.
func Class(temperature float64) int {
	r, g, b := helland(temperature)
	best, bestD := 0, math.Inf(1)
	for i, c := range stepColours {
		d := (c[0]-r)*(c[0]-r) + (c[1]-g)*(c[1]-g) + (c[2]-b)*(c[2]-b)
		if d < bestD {
			best, bestD = i, d
		}
	}
	return best
}
