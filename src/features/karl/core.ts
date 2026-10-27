/**
 * Physics behind the core gauge: the Lane–Emden equation for a polytrope of index n = 3
 * (a relativistic degenerate core, P = Kρ^{4/3}). Pure, for tests.
 */

/**
 * Integrate θ'' + (2/ξ)θ' + θⁿ = 0 with θ(0)=1, θ'(0)=0 (RK4) until θ reaches 0.
 * Returns samples of density ρ/ρc = θⁿ on a uniform ξ grid, and the surface radius ξ₁.
 */
export function laneEmden(n = 3, h = 1e-3): { xi1: number; density: Float64Array } {
  // Series start avoids the 2/ξ singularity: θ ≈ 1 − ξ²/6 + nξ⁴/120.
  let xi = h;
  let theta = 1 - (xi * xi) / 6 + (n * xi ** 4) / 120;
  let dtheta = -xi / 3 + (n * xi ** 3) / 30;
  const thetas: number[] = [1, theta];
  const f = (x: number, t: number, dt: number) => -(2 / x) * dt - Math.pow(Math.max(t, 0), n);

  while (theta > 0 && xi < 20) {
    const k1t = dtheta;
    const k1d = f(xi, theta, dtheta);
    const k2t = dtheta + (h / 2) * k1d;
    const k2d = f(xi + h / 2, theta + (h / 2) * k1t, k2t);
    const k3t = dtheta + (h / 2) * k2d;
    const k3d = f(xi + h / 2, theta + (h / 2) * k2t, k3t);
    const k4t = dtheta + h * k3d;
    const k4d = f(xi + h, theta + h * k3t, k4t);
    const next = theta + (h / 6) * (k1t + 2 * k2t + 2 * k3t + k4t);
    dtheta += (h / 6) * (k1d + 2 * k2d + 2 * k3d + k4d);
    if (next <= 0) {
      // Linear interpolation for the zero crossing.
      xi += h * (theta / (theta - next));
      theta = 0;
      break;
    }
    theta = next;
    xi += h;
    thetas.push(theta);
  }

  const samples = 128;
  const density = new Float64Array(samples);
  for (let i = 0; i < samples; i++) {
    const idx = Math.min(thetas.length - 1, Math.round((i / (samples - 1)) * (thetas.length - 1)));
    density[i] = Math.pow(thetas[idx]!, n);
  }
  return { xi1: xi, density };
}

export { bayer8 } from '@/lib/dither';
