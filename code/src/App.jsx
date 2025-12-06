import { useRef, useState, useEffect, Suspense } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  XR,
  createXRStore,
} from "@react-three/xr";
import { OrbitControls, Html } from "@react-three/drei";
import { Physics, RigidBody, CuboidCollider } from "@react-three/rapier";
import ParticleContainer from "./components/ParticleContainer.jsx";
import EntropyGrid from "./components/EntropyGrid.jsx";

/**
 * ------------------------------------------------------------------
 * Base simulation constants (desktop scale)
 * ------------------------------------------------------------------
 * This is the "full size" version of the system:
 * - L is the cube side length in world units
 * - radius is particle radius (same units)
 * - speed is initial particle velocity scale
 *
 * In AR we don't scale the group using <group scale={...}>, because
 * Rapier physics becomes unstable / misaligned with visuals if you
 * scale parents. Instead we derive *smaller numbers* from these
 * base values and pass those smaller numbers directly into the
 * physics world.
 */
const BASE_L = 10;
const BASE_gridN = 4;
const BASE_numRed = 50;
const BASE_numBlue = 50;
const BASE_radius = 0.2;
const BASE_speed = 4.5;
const BASE_wallThickness = 0.05;

/*
 * ------------------------------------------------------------------
 * XR store
 * ------------------------------------------------------------------
 * @react-three/xr uses a store for XR session management.
 * We create one global XR store and pass it into <XR />.
 *
 * - offerSession: false means "don't automatically jump into AR"
 *   when the component mounts. We'll enter AR manually
 *   via xrStore.enterAR() when user taps the button.
 */
const xrStore = createXRStore({
  offerSession: false,
});

/*
 * ------------------------------------------------------------------
 * FixCameraNear
 * ------------------------------------------------------------------
 * In AR mode, objects can be VERY close to the camera.
 * If the camera's near plane is too large (default ~0.1 or 0.2),
 * meshes can get clipped away.
 *
 * We patch the camera every render start (via useEffect) to:
 * - set near = 0.01
 * - set far = 100 (just a sane big-ish number)
 *
 * Then we updateProjectionMatrix() so it's applied.
 *
 * We render this component INSIDE <XR>, so it runs on the XR camera.
 */
function FixCameraNear() {
  const { camera } = useThree();
  useEffect(() => {
    camera.near = 0.01;
    camera.far = 100;
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
}

/**
 * ------------------------------------------------------------------
 * ARHud
 * ------------------------------------------------------------------
 * A floating HUD that sits above the simulation cube IN 3D SPACE.
 *
 * We render it using <Html /> from drei, which places normal HTML/CSS
 * in 3D coordinates. So instead of a fixed screen overlay, it actually
 * hovers over the cube in AR.
 *
 * Props:
 * - S: the current total entropy (number)
 * - Lprop: the cube size currently in use (this is important because
 *   in AR the cube is smaller; we want the HUD just above the top).
 *
 * We position it at y = Lprop/2 + 0.1, which is "slightly above the
 * cube's top face".
 */
function ARHud3D({ S, Lprop }) {
  const panelWidth = 0.5;   // meters
  const panelHeight = 0.28; // meters

  return (
    <group position={[0, Lprop / 2 + 0.2, 0]}>
      {/* background panel */}
      <mesh>
        <planeGeometry args={[panelWidth, panelHeight]} />
        <meshBasicMaterial
          transparent
          opacity={0.6}
          color="black"
        />
      </mesh>

      {/* Title text: "TOTAL ENTROPY" */}
      <Text
        position={[0, 0.05, 0.001]}
        fontSize={0.05}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.007}
        outlineColor="black"
      >
        TOTAL ENTROPY
      </Text>

      {/* Value text: e.g. 2.134 */}
      <Text
        position={[0, -0.03, 0.001]}
        fontSize={0.08}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.01}
        outlineColor="black"
      >
        {S.toFixed(3)}
      </Text>
    </group>
  );
}

/*
 * ------------------------------------------------------------------
 * DesktopHUD
 * ------------------------------------------------------------------
 * A fixed overlay in the corner of the screen (normal HTML).
 * This is visible regardless of AR or desktop right now.
 *
 * Props:
 * - S: the current total entropy
 */
function DesktopHUD({ S }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 16,
        top: 16,
        zIndex: 20,
        background: "rgba(0,0,0,0.5)",
        color: "#fff",
        padding: "10px 12px",
        borderRadius: 12,
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: 14,
          opacity: 0.85,
          letterSpacing: 0.2,
        }}
      >
        TOTAL ENTROPY
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>
        {S.toFixed(3)}
      </div>
      <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
        S = k ln W, k = 1
      </div>
    </div>
  );
}

