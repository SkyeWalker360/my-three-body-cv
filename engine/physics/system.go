// Package physics integrates planar Newtonian gravity for the three-body lab. It is pure Go
// with fixed-size arrays and no allocation after Load, so it runs the same natively (tests,
// baking) and in TinyGo WebAssembly.
package physics

import "math"

// G is the gravitational constant in simulation units.
const G = 1.0

// MaxBodies bounds the system: 3 stars, a planet, and up to 20 supernova fragments fit easily.
const MaxBodies = 64

// System holds the bodies as structure-of-arrays. Bodies [0, Massive) attract everything;
// bodies [Massive, N) are massless test particles (the planet, fragments) that only feel
// gravity, so adding them never changes the stars' orbits or the energy.
type System struct {
	N, Massive int
	M          [MaxBodies]float64
	X, Y       [MaxBodies]float64
	VX, VY     [MaxBodies]float64
	AX, AY     [MaxBodies]float64
	// Eps2 is the squared Plummer softening length; Dt the fixed step.
	Eps2, Dt float64
}

// Accel recomputes every body's acceleration from the massive bodies.
func (s *System) Accel() {
	for i := 0; i < s.N; i++ {
		s.AX[i], s.AY[i] = 0, 0
	}
	for i := 0; i < s.Massive; i++ {
		for j := i + 1; j < s.Massive; j++ {
			dx, dy := s.X[j]-s.X[i], s.Y[j]-s.Y[i]
			d2 := dx*dx + dy*dy + s.Eps2
			inv := G / (d2 * math.Sqrt(d2))
			s.AX[i] += s.M[j] * dx * inv
			s.AY[i] += s.M[j] * dy * inv
			s.AX[j] -= s.M[i] * dx * inv
			s.AY[j] -= s.M[i] * dy * inv
		}
	}
	for i := s.Massive; i < s.N; i++ {
		for j := 0; j < s.Massive; j++ {
			dx, dy := s.X[j]-s.X[i], s.Y[j]-s.Y[i]
			d2 := dx*dx + dy*dy + s.Eps2
			inv := G / (d2 * math.Sqrt(d2))
			s.AX[i] += s.M[j] * dx * inv
			s.AY[i] += s.M[j] * dy * inv
		}
	}
}

// Yoshida (Forest–Ruth) 4th-order coefficients: three force evaluations per step.
var (
	cbrt2 = math.Cbrt(2)
	yw1   = 1 / (2 - cbrt2)
	yw0   = -cbrt2 / (2 - cbrt2)
	yoshC = [4]float64{yw1 / 2, (yw0 + yw1) / 2, (yw0 + yw1) / 2, yw1 / 2}
	yoshD = [3]float64{yw1, yw0, yw1}
)

// Step advances one fixed step with the 4th-order Yoshida symplectic integrator
// (drift-kick-drift-kick-drift-kick-drift).
func (s *System) Step() {
	h := s.Dt
	for k := 0; k < 4; k++ {
		c := yoshC[k] * h
		for i := 0; i < s.N; i++ {
			s.X[i] += c * s.VX[i]
			s.Y[i] += c * s.VY[i]
		}
		if k == 3 {
			break
		}
		s.Accel()
		d := yoshD[k] * h
		for i := 0; i < s.N; i++ {
			s.VX[i] += d * s.AX[i]
			s.VY[i] += d * s.AY[i]
		}
	}
}

// Recenter subtracts the centre-of-mass position and velocity of the massive bodies from every
// body, giving zero net momentum. Called on every preset load and kick.
func (s *System) Recenter() {
	var mass, rx, ry, vx, vy float64
	for i := 0; i < s.Massive; i++ {
		mass += s.M[i]
		rx += s.M[i] * s.X[i]
		ry += s.M[i] * s.Y[i]
		vx += s.M[i] * s.VX[i]
		vy += s.M[i] * s.VY[i]
	}
	if mass == 0 {
		return
	}
	rx, ry, vx, vy = rx/mass, ry/mass, vx/mass, vy/mass
	for i := 0; i < s.N; i++ {
		s.X[i] -= rx
		s.Y[i] -= ry
		s.VX[i] -= vx
		s.VY[i] -= vy
	}
}

// AddParticle appends a massless test particle and returns its index, or -1 when full.
func (s *System) AddParticle(x, y, vx, vy float64) int {
	if s.N >= MaxBodies {
		return -1
	}
	i := s.N
	s.M[i], s.X[i], s.Y[i], s.VX[i], s.VY[i], s.AX[i], s.AY[i] = 0, x, y, vx, vy, 0, 0
	s.N++
	return i
}

// RemoveParticle drops test particle i by moving the last body into its slot. Massive bodies
// can't be removed, so star indices never change.
func (s *System) RemoveParticle(i int) {
	if i < s.Massive || i >= s.N {
		return
	}
	last := s.N - 1
	s.M[i], s.X[i], s.Y[i] = s.M[last], s.X[last], s.Y[last]
	s.VX[i], s.VY[i], s.AX[i], s.AY[i] = s.VX[last], s.VY[last], s.AX[last], s.AY[last]
	s.N--
}

// Energy returns the kinetic and softened potential energy of the massive bodies.
func (s *System) Energy() (kinetic, potential float64) {
	for i := 0; i < s.Massive; i++ {
		kinetic += 0.5 * s.M[i] * (s.VX[i]*s.VX[i] + s.VY[i]*s.VY[i])
		for j := i + 1; j < s.Massive; j++ {
			dx, dy := s.X[j]-s.X[i], s.Y[j]-s.Y[i]
			potential -= G * s.M[i] * s.M[j] / math.Sqrt(dx*dx+dy*dy+s.Eps2)
		}
	}
	return kinetic, potential
}

// Momentum returns the net linear momentum of the massive bodies.
func (s *System) Momentum() (px, py float64) {
	for i := 0; i < s.Massive; i++ {
		px += s.M[i] * s.VX[i]
		py += s.M[i] * s.VY[i]
	}
	return px, py
}

// AngularMomentum returns Lz of the massive bodies about the origin.
func (s *System) AngularMomentum() float64 {
	l := 0.0
	for i := 0; i < s.Massive; i++ {
		l += s.M[i] * (s.X[i]*s.VY[i] - s.Y[i]*s.VX[i])
	}
	return l
}

// MaxRadius is the largest distance of a massive body from the origin.
func (s *System) MaxRadius() float64 {
	r := 0.0
	for i := 0; i < s.Massive; i++ {
		r = math.Max(r, math.Hypot(s.X[i], s.Y[i]))
	}
	return r
}
