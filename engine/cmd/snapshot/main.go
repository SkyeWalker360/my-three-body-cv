// Command snapshot runs the lab headlessly and writes a PNG of one frame, for checking the
// pixel art by eye. Run from engine/:
//
//	go run ./cmd/snapshot -preset 0 -frames 600 -age 120 -out /tmp/frame.png
package main

import (
	"flag"
	"image"
	"image/png"
	"log"
	"os"

	"github.com/SkyeWalker360/my-three-body-cv/engine/internal/csspal"
	"github.com/SkyeWalker360/my-three-body-cv/engine/sim"
)

var world sim.World

func main() {
	preset := flag.Int("preset", 0, "preset index")
	seed := flag.Uint64("seed", 318, "seed")
	frames := flag.Int("frames", 600, "frames to run at 60 Hz")
	age1 := flag.Int("age1", -1, "frame at which to age a star")
	age2 := flag.Int("age2", -1, "frame at which to age another star")
	ghost := flag.Bool("ghost", true, "show the chaos ghost")
	width := flag.Int("w", 480, "frame width")
	height := flag.Int("h", 270, "frame height")
	zoom := flag.Int("zoom", 3, "integer upscale")
	out := flag.String("out", "frame.png", "output PNG")
	flag.Parse()

	pal, err := csspal.Load("../src/app/globals.css")
	if err != nil {
		log.Fatal(err)
	}
	world.Init(*seed, *preset)
	if !world.Resize(*width, *height) {
		log.Fatal("frame too large")
	}
	world.SetGhost(*ghost)
	for i := 0; i < *frames; i++ {
		if i == *age1 || i == *age2 {
			world.Age()
		}
		world.Advance(1000.0 / 60)
	}
	world.Render()

	f := &world.Frame
	img := image.NewRGBA(image.Rect(0, 0, f.W**zoom, f.H**zoom))
	for y := 0; y < f.H**zoom; y++ {
		for x := 0; x < f.W**zoom; x++ {
			img.Set(x, y, pal[f.Pix[(y / *zoom)*f.W + x / *zoom]])
		}
	}
	o, err := os.Create(*out)
	if err != nil {
		log.Fatal(err)
	}
	defer o.Close()
	if err := png.Encode(o, img); err != nil {
		log.Fatal(err)
	}
	log.Printf("wrote %s (t = %.2f, events %d)", *out, world.SimTime, world.Events[0])
}
