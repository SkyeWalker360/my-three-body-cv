// Package raster draws the lab into a framebuffer of palette indices. It never produces a
// colour: the page maps each index to the theme token of the same name, so every pixel on
// screen is a site colour.
package raster

// Palette indices, in the order of Names.
const (
	Void uint8 = iota
	Ink
	InkMuted
	Cyan
	Gold
	Red
	Green
	Violet
	VioletInk
	void0 // the six-step ramps start here; use the ramp helpers below
)

// Ramp bases: each ramp is six consecutive indices, step 0 (dark) to 5 (light). The stellar
// ramp runs cool to hot instead.
const (
	VoidRamp   = void0
	CyanRamp   = void0 + 6
	GoldRamp   = void0 + 12
	RedRamp    = void0 + 18
	VioletRamp = void0 + 24
	StarRamp   = void0 + 30
	// Count is the number of palette entries.
	Count = void0 + 36
	// Transparent marks empty pixels in sprites; it never reaches the framebuffer.
	Transparent uint8 = 255
)

// Names are the CSS token names (without --color-) for each index. The page reads these
// tokens to build its colour table; tests/unit/engine-palette.test.ts checks the TypeScript
// copy matches.
var Names = [Count]string{
	"void", "ink", "ink-muted", "cyan", "gold", "red", "green", "violet", "violet-ink",
	"void-0", "void-1", "void-2", "void-3", "void-4", "void-5",
	"cyan-0", "cyan-1", "cyan-2", "cyan-3", "cyan-4", "cyan-5",
	"gold-0", "gold-1", "gold-2", "gold-3", "gold-4", "gold-5",
	"red-0", "red-1", "red-2", "red-3", "red-4", "red-5",
	"violet-0", "violet-1", "violet-2", "violet-3", "violet-4", "violet-5",
	"star-0", "star-1", "star-2", "star-3", "star-4", "star-5",
}

// R returns step (0–5) of the ramp starting at base.
func R(base uint8, step int) uint8 {
	if step < 0 {
		step = 0
	} else if step > 5 {
		step = 5
	}
	return base + uint8(step)
}

// Tones is a five-tone shading set, brightest first, for dithered sprites.
type Tones [5]uint8

// StellarTones gives each stellar class a shading set. The centre is the class colour (or one
// step hotter), and the limb darkens toward cooler, redder colours, as real stars do. Built
// from palette entries only: nothing is mixed with white or black.
var StellarTones = [6]Tones{
	{R(StarRamp, 1), R(StarRamp, 0), R(RedRamp, 2), R(RedRamp, 1), R(RedRamp, 0)},        // deep red
	{R(StarRamp, 2), R(StarRamp, 1), R(StarRamp, 0), R(RedRamp, 2), R(RedRamp, 1)},       // orange
	{R(StarRamp, 3), R(StarRamp, 2), R(StarRamp, 1), R(GoldRamp, 1), R(GoldRamp, 0)},     // yellow
	{R(StarRamp, 3), R(GoldRamp, 5), R(GoldRamp, 4), R(StarRamp, 2), R(GoldRamp, 2)},     // white
	{R(StarRamp, 3), R(StarRamp, 4), R(StarRamp, 5), R(CyanRamp, 2), R(VoidRamp, 2)},     // pale blue
	{R(StarRamp, 3), R(StarRamp, 4), R(StarRamp, 5), R(VioletRamp, 3), R(VioletRamp, 2)}, // blue-white
}

// RampTones takes five tones of a shading ramp, brightest first (steps 5 down to 1).
func RampTones(base uint8) Tones {
	return Tones{R(base, 5), R(base, 4), R(base, 3), R(base, 2), R(base, 1)}
}
