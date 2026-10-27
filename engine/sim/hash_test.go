package sim

import (
	"crypto/sha256"
	"fmt"
	"os"
	"testing"
)

// TestPrintReferenceHash prints the frame digest for the WASM cross-check script when
// ENGINE_HASH=1. It is skipped otherwise.
func TestPrintReferenceHash(t *testing.T) {
	if os.Getenv("ENGINE_HASH") == "" {
		t.Skip("set ENGINE_HASH=1 to print")
	}
	w := run(318, 4, 600)
	fmt.Printf("native %x t=%.6f\n", sha256.Sum256(w.Frame.Pix[:w.Frame.W*w.Frame.H]), w.SimTime)
}
