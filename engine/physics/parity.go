package physics

import "math"

// ParityTime is how far each preset is integrated for the Go/TypeScript parity fixture.
const ParityTime = 0.5

// ParityState is one preset's state after ParityTime, as interleaved x, y and vx, vy.
type ParityState struct {
	Name string     `json:"name"`
	X    [6]float64 `json:"x"`
	V    [6]float64 `json:"v"`
}

// Parity integrates every preset to ParityTime. cmd/parity writes the result to
// tests/fixtures/parity.json, where the TypeScript solver is checked against it.
func Parity() []ParityState {
	out := make([]ParityState, len(Presets))
	for i := range Presets {
		s := &System{}
		s.Load(&Presets[i])
		steps := int(math.Round(ParityTime / s.Dt))
		for k := 0; k < steps; k++ {
			s.Step()
		}
		out[i].Name = Presets[i].Name
		for b := 0; b < 3; b++ {
			out[i].X[2*b], out[i].X[2*b+1] = s.X[b], s.Y[b]
			out[i].V[2*b], out[i].V[2*b+1] = s.VX[b], s.VY[b]
		}
	}
	return out
}
