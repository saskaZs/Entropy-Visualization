import React, { useMemo, useRef } from "react";
import gammaln from '@stdlib/math-base-special-gammaln';
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Local microstate count per cell (color-arrangement only):
 *   W_i = (R_i + B_i)! / (R_i! * B_i!)
 * Local entropy: S_i = ln W_i.
 * Global entropy: S = sum_i S_i  (since ln(∏ W_i) = ∑ ln W_i), with k = 1.
 *
 * Notes:
 * - If a cell is empty or contains a single color => W_i = 1 => S_i = 0.
 * - We ignore spatial permutations inside the cell for speed and focus on color mixing.
 */

// ---------- Numerics helpers ----------
// Lanczos approximation for log-gamma; stable ln(n!) via gammaln(n + 1)

function lnComb(n, k) {
  if (k < 0 || k > n) return -Infinity;
  if (k === 0 || k === n) return 0;
  return gammaln(n + 1) - gammaln(k + 1) - gammaln(n - k + 1);
}

export default function EntropyGrid({
  L = 10,
  gridN = 4,
  getParticlePositions,
  getColorFlags,
  onTotalEntropy,
  opacity = 0.1,
}) {
  const half = L / 2;
  const cellSize = L / gridN;

  // Pre-create cell transforms (N^3 boxes)
  const cells = useMemo(() => {
    const arr = [];
    for (let ix = 0; ix < gridN; ix++) {
      for (let iy = 0; iy < gridN; iy++) {
        for (let iz = 0; iz < gridN; iz++) {
          const cx = -half + (ix + 0.5) * cellSize;
          const cy = -half + (iy + 0.5) * cellSize;
          const cz = -half + (iz + 0.5) * cellSize;
          arr.push({
            id: ix + iy * gridN + iz * gridN * gridN,
            pos: [cx, cy, cz],
          });
        }
      }
    }
    return arr;
  }, [gridN, L]);

  const meshRefs = useRef([]);
  const matRefs = useRef([]);

  // Multi-stop color ramp (green → yellow-green → orange → red)
  const colorStops = useMemo(
    () => [
      new THREE.Color("#00b050"), // green (low S)
      new THREE.Color("#c8ff00"), // yellow-green
      new THREE.Color("#ffb000"), // orange/amber
      new THREE.Color("#ff0033"), // red (high S)
    ],
    []
  );

  //Temporary color object for interpolation (avoids allocations per frame)
  const tmpColor = useRef(new THREE.Color()).current;

  useFrame(() => {
    const positions = getParticlePositions?.() || [];
    const colorFlags = getColorFlags?.() || [];

    //Count red/blue per cell
    const size = gridN * gridN * gridN;
    const R = new Array(size).fill(0);
    const B = new Array(size).fill(0);

    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      if (!p) continue;
      const x = THREE.MathUtils.clamp((p[0] + half) / L, 0, 0.9999999);
      const y = THREE.MathUtils.clamp((p[1] + half) / L, 0, 0.9999999);
      const z = THREE.MathUtils.clamp((p[2] + half) / L, 0, 0.9999999);
      const ix = Math.floor(x * gridN);
      const iy = Math.floor(y * gridN);
      const iz = Math.floor(z * gridN);
      const idx = ix + iy * gridN + iz * gridN * gridN;
      if (colorFlags[i]) R[idx] += 1;
      else B[idx] += 1;
    }

    //Compute local entropies and total
    const S_local = new Array(size);
    let S_total = 0;
    let Smax = 0; // for color normalization

    for (let j = 0; j < size; j++) {
      const n = R[j] + B[j];
      let s = 0;
      if (n > 1 && R[j] > 0 && B[j] > 0) {
        s = lnComb(n, R[j]);
      }
      S_local[j] = s;
      S_total += s;
      if (s > Smax) Smax = s;
    }

    onTotalEntropy?.(S_total);

    // Multi-stop color interpolation between colorStops
    const nStops = colorStops.length - 1;
    for (let j = 0; j < size; j++) {
      const mat = matRefs.current[j];
      if (!mat) continue;

      // Normalize to [0,1]
      const t = Smax > 0 ? S_local[j] / Smax : 0;

      // Piecewise-linear interpolation across stops
      const x = t * nStops;
      const i = Math.min(Math.floor(x), nStops - 1);
      const f = x - i;

      tmpColor.copy(colorStops[i]).lerp(colorStops[i + 1], f);
      mat.color.copy(tmpColor);

      // Keep cells transparent so particles remain visible
      mat.opacity = opacity;
      mat.transparent = true;
    }
  });

  return (
    <group>
      {cells.map((c, i) => (
        <mesh
          key={c.id}
          ref={(el) => (meshRefs.current[i] = el)}
          position={c.pos}
          renderOrder={-1}
        >
          <boxGeometry args={[cellSize, cellSize, cellSize]} />
          <meshBasicMaterial
            ref={(m) => (matRefs.current[i] = m)}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
