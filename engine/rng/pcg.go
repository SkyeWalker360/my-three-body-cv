// Package rng is a small seeded PCG32 generator (O'Neill, 2014). The engine uses it for
// everything random, so the same seed always gives the same run.
package rng

const multiplier = 6364136223846793005

// PCG32 is the XSH-RR variant: 64-bit state, 32-bit output.
type PCG32 struct {
	state, inc uint64
}

// New seeds a generator. The stream constant is fixed so a seed alone picks the sequence.
func New(seed uint64) PCG32 {
	p := PCG32{inc: 0xda3e39cb94b95bdb | 1}
	p.Next()
	p.state += seed
	p.Next()
	return p
}

// Next returns the next 32 random bits.
func (p *PCG32) Next() uint32 {
	old := p.state
	p.state = old*multiplier + p.inc
	xorshifted := uint32(((old >> 18) ^ old) >> 27)
	rot := uint32(old >> 59)
	return (xorshifted >> rot) | (xorshifted << ((-rot) & 31))
}

// Float returns a float64 in [0, 1).
func (p *PCG32) Float() float64 {
	return float64(p.Next()) / 4294967296.0
}

// Signed returns a float64 in [-1, 1).
func (p *PCG32) Signed() float64 {
	return p.Float()*2 - 1
}
