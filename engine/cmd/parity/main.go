// Command parity writes tests/fixtures/parity.json: every preset integrated by the Go engine
// to physics.ParityTime. Run from engine/: go run ./cmd/parity
package main

import (
	"encoding/json"
	"log"
	"os"

	"github.com/SkyeWalker360/my-three-body-cv/engine/physics"
)

const out = "../tests/fixtures/parity.json"

func main() {
	data, err := json.MarshalIndent(map[string]any{
		"time":    physics.ParityTime,
		"presets": physics.Parity(),
	}, "", "  ")
	if err != nil {
		log.Fatal(err)
	}
	if err := os.WriteFile(out, append(data, '\n'), 0o644); err != nil {
		log.Fatal(err)
	}
	log.Printf("wrote %s", out)
}
