package rng

import "testing"

func TestSameSeedSameSequence(t *testing.T) {
	a, b := New(318), New(318)
	for i := 0; i < 1000; i++ {
		if a.Next() != b.Next() {
			t.Fatalf("sequences diverged at %d", i)
		}
	}
}

func TestDifferentSeedsDiffer(t *testing.T) {
	a, b := New(1), New(2)
	same := 0
	for i := 0; i < 100; i++ {
		if a.Next() == b.Next() {
			same++
		}
	}
	if same > 2 {
		t.Fatalf("seeds 1 and 2 matched %d times out of 100", same)
	}
}

func TestFloatRange(t *testing.T) {
	p := New(7)
	sum := 0.0
	for i := 0; i < 10000; i++ {
		f := p.Float()
		if f < 0 || f >= 1 {
			t.Fatalf("Float out of range: %v", f)
		}
		sum += f
	}
	if mean := sum / 10000; mean < 0.48 || mean > 0.52 {
		t.Fatalf("mean %v is not close to 0.5", mean)
	}
}
