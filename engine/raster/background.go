package raster

import "github.com/SkyeWalker360/my-three-body-cv/engine/rng"

// Starfield draws the static backdrop: a faint dithered Milky Way band in the darkest violet
// steps and a scatter of background stars. Built once per resize from a fixed seed.
func (f *Frame) Starfield(seed uint64) {
	f.Fill(Void)
	w, h := float64(f.W), float64(f.H)
	for y := 0; y < f.H; y++ {
		for x := 0; x < f.W; x++ {
			// A diagonal band, about an eighth of the frame tall.
			d := (float64(y) - (h*0.78 - float64(x)*0.32*h/270)) / (h * 0.126)
			dens := gauss(d) * (0.55 + 0.6*Noise3(float64(x)*0.05, float64(y)*0.05, 7))
			b := Bayer(x, y)
			if b < dens*0.4 {
				f.Pix[y*f.W+x] = R(VioletRamp, 1)
			} else if b < dens*0.8 {
				f.Pix[y*f.W+x] = R(VioletRamp, 0)
			}
		}
	}
	r := rng.New(seed)
	n := int(w * h / 430)
	for i := 0; i < n; i++ {
		x, y := int(r.Float()*w), int(r.Float()*h)
		v := r.Float()
		c := R(VoidRamp, 3)
		switch {
		case v < 0.06:
			c = Ink
		case v < 0.3:
			c = InkMuted
		case v < 0.65:
			c = R(VoidRamp, 4)
		}
		f.Pix[y*f.W+x] = c
	}
}

func gauss(d float64) float64 {
	// exp(-d²) without math.Exp's table, accurate enough for a backdrop.
	x := d * d
	if x > 8 {
		return 0
	}
	return 1 / (1 + x + x*x/2 + x*x*x/6 + x*x*x*x/24)
}
