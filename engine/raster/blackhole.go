package raster

import "math"

// Black hole sprite sheet: BlackHoleFrames frames of BlackHoleW×BlackHoleH. cmd/bake renders
// it once at build time into blackhole_gen.go (and a PNG preview in public/sprites); the
// engine only blits frames, so nothing is ray-marched live.
const (
	BlackHoleW      = 34
	BlackHoleH      = 20
	BlackHoleFrames = 16
)

// BakeBlackHole draws frame k (0–15) of the sheet into dst: a dark shadow, a thin photon
// ring, a lensed arch over the top, and a flattened accretion disk that is cyan where it
// comes toward the viewer and red where it moves away (Doppler beaming in site colours).
func BakeBlackHole(dst []uint8, k int) {
	for i := range dst {
		dst[i] = Transparent
	}
	f := sub{dst, BlackHoleW, BlackHoleH}
	cx, cy := BlackHoleW/2, BlackHoleH/2+1
	const rs, rIn, rOut, flat = 4, 7, 15, 0.32
	t := float64(k) / BlackHoleFrames
	disk := func(front bool) {
		for dy := -6; dy <= 6; dy++ {
			if (front && dy < 0) || (!front && dy >= 0) {
				continue
			}
			for dx := -rOut; dx <= rOut; dx++ {
				er := math.Sqrt(float64(dx*dx) + math.Pow(float64(dy)/flat, 2))
				if er < rIn || er > rOut {
					continue
				}
				if !front && dx*dx+dy*dy <= (rs+1)*(rs+1) {
					continue
				}
				ang := math.Atan2(float64(dy)/flat, float64(dx))
				// The swirl pattern turns one full cycle over the sheet, so it loops cleanly.
				swirl := Noise3(math.Cos(ang-t*2*math.Pi)*2+3, math.Sin(ang-t*2*math.Pi)*2+3, er*0.4)
				heat := 1 - (er-rIn)/(rOut-rIn) + (swirl-0.5)*0.5 + (Bayer(cx+dx, cy+dy)-0.5)*0.3
				var c uint8
				if dx < 0 {
					switch {
					case heat > 0.85:
						c = R(StarRamp, 3)
					case heat > 0.6:
						c = R(CyanRamp, 4)
					case heat > 0.38:
						c = R(CyanRamp, 3)
					case heat > 0.18:
						c = R(CyanRamp, 2)
					default:
						c = R(CyanRamp, 1)
					}
				} else {
					switch {
					case heat > 0.8:
						c = R(RedRamp, 4)
					case heat > 0.5:
						c = R(RedRamp, 3)
					case heat > 0.25:
						c = R(RedRamp, 2)
					default:
						c = R(RedRamp, 1)
					}
				}
				f.set(cx+dx, cy+dy, c)
			}
		}
	}
	disk(false)
	for i := 0; i <= 40; i++ {
		a := float64(i) / 40 * math.Pi
		ca := math.Cos(a)
		x := int(math.Round(float64(cx) + ca*8.5))
		y := int(math.Round(float64(cy) - math.Sin(a)*7.5))
		if Bayer(x, y) < 0.7 {
			if ca < 0 {
				f.set(x, y, R(CyanRamp, 2))
			} else {
				f.set(x, y, R(RedRamp, 1))
			}
		}
	}
	for dy := -rs; dy <= rs; dy++ {
		for dx := -rs; dx <= rs; dx++ {
			if dx*dx+dy*dy <= rs*rs+1 {
				f.set(cx+dx, cy+dy, Void)
			}
		}
	}
	steps := 36
	for i := 0; i < steps; i++ {
		a := float64(i) / float64(steps) * 2 * math.Pi
		f.set(int(math.Round(float64(cx)+math.Cos(a)*(rs+1))), int(math.Round(float64(cy)+math.Sin(a)*(rs+1))), R(StarRamp, 3))
	}
	disk(true)
}

type sub struct {
	pix  []uint8
	w, h int
}

func (s sub) set(x, y int, c uint8) {
	if x >= 0 && y >= 0 && x < s.w && y < s.h {
		s.pix[y*s.w+x] = c
	}
}

// BlackHole blits the sheet frame for time t (8 frames per simulated second).
func (f *Frame) BlackHole(cx, cy int, t float64) {
	k := int(t*8) % BlackHoleFrames
	if k < 0 {
		k += BlackHoleFrames
	}
	n := BlackHoleW * BlackHoleH
	f.Blit(blackHoleSheet[k*n:(k+1)*n], BlackHoleW, BlackHoleH, cx, cy)
}
