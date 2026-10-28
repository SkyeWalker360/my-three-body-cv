package sim

import (
	"crypto/sha256"
	"testing"

	"github.com/SkyeWalker360/my-three-body-cv/engine/raster"
	"github.com/SkyeWalker360/my-three-body-cv/engine/stars"
)

func run(seed uint64, preset int, frames int) *World {
	w := &World{}
	w.Init(seed, preset)
	w.SetGhost(true)
	for i := 0; i < frames; i++ {
		if i == 30 {
			w.Kick(-1, 0, 0)
		}
		if i == 60 {
			w.Age()
		}
		w.Advance(1000.0 / 60)
		w.Render()
	}
	return w
}

func digest(w *World) [32]byte {
	return sha256.Sum256(w.Frame.Pix[:w.Frame.W*w.Frame.H])
}

func TestSameSeedGivesByteIdenticalFrames(t *testing.T) {
	a, b := run(318, 4, 600), run(318, 4, 600)
	if digest(a) != digest(b) {
		t.Fatal("two runs with the same seed drew different frames")
	}
	c := run(319, 4, 600)
	if digest(a) == digest(c) {
		t.Fatal("a different seed drew the same frame")
	}
}

func TestEveryPixelIsAPaletteIndex(t *testing.T) {
	for preset := 0; preset < 6; preset++ {
		w := run(7, preset, 900)
		for i, c := range w.Frame.Pix[:w.Frame.W*w.Frame.H] {
			if c >= raster.Count {
				t.Fatalf("preset %d: pixel %d has index %d, outside the palette", preset, i, c)
			}
		}
	}
}

func TestBlueGiantGoesSupernovaAndLeavesABlackHole(t *testing.T) {
	w := &World{}
	w.Init(1, 0)
	if got := w.Age(); got != 2 {
		t.Fatalf("Age picked star %d, want the blue-white giant (2)", got)
	}
	seen := map[int32]bool{}
	var last int32
	for i := 0; i < 60*12; i++ {
		w.Advance(1000.0 / 60)
		for last < w.Events[0] {
			last++
			o := 1 + int((last-1)%EventSlots)*EventStride
			seen[w.Events[o+1]] = true
		}
	}
	for _, k := range []int32{EventGiant, EventCriticalOn, EventSupernova, EventRemnant, EventCriticalOff} {
		if !seen[k] {
			t.Errorf("missing event kind %d", k)
		}
	}
	if w.Stars[2].Phase != stars.BlackHole {
		t.Fatalf("star 2 phase %d, want black hole", w.Stars[2].Phase)
	}
	if w.Critical {
		t.Fatal("still critical after the supernova settled")
	}
}

func TestAgeingOrderAndRedDwarf(t *testing.T) {
	w := &World{}
	w.Init(1, 0)
	if w.Age() != 2 || w.Age() != 1 || w.Age() != -1 {
		t.Fatal("expected the blue giant, then the sun, then nothing (red dwarfs don't age)")
	}
}

func TestPlanetSpawnsAroundALivingStar(t *testing.T) {
	w := &World{}
	w.Init(5, 0)
	if w.planet < 3 || w.kind[w.planet] != kindPlanet {
		t.Fatalf("no planet after Init (index %d)", w.planet)
	}
	if w.Stars[w.planetHost].Kind != &stars.Sun {
		t.Fatalf("planet host is %s, want the sun", w.Stars[w.planetHost].Kind.Name)
	}
}

func TestStarsStayOnScreenForTenMinutesOnFigure8(t *testing.T) {
	w := &World{}
	w.Init(1, 0)
	for i := 0; i < 60*600; i++ {
		w.Advance(1000.0 / 60)
		if w.Sys.MaxRadius() > EscapeRadius {
			t.Fatalf("a star left the screen at frame %d", i)
		}
	}
}

func TestSpeedIsTheSameAt60And120Hz(t *testing.T) {
	a, b := &World{}, &World{}
	a.Init(1, 0)
	b.Init(1, 0)
	for i := 0; i < 600; i++ {
		a.Advance(1000.0 / 60)
	}
	for i := 0; i < 1200; i++ {
		b.Advance(1000.0 / 120)
	}
	if d := a.SimTime - b.SimTime; d > 2e-3 || d < -2e-3 {
		t.Fatalf("10 s at 60 Hz reached t = %.4f, at 120 Hz t = %.4f", a.SimTime, b.SimTime)
	}
}

func TestAdvanceAndRenderDontAllocate(t *testing.T) {
	w := run(3, 4, 120)
	n := testing.AllocsPerRun(50, func() {
		w.Advance(1000.0 / 60)
		w.Render()
	})
	if n != 0 {
		t.Fatalf("Advance+Render allocate %v times per frame", n)
	}
}

func TestResizeRejectsOversizedFrames(t *testing.T) {
	w := &World{}
	w.Init(1, 0)
	if w.Resize(1000, 1000) {
		t.Fatal("a 1000×1000 frame should not fit")
	}
	if !w.Resize(195, 422) || w.Frame.W != 195 {
		t.Fatal("a portrait phone frame should fit")
	}
	w.Render()
}

func BenchmarkFrame(b *testing.B) {
	w := run(3, 4, 120)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		w.Advance(1000.0 / 60)
		w.Render()
	}
}

func TestBodiesBufferMirrorsTheSystem(t *testing.T) {
	w := run(318, 0, 120)
	n := int(w.State[StateBodies])
	if n != w.Sys.N || n < 3 {
		t.Fatalf("body count %d, system has %d", n, w.Sys.N)
	}
	for i := 0; i < n; i++ {
		row := w.Bodies[i*BodyWidth:]
		if row[BodyX] != w.Sys.X[i] || row[BodyY] != w.Sys.Y[i] || row[BodyMass] != w.Sys.M[i] {
			t.Fatalf("row %d doesn't match body %d", i, i)
		}
	}
	for i := 0; i < 3; i++ {
		row := w.Bodies[i*BodyWidth:]
		if row[BodyKind] != 0 || row[BodyExtra] != w.Stars[i].Luminance() {
			t.Fatalf("row %d should be star %d with its luminosity", i, i)
		}
	}
}

func TestEffectsListShellsShockAndFlash(t *testing.T) {
	w := &World{}
	w.Init(318, 0)
	w.Age()
	seen := map[float64]bool{}
	for i := 0; i < 60*10; i++ {
		w.Advance(1000.0 / 60)
		n := int(w.Effects[0])
		for k := 0; k < n; k++ {
			row := w.Effects[1+k*EffectWidth:]
			seen[row[EffectKind]] = true
			if row[EffectStrength] < 0 || row[EffectStrength] > 1 || row[EffectRadius] < 0 {
				t.Fatalf("bad effect row %v", row[:EffectWidth])
			}
		}
	}
	for _, kind := range []float64{EffectShell, EffectShock, EffectFlash} {
		if !seen[kind] {
			t.Fatalf("effect kind %v never appeared", kind)
		}
	}
}
