package sim

import (
	"math"

	"github.com/SkyeWalker360/my-three-body-cv/engine/raster"
	"github.com/SkyeWalker360/my-three-body-cv/engine/stars"
)

// Render draws the current state into w.Frame: starfield, gas shells, trails, fragments,
// shock rings, the planet, the ghost, the stars and any supernova flash.
func (w *World) Render() {
	f := &w.Frame
	n := f.W * f.H
	copy(f.Pix[:n], w.bg[:n])
	t := w.SimTime
	scale := w.scale()
	cx, cy := float64(f.W/2), float64(f.H/2)
	sx := func(x float64) int { return int(math.Floor(cx + x*scale)) }
	sy := func(y float64) int { return int(math.Floor(cy + y*scale)) }

	w.twinkle(t)

	for k := 0; k < w.shellCount; k++ {
		sh := &w.shells[k]
		age := w.RealTime - sh.born
		if age > shellLife {
			continue
		}
		r := w.radiusPx(sh.star, scale) + age*9*scale/referenceScale
		f.Ring(sx(w.Sys.X[sh.star]), sy(w.Sys.Y[sh.star]), r, sh.tone, (1-age/shellLife)*0.75)
	}

	for i := 0; i < 3; i++ {
		tones := w.tones(i)
		px, py := 0, 0
		for k := 0; k < w.trailCount; k++ {
			idx := (w.trailHead - w.trailCount + k + TrailLength) % TrailLength
			x, y := sx(w.trails[i][idx][0]), sy(w.trails[i][idx][1])
			if k > 0 {
				// Four fade steps from tail to head, each a darker palette tone.
				q := k * 4 / w.trailCount
				f.Line(px, py, x, y, tones[4-q], 0.35+0.15*float64(q))
			}
			px, py = x, y
		}
	}

	for b := 3; b < w.Sys.N; b++ {
		if w.kind[b] != kindFragment {
			continue
		}
		x, y := sx(w.Sys.X[b]), sy(w.Sys.Y[b])
		age := t - w.born[b]
		step := 4
		if age > 10 {
			step = 2
		} else if age > 3 {
			step = 3
		}
		c := raster.R(w.tone[b], step)
		f.Set(x, y, c)
		f.Set(x+1, y, c)
		f.Set(x, y+1, c)
		f.Set(x+1, y+1, raster.R(w.tone[b], step-1))
	}

	for k := 0; k < w.shockCount; k++ {
		sk := &w.shocks[k]
		age := t - sk.born
		if age > shockLife {
			continue
		}
		x, y := sx(sk.x), sy(sk.y)
		c := raster.R(raster.CyanRamp, 4)
		if age < 0.6 {
			c = raster.R(raster.StarRamp, 3)
		}
		k := scale / referenceScale
		f.Ring(x, y, (6+age*70)*k, c, (1-age/shockLife)*0.9)
		f.Ring(x, y, (3+age*52)*k, raster.R(raster.CyanRamp, 2), (1-age/shockLife)*0.5)
	}

	if w.planet >= 0 {
		p := w.planet
		lx, ly := 0.0, 0.0
		for i := range w.Stars {
			dx, dy := w.Sys.X[i]-w.Sys.X[p], w.Sys.Y[i]-w.Sys.Y[p]
			d2 := math.Max(dx*dx+dy*dy, 1e-4)
			l := w.Stars[i].Luminance() / d2
			d := math.Sqrt(d2)
			lx += l * dx / d
			ly += l * dy / d
		}
		if m := math.Hypot(lx, ly); m > 0 {
			lx, ly = lx/m, ly/m
		}
		f.Planet(sx(w.Sys.X[p]), sy(w.Sys.Y[p]), planetRadius*scale/referenceScale, w.Era, lx, ly, t*0.8, w.Lights)
	}

	if w.GhostOn && w.Stars[0].Phase != stars.BlackHole {
		gx, gy := sx(w.Ghost.X[0]), sy(w.Ghost.Y[0])
		if math.Hypot(float64(gx-sx(w.Sys.X[0])), float64(gy-sy(w.Sys.Y[0]))) >= 2 {
			f.Star(gx, gy, w.radiusPx(0, scale), w.tones(0), w.Stars[0].Seed, t, 0.25)
		}
	}

	for i := 0; i < 3; i++ {
		x, y := sx(w.Sys.X[i]), sy(w.Sys.Y[i])
		s := &w.Stars[i]
		switch s.Phase {
		case stars.BlackHole:
			f.BlackHole(x, y, t)
		case stars.NeutronStar:
			f.Star(x, y, w.radiusPx(i, scale), w.tones(i), s.Seed, t, 1)
			if int(t*6)%2 == 0 {
				f.Line(x-6, y-6, x+6, y+6, raster.R(raster.CyanRamp, 4), 0.6)
			}
		default:
			f.Star(x, y, w.radiusPx(i, scale), w.tones(i), s.Seed, t, 1)
		}
	}

	if w.flash > 0 {
		th := float64(w.flash) / 10 * 0.85
		white := raster.R(raster.StarRamp, 3)
		for y := 0; y < f.H; y++ {
			for x := 0; x < f.W; x++ {
				if raster.Bayer(x, y) < th {
					f.Pix[y*f.W+x] = white
				}
			}
		}
	}
}

// tones is the shading set for star i: its stellar class, or the cyan ramp for a black hole's
// trail.
func (w *World) tones(i int) *raster.Tones {
	s := &w.Stars[i]
	if s.Phase == stars.BlackHole {
		return &blackHoleTones
	}
	return &raster.StellarTones[stars.Class(s.Temperature)]
}

var blackHoleTones = raster.RampTones(raster.CyanRamp)

// twinkle brightens a few background stars, changing twice per simulated second.
func (w *World) twinkle(t float64) {
	f := &w.Frame
	tick := int(t * 2)
	for k := 0; k < 6; k++ {
		h := hash(uint32(k), uint32(tick), 5)
		x := int(h % uint32(f.W))
		y := int(hash(uint32(k), uint32(tick), 9) % uint32(f.H))
		c := f.Pix[y*f.W+x]
		if c == raster.InkMuted || c == raster.R(raster.VoidRamp, 4) || c == raster.R(raster.VoidRamp, 3) {
			f.Pix[y*f.W+x] = raster.Ink
		}
	}
}

func hash(a, b, c uint32) uint32 {
	h := a*374761393 + b*668265263 + c*1442695041
	h = (h ^ (h >> 13)) * 1274126177
	return h ^ (h >> 16)
}
