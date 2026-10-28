// Command wasm is the browser build of the engine, compiled with TinyGo:
//
//	tinygo build -o ../public/engine.wasm -target wasm-unknown -opt=z -no-debug -gc=leaking -panic=trap ./wasm
//
// It exports a C-ABI interface; the page calls _initialize once, then reads the state, frame
// and event buffers straight out of linear memory, so nothing is copied across the boundary.
// The world is a global of fixed-size arrays and nothing allocates after start-up, which is
// why the leaking GC is safe.
package main

import (
	"unsafe"

	"github.com/SkyeWalker360/my-three-body-cv/engine/sim"
)

var world sim.World

//go:wasmexport init
func initWorld(seed uint32, preset int32) {
	world.Init(uint64(seed), int(preset))
}

//go:wasmexport resize
func resize(width, height int32) int32 {
	if world.Resize(int(width), int(height)) {
		return 1
	}
	return 0
}

//go:wasmexport advance
func advance(ms float64) { world.Advance(ms) }

//go:wasmexport render
func render() { world.Render() }

//go:wasmexport kick
func kick(body int32, dvx, dvy float64) { world.Kick(int(body), dvx, dvy) }

//go:wasmexport age
func age() int32 { return int32(world.Age()) }

//go:wasmexport ghost
func ghost(on int32) { world.SetGhost(on != 0) }

//go:wasmexport statePtr
func statePtr() uint32 { return uint32(uintptr(unsafe.Pointer(&world.State[0]))) }

//go:wasmexport framePtr
func framePtr() uint32 { return uint32(uintptr(unsafe.Pointer(&world.Frame.Pix[0]))) }

//go:wasmexport bodiesPtr
func bodiesPtr() uint32 { return uint32(uintptr(unsafe.Pointer(&world.Bodies[0]))) }

//go:wasmexport effectsPtr
func effectsPtr() uint32 { return uint32(uintptr(unsafe.Pointer(&world.Effects[0]))) }

//go:wasmexport eventsPtr
func eventsPtr() uint32 { return uint32(uintptr(unsafe.Pointer(&world.Events[0]))) }

//go:wasmexport frameWidth
func frameWidth() int32 { return int32(world.Frame.W) }

//go:wasmexport frameHeight
func frameHeight() int32 { return int32(world.Frame.H) }

func main() {}
