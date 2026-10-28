// Package csspal reads the engine palette's colours from the site's theme tokens, for the
// native tools that write PNGs. The browser does the same from computed styles.
package csspal

import (
	"fmt"
	"image/color"
	"os"
	"regexp"
	"strconv"

	"github.com/SkyeWalker360/my-three-body-cv/engine/raster"
)

// Load parses --color-<name>: #rrggbb; for every engine palette entry.
func Load(cssPath string) ([]color.RGBA, error) {
	css, err := os.ReadFile(cssPath)
	if err != nil {
		return nil, err
	}
	pal := make([]color.RGBA, raster.Count)
	for i, name := range raster.Names {
		m := regexp.MustCompile(`--color-` + regexp.QuoteMeta(name) + `:\s*#([0-9a-fA-F]{6})\s*;`).FindSubmatch(css)
		if m == nil {
			return nil, fmt.Errorf("%s has no --color-%s", cssPath, name)
		}
		v, _ := strconv.ParseUint(string(m[1]), 16, 32)
		pal[i] = color.RGBA{uint8(v >> 16), uint8(v >> 8), uint8(v), 255}
	}
	return pal, nil
}