/*
 * ------------------------------------------------------------------
 * SimulationScene
 * ------------------------------------------------------------------
 * This is the actual physics simulation container.
 *
 * What's inside:
 *  - a wireframe box showing the boundaries
 *  - static Rapier colliders that form the "walls"
 *  - ParticleContainer: renders particles and drives their dynamics
 *  - EntropyGrid: samples particle distribution and computes entropy
 *
 * IMPORTANT:
 * We accept physical dimensions as props:
 *   L, radius, speed, etc.
 *
 * That means:
 * - On desktop, we can pass {L: 10, radius: 0.2, ...}
 * - In AR, we can pass {L: 1, radius: 0.02, ...}
 *
 * So the cube is physically smaller in AR, but physics is still
 * internally consistent (Rapier sim is actually running "small"),
 * with NO parent scaling.
 *
 * `ref` here is passed down so the parent can grab particle positions
 * (for entropy calculation, etc.). In React 19 it's valid to pass
 * ref as just a normal prop.
 */
function SimulationScene({
  onEntropyUpdate,
  ref,
  L = 10,
  gridN = 4,
  numRed = 50,
  numBlue = 50,
  radius = 0.2,
  speed = 4.5,
  wallThickness = 0.05,
}) {
  // Simple wireframe cube to visualize the bounds
  function BoundsWireframe() {
    return (
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[L, L, L]} />
        <meshBasicMaterial wireframe transparent opacity={0.2} />
      </mesh>
    );
  }

  // Invisible physics walls using Rapier colliders.
  // We create 6 thin boxes just outside each face of the cube,
  // so particles bounce instead of leaving.
  function Walls() {
    const t = wallThickness;
    const half = L / 2;
    const ext = [half, t, half];      // for top/bottom walls
    const extX = [t, half, half];     // for left/right walls
    const extZ = [half, half, t];     // for front/back walls
    return (
      <RigidBody type="fixed" restitution={1} friction={0}>
        {/* floor / ceiling */}
        <CuboidCollider args={ext} position={[0, -half - t, 0]} />
        <CuboidCollider args={ext} position={[0, +half + t, 0]} />

        {/* left / right */}
        <CuboidCollider args={extX} position={[-half - t, 0, 0]} />
        <CuboidCollider args={extX} position={[+half + t, 0, 0]} />

        {/* back / front */}
        <CuboidCollider args={extZ} position={[0, 0, -half - t]} />
        <CuboidCollider args={extZ} position={[0, 0, +half + t]} />
      </RigidBody>
    );
  }

  return (
    <Physics gravity={[0, 0, 0]} timeStep="vary">
      {/* Draws the boundary cube */}
      <BoundsWireframe />

      {/* Adds the 6 rapier colliders so particles bounce */}
      <Walls />

      {/**
       * ParticleContainer:
       * - Creates the red/blue particles and simulates their motion.
       * - Exposes methods on `ref` like getPositions() / getColorFlags()
       *   so EntropyGrid can read current state.
       *
       * NOTE:
       * For AR stability:
       *   - If ParticleContainer uses instancedMesh, make sure
       *     instancedMesh.frustumCulled = false, so WebGL doesn't
       *     cull them away when they're small / close.
       */}
      <ParticleContainer
        ref={ref}
        L={L}
        radius={radius}
        numRed={numRed}
        numBlue={numBlue}
        speed={speed}
      />

      {/**
       * EntropyGrid:
       * - Splits the cube into grid cells
       * - Checks how mixed red/blue is in each region
       * - Computes total entropy and calls onEntropyUpdate(S)
       */}
      <EntropyGrid
        L={L}
        gridN={gridN}
        getParticlePositions={() => ref.current?.getPositions?.()}
        getColorFlags={() => ref.current?.getColorFlags?.()}
        onTotalEntropy={onEntropyUpdate}
        opacity={0.1}
      />
    </Physics>
  );
}

/*
 * ------------------------------------------------------------------
 * SceneManager
 * ------------------------------------------------------------------
 * This component renders EITHER:
 *  - Desktop view: big cube at origin + OrbitControls
 *  - AR view: small cube in front of the camera
 *
 * We DO NOT check XR session mode inside this component anymore.
 * Instead, App passes in `isAR` as a prop.
 *
 * Why?
 * - Depending only on the XR internal store sometimes doesn't flip
 *   fast enough or consistently across browsers.
 * - But <XR onSessionStart> in App is guaranteed to tell us.
 *
 * Logic:
 * - if isAR === false:
 *    k = 1.0 → use full BASE_* values
 *    show OrbitControls
 *    place SimulationScene at world origin
 *
 * - if isAR === true:
 *    k = 0.1 → 10x smaller physics box
 *    NO parent scale!
 *    place SimulationScene at [0, 1, -1] relative to the AR camera
 *    (which usually means "1 meter in front and 1 meter up")
 *
 * Props:
 * - S: current entropy (number)
 * - onEntropyUpdate: setter for entropy
 * - isAR: boolean from App
 */
