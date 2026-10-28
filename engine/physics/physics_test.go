package physics

import (
	"math"
	"testing"
)

func load(i int) *System {
	s := &System{}
	s.Load(&Presets[i])
	return s
}

func TestFigure8EnergyDriftOver1e5Steps(t *testing.T) {
	s := load(0)
	k, u := s.Energy()
	e0 := k + u
	for i := 0; i < 100_000; i++ {
		s.Step()
	}
	k, u = s.Energy()
	if drift := math.Abs((k + u - e0) / e0); drift >= 1e-6 {
		t.Fatalf("|ΔE/E0| = %.3e after 1e5 steps, want < 1e-6", drift)
	}
	px, py := s.Momentum()
	if math.Hypot(px, py) >= 1e-9 {
		t.Fatalf("|P| = %.3e after 1e5 steps, want < 1e-9", math.Hypot(px, py))
	}
}

func TestEveryPresetLoadsWithZeroMomentum(t *testing.T) {
	for i := range Presets {
		s := load(i)
		px, py := s.Momentum()
		if math.Hypot(px, py) > 1e-12 {
			t.Errorf("%s: |P| = %.3e", Presets[i].Name, math.Hypot(px, py))
		}
		var mx, my, m float64
		for j := 0; j < s.Massive; j++ {
			mx += s.M[j] * s.X[j]
			my += s.M[j] * s.Y[j]
			m += s.M[j]
		}
		if math.Hypot(mx/m, my/m) > 1e-12 {
			t.Errorf("%s: centre of mass at (%.3e, %.3e)", Presets[i].Name, mx/m, my/m)
		}
	}
}

func TestFigure8ReturnsAfterOnePeriod(t *testing.T) {
	// Period of the figure-8 orbit (Chenciner and Montgomery): T ≈ 6.3259.
	s := load(0)
	x0, y0 := s.X[0], s.Y[0]
	steps := int(math.Round(6.32591398 / s.Dt))
	for i := 0; i < steps; i++ {
		s.Step()
	}
	if d := math.Hypot(s.X[0]-x0, s.Y[0]-y0); d > 1e-3 {
		t.Fatalf("body 1 is %.3e from its start after one period", d)
	}
}

func TestPeriodicPresetsStayOnScreenForTenMinutes(t *testing.T) {
	// SimSpeed 0.75 → ten minutes of real time is 450 simulation time units.
	for _, i := range []int{0, 2, 5} {
		s := load(i)
		steps := int(450 / s.Dt)
		for k := 0; k < steps; k++ {
			s.Step()
			if k%1000 == 0 && s.MaxRadius() > 1.9 {
				t.Fatalf("%s: a star reached r = %.2f at t = %.1f", Presets[i].Name, s.MaxRadius(), float64(k)*s.Dt)
			}
		}
	}
}

func TestTestParticlesDontChangeTheStars(t *testing.T) {
	a, b := load(4), load(4)
	b.AddParticle(0.3, 0.1, 0, 0.5)
	b.AddParticle(-0.2, 0.4, 0.3, 0)
	for i := 0; i < 2000; i++ {
		a.Step()
		b.Step()
	}
	for i := 0; i < 3; i++ {
		if a.X[i] != b.X[i] || a.Y[i] != b.Y[i] {
			t.Fatalf("star %d moved differently with test particles present", i)
		}
	}
}

func TestRemoveParticleKeepsStars(t *testing.T) {
	s := load(0)
	p := s.AddParticle(1, 1, 0, 0)
	s.AddParticle(2, 2, 0, 0)
	s.RemoveParticle(0)
	if s.N != 5 {
		t.Fatalf("removing a star should be refused, N = %d", s.N)
	}
	s.RemoveParticle(p)
	if s.N != 4 || s.X[3] != 2 {
		t.Fatalf("expected the last particle to fill the slot, got N=%d X[3]=%v", s.N, s.X[3])
	}
}

func TestStepDoesNotAllocate(t *testing.T) {
	s := load(4)
	if n := testing.AllocsPerRun(100, s.Step); n != 0 {
		t.Fatalf("Step allocates %v times per run", n)
	}
}
