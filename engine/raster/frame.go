package raster

import "math"

// MaxPixels bounds the framebuffer. The page picks an integer upscale so the buffer stays at
// about 480×270 on a desktop and never exceeds this on tall phones.
const MaxPixels = 160_000

// Frame is the framebuffer: one palette index per pixel, row-major.
type Frame struct {
	W, H int
	Pix  [MaxPixels]uint8
}

// Resize sets the frame size; it refuses sizes that don't fit.
func (f *Frame) Resize(w, h int) bool {
	if w < 16 || h < 16 || w*h > MaxPixels {
		return false
	}
	f.W, f.H = w, h
	return true
}

// Set writes one pixel, ignoring anything off the frame or transparent.
func (f *Frame) Set(x, y int, c uint8) {
	if x < 0 || y < 0 || x >= f.W || y >= f.H || c == Transparent {
		return
	}
	f.Pix[y*f.W+x] = c
}

// Get reads one pixel; off-frame reads return Void.
func (f *Frame) Get(x, y int) uint8 {
	if x < 0 || y < 0 || x >= f.W || y >= f.H {
		return Void
	}
	return f.Pix[y*f.W+x]
}

// Fill paints the whole frame one colour.
func (f *Frame) Fill(c uint8) {
	n := f.W * f.H
	for i := 0; i < n; i++ {
		f.Pix[i] = c
	}
}

// bayer4 is the 4×4 ordered-dither matrix, as thresholds in (0, 1).
var bayer4 = [16]float64{
	0.5 / 16, 8.5 / 16, 2.5 / 16, 10.5 / 16,
	12.5 / 16, 4.5 / 16, 14.5 / 16, 6.5 / 16,
	3.5 / 16, 11.5 / 16, 1.5 / 16, 9.5 / 16,
	15.5 / 16, 7.5 / 16, 13.5 / 16, 5.5 / 16,
}

// Bayer returns the dither threshold for a pixel.
func Bayer(x, y int) float64 {
	return bayer4[(y&3)<<2|(x&3)]
}

func hash3(x, y, z int32) float64 {
	h := uint32(x)*374761393 + uint32(y)*668265263 + uint32(z)*1442695041
	h = (h ^ (h >> 13)) * 1274126177
	return float64(h^(h>>16)) / 4294967295.0
}

func smooth(t float64) float64 { return t * t * (3 - 2*t) }

func lerp(a, b, t float64) float64 { return a + (b-a)*t }

// Noise3 is smooth value noise in [0, 1].
func Noise3(x, y, z float64) float64 {
	xi, yi, zi := math.Floor(x), math.Floor(y), math.Floor(z)
	xf, yf, zf := smooth(x-xi), smooth(y-yi), smooth(z-zi)
	X, Y, Z := int32(xi), int32(yi), int32(zi)
	n := func(dx, dy, dz int32) float64 { return hash3(X+dx, Y+dy, Z+dz) }
	return lerp(
		lerp(lerp(n(0, 0, 0), n(1, 0, 0), xf), lerp(n(0, 1, 0), n(1, 1, 0), xf), yf),
		lerp(lerp(n(0, 0, 1), n(1, 0, 1), xf), lerp(n(0, 1, 1), n(1, 1, 1), xf), yf),
		zf,
	)
}

// Line draws a 1 px line with Bresenham's algorithm, dithered to the given density (0–1).
func (f *Frame) Line(x0, y0, x1, y1 int, c uint8, density float64) {
	dx, dy := abs(x1-x0), -abs(y1-y0)
	sx, sy := 1, 1
	if x0 > x1 {
		sx = -1
	}
	if y0 > y1 {
		sy = -1
	}
	err := dx + dy
	for guard := 0; guard < 4096; guard++ {
		if Bayer(x0, y0) < density {
			f.Set(x0, y0, c)
		}
		if x0 == x1 && y0 == y1 {
			return
		}
		e2 := 2 * err
		if e2 >= dy {
			err += dy
			x0 += sx
		}
		if e2 <= dx {
			err += dx
			y0 += sy
		}
	}
}

// Ring draws a dithered 1 px circle.
func (f *Frame) Ring(cx, cy int, radius float64, c uint8, density float64) {
	steps := int(math.Max(12, math.Ceil(radius*7)))
	for k := 0; k < steps; k++ {
		a := float64(k) / float64(steps) * 2 * math.Pi
		x := int(math.Round(float64(cx) + math.Cos(a)*radius))
		y := int(math.Round(float64(cy) + math.Sin(a)*radius))
		if Bayer(x, y) < density {
			f.Set(x, y, c)
		}
	}
}

// Star draws a shaded star: a spherical disc with limb darkening, slowly boiling value
// noise, and 4×4 Bayer dithering into the five tones, plus a dithered corona. opacity < 1
// thins it out (the chaos ghost is drawn at 0.25).
func (f *Frame) Star(cx, cy int, radius float64, tones *Tones, seed, t, opacity float64) {
	outer := radius + 1.6
	span := int(math.Ceil(outer))
	r2 := radius * radius
	spin := t * 0.6
	for dy := -span; dy <= span; dy++ {
		for dx := -span; dx <= span; dx++ {
			x, y := cx+dx, cy+dy
			b := Bayer(x, y)
			if opacity < 1 && b >= opacity {
				continue
			}
			d2 := float64(dx*dx+dy*dy) / r2
			if d2 > 1 {
				if math.Sqrt(float64(dx*dx+dy*dy)) <= outer && b < 0.42 {
					f.Set(x, y, tones[4])
				}
				continue
			}
			mu := math.Sqrt(1 - d2)
			i := 0.3 + 0.7*mu
			i += (Noise3(float64(dx)*0.45+spin+seed, float64(dy)*0.45, t*0.9) - 0.5) * 0.42
			i += (b - 0.5) * 0.24
			f.Set(x, y, toneFor(tones, i))
		}
	}
}

func toneFor(tones *Tones, i float64) uint8 {
	switch {
	case i > 0.9:
		return tones[0]
	case i > 0.64:
		return tones[1]
	case i > 0.42:
		return tones[2]
	case i > 0.24:
		return tones[3]
	}
	return tones[4]
}

// Blit copies a sprite (Transparent = skip) centred on (cx, cy).
func (f *Frame) Blit(sprite []uint8, w, h, cx, cy int) {
	x0, y0 := cx-w/2, cy-h/2
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			f.Set(x0+x, y0+y, sprite[y*w+x])
		}
	}
}

func abs(v int) int {
	if v < 0 {
		return -v
	}
	return v
}
