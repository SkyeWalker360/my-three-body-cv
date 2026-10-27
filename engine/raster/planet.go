package raster

import "math"

// Era is the planet's climate, set by the light it receives from all three stars.
type Era uint8

const (
	EraNone Era = iota
	EraStable
	EraScorched
	EraFrozen
)

// biome is one palette-swapped surface set: ocean and land, lit and night side.
type biome struct{ oceanLit, oceanDark, landLit, landDark, rim uint8 }

var biomes = [4]biome{
	EraStable:   {R(CyanRamp, 3), R(CyanRamp, 1), Green, R(VoidRamp, 3), R(CyanRamp, 4)},
	EraScorched: {R(RedRamp, 2), R(RedRamp, 0), R(GoldRamp, 3), R(RedRamp, 1), R(RedRamp, 4)},
	EraFrozen:   {R(VoidRamp, 5), R(VoidRamp, 2), Ink, R(VoidRamp, 3), R(CyanRamp, 5)},
}

// Planet draws a small world of the given radius lit from direction (lx, ly) (unit vector
// toward the light). Continents come from value noise that turns with spin. With lights on,
// 1 px gold city lights dot the night-side land.
func (f *Frame) Planet(cx, cy int, radius float64, era Era, lx, ly, spin float64, lights bool) {
	if era == EraNone {
		era = EraStable
	}
	b := biomes[era]
	span := int(math.Ceil(radius))
	r2 := radius * radius
	for dy := -span; dy <= span; dy++ {
		for dx := -span; dx <= span; dx++ {
			d2 := float64(dx*dx + dy*dy)
			if d2 > r2 {
				continue
			}
			x, y := cx+dx, cy+dy
			nx, ny := float64(dx)/radius, float64(dy)/radius
			nz := math.Sqrt(math.Max(0, 1-nx*nx-ny*ny))
			// Longitude on the sphere, so the surface scrolls as the planet turns.
			lon := math.Atan2(nx, nz) + spin
			land := Noise3(math.Cos(lon)*1.6+5, ny*1.8+5, math.Sin(lon)*1.6+5) > 0.52
			lit := nx*lx+ny*ly+(Bayer(x, y)-0.5)*0.35 > -0.05
			var c uint8
			switch {
			case land && lit:
				c = b.landLit
			case land:
				c = b.landDark
				if lights && era == EraStable && Bayer(x+3, y+1) < 0.12 {
					c = R(GoldRamp, 3)
				}
			case lit:
				c = b.oceanLit
			default:
				c = b.oceanDark
			}
			if d2 > (radius-0.8)*(radius-0.8) && lit {
				c = b.rim
			}
			f.Set(x, y, c)
		}
	}
}
