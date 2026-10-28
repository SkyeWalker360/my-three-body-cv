package physics

import (
	"encoding/json"
	"os"
	"testing"
)

func TestParityFixtureIsUpToDate(t *testing.T) {
	raw, err := os.ReadFile("../../tests/fixtures/parity.json")
	if err != nil {
		t.Fatalf("missing fixture (run `go run ./cmd/parity` in engine/): %v", err)
	}
	var fixture struct {
		Time    float64       `json:"time"`
		Presets []ParityState `json:"presets"`
	}
	if err := json.Unmarshal(raw, &fixture); err != nil {
		t.Fatal(err)
	}
	got := Parity()
	if fixture.Time != ParityTime || len(fixture.Presets) != len(got) {
		t.Fatalf("fixture is stale (run `go run ./cmd/parity` in engine/)")
	}
	for i := range got {
		if got[i] != fixture.Presets[i] {
			t.Fatalf("%s: fixture is stale (run `go run ./cmd/parity` in engine/)", got[i].Name)
		}
	}
}
