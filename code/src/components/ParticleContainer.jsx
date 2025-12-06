import React, { useMemo, useRef, forwardRef, useImperativeHandle } from "react";
import { RigidBody, BallCollider } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";


// Utility: uniform random in [min, max]
const rand = (min, max) => Math.random() * (max - min) + min;


// Try to spawn non-overlapping particles quickly (best-effort)
function generateInitialParticles({ L, radius, numRed, numBlue, speed }) {
    const total = numRed + numBlue;
    const particles = [];
    const half = L / 2 - radius * 1.1; // keep away from walls slightly
    const maxTries = 5000;


    // naive Poisson-like rejection sampling
    let tries = 0;
    while (particles.length < total && tries < maxTries) {
        tries++;
        const p = {
            position: [rand(-half, half), rand(-half, half), rand(-half, half)],
            velocity: (() => {
                // random direction with fixed speed
                const theta = Math.acos(rand(-1, 1));
                const phi = rand(0, 2 * Math.PI);
                const sx = speed * Math.sin(theta) * Math.cos(phi);
                const sy = speed * Math.cos(theta);
                const sz = speed * Math.sin(theta) * Math.sin(phi);
            return [sx, sy, sz];
            })(),

            color: particles.length < numRed ? "#ff4040" : "#4aa3ff",
            isRed: particles.length < numRed,
        };

        // check overlap with already placed
        let ok = true;

        for (let i = 0; i < particles.length; i++) {
            const q = particles[i];
            const dx = p.position[0] - q.position[0];
            const dy = p.position[1] - q.position[1];
            const dz = p.position[2] - q.position[2];
            if (dx * dx + dy * dy + dz * dz < (2 * radius) * (2 * radius)) { ok = false; break; }
        
        }

        if (ok) particles.push(p);
    }


    // If we failed to place all, fill remaining without rejection (Rapier will resolve fast)
    while (particles.length < total) {
        particles.push({
            position: [rand(-half, half), rand(-half, half), rand(-half, half)],
            velocity: [rand(-speed, speed), rand(-speed, speed), rand(-speed, speed)],
            color: particles.length < numRed ? "#ff4040" : "#4aa3ff",
            isRed: particles.length < numRed,
        });
    }


    return particles;
}


const ParticleContainer = forwardRef(function ParticleContainer({ L, radius = 0.2, numRed = 50, numBlue = 50, speed = 3 }, ref) {
const init = useMemo(() => generateInitialParticles({ L, radius, numRed, numBlue, speed }), [L, radius, numRed, numBlue, speed]);


// Store rigid body refs and current world positions
const bodyRefs = useRef([]);
const positionsRef = useRef(new Array(init.length).fill([0, 0, 0]));
const colorFlagsRef = useRef(init.map(p => p.isRed)); // boolean isRed per particle


useImperativeHandle(ref, () => ({getPositions: () => positionsRef.current,
    getColorFlags: () => colorFlagsRef.current,
}), []);


useFrame(() => {
    // Pull world-space positions from Rapier each frame without re-rendering React
    for (let i = 0; i < bodyRefs.current.length; i++) {
        const rb = bodyRefs.current[i];
        if (!rb) continue;
        const t = rb.translation();
        positionsRef.current[i] = [t.x, t.y, t.z];
    }
});


return (
    <group>
        {init.map((p, i) => (
            <RigidBody
                key={i}
                ref={el => (bodyRefs.current[i] = el)}
                colliders={false}
                linearDamping={0}
                angularDamping={0}
                canSleep={false}
                position={p.position}
                linearVelocity={p.velocity}
            >
                <BallCollider args={[radius]} restitution={1} friction={0} />
                <mesh castShadow receiveShadow>
                    <sphereGeometry args={[radius, 24, 24]} />
                    <meshStandardMaterial metalness={0.1} roughness={0.4} color={p.color} />
                </mesh>
            </RigidBody>
        ))}
    </group>
    );
});


export default ParticleContainer;