## ENTROPY

This React project is an interactive 3D/AR physics simulation that visualizes how entropy evolves in a closed system. Inside a cubic box, red and blue particles bounce around with zero gravity; their spatial mixing is sampled on a grid to compute a total entropy value, which is displayed both as a desktop HUD overlay and, in AR mode, as a floating panel above the cube. Users can view the simulation on a normal screen with orbit controls or enter an immersive AR session where the cube appears in front of the camera.



https://github.com/user-attachments/assets/32f4d57f-5a2d-4c55-a09e-de479ab7d7e9


### Running the project

1. **Download the project**
  Either clone the repository `git clone https://github.com/saskaZs/entropy.git` or download it as a ZIP and extract it.
  Go into the code folder `cd entropy/code`
  
2. **Install dependencies**
Make sure you have Node.js, then run `npm install`

3. **Run the development server**
`npm run dev`
   
---
The simulation implements a **simplified gas-in-a-box model** combined with a **discrete Shannon-entropy calculation** for the mixing of two particle “species” (red and blue).

#### 1. Particle Dynamics

Each particle has a **position** `x(t)` and **velocity** `v(t)`.

Between collisions, motion follows Newton’s equations of motion with no external forces:

- `v(t + dt) = v(t)`
- `x(t + dt) = x(t) + v(t) * dt`

Particles move inside a rigid cubic container represented by static colliders represented by the six walls.  
When a particle hits a wall, the physics engine applies a perfectly elastic collision: the component of the velocity vector along the wall normal is flipped, while the tangential components are preserved.

In vector form, you can think of it as:

- `v' = v - 2 * (v · n) * n`

where `n` is the unit normal vector of the wall.

Collisions between particles are treated as collisions of equal-mass rigid bodies, approximately conserving momentum and kinetic energy.

At the microscopic level, this behaves like a hard-sphere gas in a box with elastic bounces.

---

#### 2. Entropy Calculation

The cube is subdivided into a regular 3D grid of cells. On each animation frame:

1. For every cell `c`, count how many red and blue particles it contains:  
   - `n_red,c`, `n_blue,c`  
   - total: `n_c = n_red,c + n_blue,c`

2. If `n_c > 0`, compute local probabilities:
   - `p_red,c = n_red,c / n_c`  
   - `p_blue,c = n_blue,c / n_c`

3. Compute the local Shannon entropy of mixing for each cell:

   - `S_c = - ( p_red,c * ln(p_red,c) + p_blue,c * ln(p_blue,c) )`  
   - with the convention that `p * ln(p) = 0` when `p = 0`.

4. Aggregate over all non-empty cells to obtain the total entropy:

   - `S_total = (1 / N_cells*) * Σ_c S_c`  

   where `N_cells*` is the number of non-empty cells. `S_total` increases as the system becomes more mixed.