function SceneManager({ S, onEntropyUpdate, isAR }) {
  const particlesRef = useRef(null);

  // Size factor: 1.0 on desktop, 0.1 in AR.
  // We multiply all the physical params by k.
  const k = isAR ? 0.1 : 1.0;

  // These params are passed into SimulationScene.
  // For AR, everything is smaller so the whole cube is ~1m instead of ~10m.
  const simParams = {
    L: BASE_L * k,
    gridN: BASE_gridN,
    numRed: BASE_numRed,
    numBlue: BASE_numBlue,
    radius: BASE_radius * k,
    speed: BASE_speed * k,
    wallThickness: BASE_wallThickness * k,
  };

  return (
    <>
      {/* Basic lighting shared by both modes */}
      <hemisphereLight intensity={0.6} />
      <directionalLight position={[10, 12, 8]} intensity={1.2} castShadow />

      {isAR ? (
        /**
         * --------------------
         * AR MODE
         * --------------------
         * We position the entire simulation group relative to the AR camera:
         *   <group position={[0, 1, -1]}>
         * means: 1 meter in front (-Z in camera space) and 1m "up".
         *
         * Note:
         * We're NOT scaling this group.
         * The cube is already small because simParams.L etc. are small.
         */
        <group position={[0, 1, -1]}>
          <SimulationScene
            ref={particlesRef}
            onEntropyUpdate={onEntropyUpdate}
            {...simParams}
          />
          {/* Floating HUD in AR space, above the cube */}
          <ARHud3D S={S} Lprop={simParams.L} />
        </group>
      ) : (
        /**
         * --------------------
         * DESKTOP MODE
         * --------------------
         * We show OrbitControls for mouse/touch orbiting,
         * and we render the full-sized simulation at the origin.
         */
        <>
          <OrbitControls enableDamping dampingFactor={0.1} />
          <Suspense fallback={null}>
            <SimulationScene
              ref={particlesRef}
              onEntropyUpdate={onEntropyUpdate}
              {...simParams}
            />
          </Suspense>
        </>
      )}
    </>
  );
}

/*
 * ------------------------------------------------------------------
 * App
 * ------------------------------------------------------------------
 * This is the root component.
 *
 * Responsibilities:
 * - Holds the entropy state `S`
 * - Holds `isAR`, which tracks whether we're currently in an AR session
 * - Renders the <Canvas> with <XR> inside
 * - Shows a button that calls xrStore.enterAR()
 *
 * How AR mode is detected:
 * - We give <XR> two callbacks:
 *    onSessionStart  → setIsAR(true)
 *    onSessionEnd    → setIsAR(false)
 *
 * That means:
 * - As soon as the browser actually *enters* immersive AR,
 *   isAR = true, which shrinks the sim (k = 0.1).
 * - When AR session ends, isAR = false, which restores desktop scale.
 *
 * Very important:
 * We are requesting AR with no optional features like hit-test.
 * This means we just "float" the cube in front of the camera,
 * instead of placing it on a detected real-world plane.
 */
export default function App() {
  const [S, setS] = useState(0);      // total entropy
  const [isAR, setIsAR] = useState(false); // are we currently in AR session?

  // Called when user taps "Enter AR"
  // We ask the XR store to start an immersive-ar session.
  // If the browser/device doesn't support it, this will throw and
  // we just log the error.
  async function handleEnterAR() {
    try {
      await xrStore.enterAR({
        requiredFeatures: [],   // we don't force any specific AR feature
        optionalFeatures: [],   // we also don't request hit-test etc.
      });
    } catch (err) {
      console.error("Failed to start AR session:", err);
    }
  }

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        background: "#0b1020",
        overflow: "hidden",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Screen overlay HUD (desktop-style).
         We keep it always visible for simplicity. */}
      <DesktopHUD S={S} />

      {/* Button that manually requests AR session from the browser/OS */}
      <button
        style={{
          position: "absolute",
          bottom: 20,
          right: 20,
          zIndex: 100,
          padding: "12px 16px",
          background: "#fff",
          color: "#000",
          border: "none",
          borderRadius: 8,
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
        }}
        onClick={handleEnterAR}
      >
        Enter AR
      </button>

      {/* Shared render surface for both desktop and AR */}
      <Canvas
        camera={{
          position: [BASE_L * 1.4, BASE_L * 1.2, BASE_L * 1.4],
          fov: 50,
        }}
        shadows
      >
        {/* Desktop background color. In AR, the XR layer will
           typically show passthrough camera instead, so this won't matter. */}
        <color attach="background" args={["#0b1020"]} />

        {/* XR wraps the scene and manages the WebXR session.
           We pass the store we created above.
           We also listen for session start/end so we can flip isAR. */}
        <XR
          store={xrStore}
          onSessionStart={() => setIsAR(true)}
          onSessionEnd={() => setIsAR(false)}
        >
          {/* Fix near/far plane for close-up AR content */}
          <FixCameraNear />

          {/* Render the simulation. We tell it whether we're in AR,
             so it knows to spawn the "small" version in front of the camera. */}
          <SceneManager S={S} onEntropyUpdate={setS} isAR={isAR} />
        </XR>
      </Canvas>
    </div>
  );
}
