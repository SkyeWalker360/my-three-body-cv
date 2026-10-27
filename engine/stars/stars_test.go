package stars

import "testing"

func TestClassRunsCoolToHot(t *testing.T) {
	prev := -1
	for _, temp := range []float64{2000, 3000, 4000, 5500, 7000, 12000, 40000} {
		c := Class(temp)
		if c < prev {
			t.Fatalf("Class(%v) = %d went backwards from %d", temp, c, prev)
		}
		prev = c
	}
	if Class(2400) != 0 || Class(30000) != 5 {
		t.Fatalf("reference temperatures should snap to their own step")
	}
}

func TestKindsHaveDistinctColours(t *testing.T) {
	a, b, c := Class(RedDwarf.Temperature), Class(Sun.Temperature), Class(BlueGiant.Temperature)
	if !(a < b && b < c) {
		t.Fatalf("red dwarf, sun and blue giant classes = %d, %d, %d", a, b, c)
	}
}

func TestGiantPhaseEndsInTheRightRemnant(t *testing.T) {
	for _, k := range []*Kind{&Sun, &BlueGiant} {
		var s Star
		s.Reset(k, 1)
		s.StartGiant()
		done := false
		for i := 0; i < 1000 && !done; i++ {
			done = s.Update(1.0/60, float64(i)/60)
		}
		if !done || s.Phase != k.Remnant {
			t.Fatalf("%s: phase %d after the giant branch, want %d", k.Name, s.Phase, k.Remnant)
		}
	}
}

func TestGiantsSwellAndCool(t *testing.T) {
	var s Star
	s.Reset(&Sun, 1)
	s.StartGiant()
	s.Update(GiantSeconds*0.9, 0)
	if s.Radius <= Sun.Radius*1.5 || s.Temperature >= Sun.Temperature {
		t.Fatalf("giant at 90%%: radius %.1f, temperature %.0f", s.Radius, s.Temperature)
	}
}

func TestRedDwarfNeverAges(t *testing.T) {
	var s Star
	s.Reset(&RedDwarf, 1)
	if s.CanAge() {
		t.Fatal("a red dwarf should not leave the main sequence")
	}
	s.StartGiant()
	if s.Phase != MainSequence {
		t.Fatal("StartGiant changed a red dwarf")
	}
}

func TestLuminanceFollowsTheLifecycle(t *testing.T) {
	var s Star
	s.Reset(&Sun, 1)
	if s.Luminance() != 1 {
		t.Fatalf("the Sun's main-sequence luminance is %v, want 1", s.Luminance())
	}
	s.StartGiant()
	s.Update(GiantSeconds/2, 0)
	if s.Luminance() <= 1 {
		t.Fatal("a giant should outshine its main-sequence self")
	}
	s.Update(GiantSeconds, 0)
	if s.Phase != WhiteDwarf || s.Luminance() >= 0.1 {
		t.Fatalf("white dwarf luminance %v", s.Luminance())
	}
}
