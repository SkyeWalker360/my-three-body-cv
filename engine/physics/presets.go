package physics

import "math"

// Preset is an initial state for the three stars. The values match
// src/features/three-body/presets.ts exactly; the parity fixture checks they stay in step.
type Preset struct {
	Name, Short string
	M           [3]float64
	X, Y        [3]float64
	VX, VY      [3]float64
	// Chaotic presets reload with a small random perturbation when a star escapes.
	Chaotic bool
	// Dt and Softening override the defaults for orbits with very close passes.
	Dt, Softening float64
}

// Defaults for presets that don't override them.
const (
	DefaultDt        = 1e-3
	DefaultSoftening = 1e-3
)

var f8r = [2]float64{0.97000436, -0.24308753}
var f8v = [2]float64{0.466203685, 0.43236573}

// Li, Li and Liao (2021), arXiv:2007.10184, Table 1: m1 = 0.87, m2 = 0.8, m3 = 1.
const (
	uneqM1 = 0.87
	uneqM2 = 0.8
	uneqX1 = -0.1855174644
	uneqV1 = 2.022154688
	uneqV2 = 0.3968976468
)

// Close pair: a tight binary (1 and 0.8, separation 0.3) orbited by a 0.5 star at 1.4.
const (
	pairM1, pairM2, pairM3 = 1.0, 0.8, 0.5
	pairA, pairD           = 0.3, 1.4
)

func lagrange() (x, y, vx, vy [3]float64) {
	v := math.Sqrt(1 / math.Sqrt(3))
	for k := 0; k < 3; k++ {
		a := math.Pi/2 + float64(k)*2*math.Pi/3
		x[k], y[k] = math.Cos(a), math.Sin(a)
		vx[k], vy[k] = -math.Sin(a)*v, math.Cos(a)*v
	}
	return
}

func closePair() Preset {
	inner := pairM1 + pairM2
	total := inner + pairM3
	vrel := math.Sqrt(inner / pairA)
	// Circular outer orbit: relative speed sqrt(M/d), split so the net momentum is zero.
	vout := math.Sqrt(total / pairD)
	v3 := vout * inner / total
	vin := -vout * pairM3 / total
	return Preset{
		Name: "Close pair", Short: "PAIR",
		M:  [3]float64{pairM1, pairM2, pairM3},
		X:  [3]float64{-pairA * pairM2 / inner, pairA * pairM1 / inner, pairD},
		Y:  [3]float64{0, 0, 0},
		VX: [3]float64{0, 0, 0},
		VY: [3]float64{-vrel*pairM2/inner + vin, vrel*pairM1/inner + vin, v3},
	}
}

// Presets in header order. Index 0 is the default.
var Presets = func() [6]Preset {
	lx, ly, lvx, lvy := lagrange()
	return [6]Preset{
		{
			Name: "Figure-8", Short: "FIG-8",
			M: [3]float64{1, 1, 1},
			X: [3]float64{f8r[0], -f8r[0], 0}, Y: [3]float64{f8r[1], -f8r[1], 0},
			VX: [3]float64{f8v[0], f8v[0], -2 * f8v[0]}, VY: [3]float64{f8v[1], f8v[1], -2 * f8v[1]},
		},
		{Name: "Lagrange triangle", Short: "LAGRANGE", M: [3]float64{1, 1, 1}, X: lx, Y: ly, VX: lvx, VY: lvy},
		{
			Name: "Moth-I", Short: "MOTH-I",
			M: [3]float64{1, 1, 1},
			X: [3]float64{-1, 1, 0}, Y: [3]float64{0, 0, 0},
			VX: [3]float64{0.464445, 0.464445, -0.92889}, VY: [3]float64{0.39606, 0.39606, -0.79212},
		},
		{
			Name: "Unequal-mass periodic", Short: "UNEQUAL",
			M: [3]float64{uneqM1, uneqM2, 1},
			X: [3]float64{uneqX1, 1, 0}, Y: [3]float64{0, 0, 0},
			VX: [3]float64{0, 0, 0},
			VY: [3]float64{uneqV1, uneqV2, -(uneqM1*uneqV1 + uneqM2*uneqV2)},
			Dt: 1e-5, Softening: -1,
		},
		{
			Name: "Trisolaran chaos", Short: "TRISOLARAN",
			M: [3]float64{1.2, 1.0, 0.8},
			X: [3]float64{-0.8, 0.8, 0}, Y: [3]float64{-0.2, 0.1, 0.7},
			VX: [3]float64{0.1, -0.3, 0.2}, VY: [3]float64{0.6, -0.4, -0.2},
			Chaotic: true,
		},
		closePair(),
	}
}()

// Load resets s to the three stars of preset p, re-centred, with accelerations computed.
// Softening -1 means none (the unequal-mass orbit needs exact Newtonian forces).
func (s *System) Load(p *Preset) {
	*s = System{N: 3, Massive: 3}
	for i := 0; i < 3; i++ {
		s.M[i], s.X[i], s.Y[i], s.VX[i], s.VY[i] = p.M[i], p.X[i], p.Y[i], p.VX[i], p.VY[i]
	}
	s.Dt = DefaultDt
	if p.Dt > 0 {
		s.Dt = p.Dt
	}
	eps := DefaultSoftening
	if p.Softening < 0 {
		eps = 0
	} else if p.Softening > 0 {
		eps = p.Softening
	}
	s.Eps2 = eps * eps
	s.Recenter()
	s.Accel()
}
