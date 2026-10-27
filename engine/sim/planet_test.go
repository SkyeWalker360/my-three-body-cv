package sim

import (
	"testing"

	"github.com/SkyeWalker360/my-three-body-cv/engine/raster"
)

// The planet should spend most of a calm run in the stable era on the periodic presets.
func TestPlanetIsMostlyStableOnPeriodicPresets(t *testing.T) {
	for _, preset := range []int{0, 2, 5} {
		w := &World{}
		w.Init(9, preset)
		stable, alive := 0, 0
		for i := 0; i < 60*120; i++ {
			w.Advance(1000.0 / 60)
			if w.planet >= 0 {
				alive++
				if w.Era == raster.EraStable {
					stable++
				}
			}
		}
		if alive < 60*60 || stable*2 < alive {
			t.Errorf("preset %d: planet alive %d frames, stable %d of them", preset, alive, stable)
		}
	}
}
