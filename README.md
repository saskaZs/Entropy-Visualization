# 🔴🔵 ENTROPY – Interactive Entropy Simulation

An educational 3D (and AR-capable) simulation demonstrating the **irreversible increase of entropy** in a closed system, inspired by the classic thought experiment of mixing two types of gas particles.

Red and blue particles bounce elastically inside a cubic box with no external forces. Over time, they mix irreversibly — entropy rises from near zero (ordered/separated state) to maximum (fully mixed).

The simulation calculates and displays **Shannon entropy** in real-time based on spatial distribution, making the Second Law of Thermodynamics visually intuitive.


https://github.com/user-attachments/assets/32f4d57f-5a2d-4c55-a09e-de479ab7d7e9


---

## 🚀 Features

- **Realistic Physics:** Elastic collisions between particles and walls (conservation of momentum and energy).
- **Entropy Calculation:** Space divided into 3D grid cells; Shannon entropy computed from red/blue ratios per cell.
- **Real-Time HUD:** Current entropy value displayed (desktop) or floating panel (AR).
- **AR Support:** View the simulation in augmented reality on supported devices.
- **Adjustable Parameters:** Particle count, speed, box size, grid resolution (configurable in code).
- **No External Forces:** Purely statistical mechanics — demonstrates spontaneous entropy increase.

---

## 📂 Project Structure
`eslint.config.js`            # ESLint configuration for code quality and React hooks <br>
`index.html`                  # HTML entry point with meta, Launchar SDK script, and root div<br>
`package.json`                # Dependencies (R3F, Rapier, XR, stdlib gammaln) and scripts<br>
`package-lock.json`           # Locked dependency versions

`main.jsx`                # React entry: renders <App /> with StrictMode<br>
`index.css`               # Global styles for layout and dark theme<br>
`App.jsx`                 # Main app: XR store, Canvas setup, Physics, ParticleContainer, EntropyGrid, AR button<br>

`EntropyGrid.jsx`     # Grid visualization and entropy calculation (uses gammaln for ln!)<br>
`ParticleContainer.jsx` # Particle spawning, RigidBody setup, position polling for entropy<br>

---

## 🧠 Theoretical Background

This simulation visualizes one of the most profound concepts in physics: **the Second Law of Thermodynamics**.

### 1. Macrostate vs. Microstate
- Initially, all red particles on one side, blue on the other → highly ordered **macrostate**.
- Many possible **microstates** (particle positions/velocities) correspond to separated state → low multiplicity.
- Fully mixed state has vastly more microstates → high multiplicity.

### 2. Entropy Definition (Boltzmann)
$$ S = k \cdot \ln W $$
- $k$: Boltzmann constant
- $W$: number of microstates corresponding to the macrostate

Higher $W$ → higher entropy. The system naturally evolves toward states with maximum $W$.

### 3. Shannon Entropy (Used in Simulation)
Since exact $W$ is computationally infeasible, we approximate using **spatial Shannon entropy**: $$H = - \sum_{i} p_i \log_2 p_i$$
- Grid divides space into cells.
- $p_i$: fraction of red (or blue) particles in cell $i$.
- Averaged over all cells → global entropy measure.

$H = 0$ when particles are perfectly separated (pure cells).  
$H = 1$ (maximum) when perfectly mixed (50/50 in every cell).

### 4. Irreversibility
Even though individual collisions are time-reversible, the overwhelming statistical preference for high-entropy states makes return to ordered state practically impossible.

This is why "unmixing" gases spontaneously never happens — even though it's not forbidden by Newton's laws.

---

## 📦 Installation & Running

### Prerequisites
- Node.js (v16+ recommended)

### Steps
```bash
cd code/entropy
npm install
npm run dev
```

