import React, { useRef, useEffect, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, ContactShadows, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { JointState, SimObject, SimStats, RobotCommand } from '../types';

// Robot Geometry Constants
const TORSO_DIMS = [0.4, 0.15, 0.6]; // Width, Height, Length
const LEG_WIDTH = 0.08;
const UPPER_LEG_LEN = 0.3;
const LOWER_LEG_LEN = 0.3;

// Movement & Physics Constants
const MOVE_SPEED = 1.5;
const ROT_SPEED = 2.0;
const GAIT_FREQ = 12;
const GAIT_AMP = 0.4;
const GRAVITY = 20.0;
const JUMP_FORCE = 8.0; // Slightly increased for better feel
const GROUND_Y = 0.55;
const ROBOT_COLLISION_RADIUS = 0.35;
const OBJECT_COLLISION_RADIUS = 0.25;
const COLLISION_DIST = ROBOT_COLLISION_RADIUS + OBJECT_COLLISION_RADIUS;

// Shared type for position tracking
type ObjectTracker = React.MutableRefObject<Map<string, THREE.Vector3>>;

interface RobotProps {
  baseJoints: JointState;
  onUpdateStats?: (stats: SimStats) => void;
  commandQueue: RobotCommand[];
  onUpdateJoints: (joints: JointState) => void;
  onClearQueue: () => void;
  objectTracker: ObjectTracker;
}

const Leg = ({ 
  side, 
  pos, 
  hipAngle, 
  thighAngle, 
  calfAngle 
}: { 
  side: string, 
  pos: [number, number, number], 
  hipAngle: number, 
  thighAngle: number, 
  calfAngle: number 
}) => {
  const hipRef = useRef<THREE.Group>(null);
  const thighRef = useRef<THREE.Group>(null);
  const calfRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    // Smooth interpolation for visual fidelity
    const damp = 20 * delta;
    if (hipRef.current) hipRef.current.rotation.x = THREE.MathUtils.lerp(hipRef.current.rotation.x, hipAngle, damp);
    if (thighRef.current) thighRef.current.rotation.z = THREE.MathUtils.lerp(thighRef.current.rotation.z, thighAngle, damp);
    if (calfRef.current) calfRef.current.rotation.z = THREE.MathUtils.lerp(calfRef.current.rotation.z, calfAngle, damp);
  });

  return (
    <group position={pos}>
      {/* Hip Joint (Roll) */}
      <group ref={hipRef}>
        <mesh position={[side === 'left' ? 0.05 : -0.05, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.1]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
        
        {/* Thigh Joint (Pitch) */}
        <group position={[side === 'left' ? 0.1 : -0.1, 0, 0]} ref={thighRef}>
          <mesh position={[0, -UPPER_LEG_LEN / 2, 0]}>
            <capsuleGeometry args={[LEG_WIDTH/2, UPPER_LEG_LEN - LEG_WIDTH, 4, 8]} />
            <meshStandardMaterial color="#64748b" />
          </mesh>

          {/* Calf Joint (Pitch) */}
          <group position={[0, -UPPER_LEG_LEN, 0]} ref={calfRef}>
            <mesh position={[0, -LOWER_LEG_LEN / 2, 0]}>
              <capsuleGeometry args={[LEG_WIDTH/2.5, LOWER_LEG_LEN - LEG_WIDTH, 4, 8]} />
              <meshStandardMaterial color="#94a3b8" />
            </mesh>
            {/* Foot */}
            <mesh position={[0, -LOWER_LEG_LEN, 0]}>
              <sphereGeometry args={[0.05]} />
              <meshStandardMaterial color="#334155" />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
};

const RobotController: React.FC<RobotProps> = ({ baseJoints, onUpdateStats, commandQueue, onUpdateJoints, onClearQueue, objectTracker }) => {
  const groupRef = useRef<THREE.Group>(null);
  
  // Physics State - Start high to demonstrate gravity
  const position = useRef(new THREE.Vector3(0, 2.0, 0)); 
  const rotation = useRef(0); // Yaw
  const verticalVel = useRef(0);
  
  // Command Execution State
  const cmdIndexRef = useRef(0);
  const cmdStartTimeRef = useRef(0);
  const isExecutingRef = useRef(false);
  const lastQueueLengthRef = useRef(0);
  
  // Input State
  const keys = useRef<{ [key: string]: boolean }>({});

  const [renderedJoints, setRenderedJoints] = useState(baseJoints);

  useEffect(() => {
     if (commandQueue.length > 0 && commandQueue.length !== lastQueueLengthRef.current) {
        cmdIndexRef.current = 0;
        cmdStartTimeRef.current = 0; 
        isExecutingRef.current = true;
     } else if (commandQueue.length === 0) {
        isExecutingRef.current = false;
     }
     lastQueueLengthRef.current = commandQueue.length;
  }, [commandQueue]);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => { keys.current[e.code] = true; };
    const onUp = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    let forward = 0;
    let turn = 0;
    let jump = false;
    let activeDesc = "";

    // --- COMMAND EXECUTION LOGIC ---
    if (isExecutingRef.current && cmdIndexRef.current < commandQueue.length) {
      const cmd = commandQueue[cmdIndexRef.current];
      const now = state.clock.elapsedTime;
      
      if (cmdStartTimeRef.current === 0) {
        cmdStartTimeRef.current = now;
        if (cmd.type === 'SET_JOINTS' && cmd.targetJoints) {
           onUpdateJoints(cmd.targetJoints);
           cmdIndexRef.current++;
           cmdStartTimeRef.current = 0;
           return;
        }
        if (cmd.type === 'JUMP') {
          jump = true;
          cmdIndexRef.current++;
          cmdStartTimeRef.current = 0;
        }
      }

      if (cmd.type !== 'SET_JOINTS' && cmd.type !== 'JUMP') {
         const elapsed = now - cmdStartTimeRef.current;
         const duration = cmd.duration || 1.0;
         activeDesc = cmd.description || cmd.type;

         if (elapsed < duration) {
            if (cmd.type === 'MOVE_FORWARD') forward = 1;
            if (cmd.type === 'MOVE_BACKWARD') forward = -1;
            if (cmd.type === 'TURN_LEFT') turn = 1;
            if (cmd.type === 'TURN_RIGHT') turn = -1;
         } else {
            cmdIndexRef.current++;
            cmdStartTimeRef.current = 0;
         }
      }
    } else if (isExecutingRef.current && cmdIndexRef.current >= commandQueue.length) {
       isExecutingRef.current = false;
       onClearQueue();
    }

    if (!isExecutingRef.current) {
      const k = keys.current;
      if (k['KeyW'] || k['ArrowUp']) forward = 1;
      if (k['KeyS'] || k['ArrowDown']) forward = -1;
      if (k['KeyA'] || k['ArrowLeft']) turn = 1;
      if (k['KeyD'] || k['ArrowRight']) turn = -1;
      if (k['KeyJ']) jump = true;
    }

    const isMoving = forward !== 0 || turn !== 0;

    // --- PHYSICS UPDATE ---

    // 1. Rotation
    if (turn !== 0) {
      rotation.current += turn * ROT_SPEED * delta;
    }

    // 2. Horizontal Movement & 3D Collision Detection
    if (forward !== 0) {
      const dirX = Math.sin(rotation.current);
      const dirZ = Math.cos(rotation.current);
      const moveDist = forward * MOVE_SPEED * delta;
      
      const nextX = position.current.x + dirX * moveDist;
      const nextZ = position.current.z + dirZ * moveDist;

      // Check against all dynamic objects
      let collision = false;
      const robotHeight = TORSO_DIMS[1] + 0.1; // Approx height for overlap check
      
      for (const objPos of objectTracker.current.values()) {
        const dx = nextX - objPos.x;
        const dz = nextZ - objPos.z;
        const distSq = dx*dx + dz*dz;
        
        if (distSq < COLLISION_DIST**2) {
           // Check Vertical Overlap
           // Robot is at position.current.y (center of torso). 
           // Object is at objPos.y (center of cube). 
           // Box height 0.3, Robot height ~0.6 from ground.
           const yDiff = Math.abs(position.current.y - objPos.y);
           // Simple overlap check: sum of half heights
           if (yDiff < 0.5) { 
             collision = true;
             break;
           }
        }
      }

      if (!collision) {
        position.current.x = nextX;
        position.current.z = nextZ;
      }
    }

    // 3. Vertical Movement (Jump/Gravity)
    const onGround = position.current.y <= GROUND_Y + 0.01;

    if (jump && onGround) {
      verticalVel.current = JUMP_FORCE;
    }

    // Apply Gravity
    verticalVel.current -= GRAVITY * delta;
    position.current.y += verticalVel.current * delta;

    // Floor Constraint
    if (position.current.y < GROUND_Y) {
      position.current.y = GROUND_Y;
      verticalVel.current = 0;
    }

    // --- VISUAL UPDATE ---
    groupRef.current.position.copy(position.current);
    groupRef.current.rotation.y = rotation.current;

    // --- ANIMATION UPDATE ---
    const time = state.clock.elapsedTime;
    const nextJoints = { ...baseJoints };
    const isInAir = position.current.y > GROUND_Y + 0.1;

    if (isInAir) {
      const jumpTuck = { thigh: 0.8, calf: -1.8 };
      ['FL', 'FR', 'BL', 'BR'].forEach(leg => {
        nextJoints[`${leg}_thigh`] = jumpTuck.thigh;
        nextJoints[`${leg}_calf`] = jumpTuck.calf;
      });
    } 
    else if (isMoving) {
      const p1 = Math.sin(time * GAIT_FREQ);
      const p2 = Math.sin(time * GAIT_FREQ + Math.PI); 
      nextJoints.FL_thigh += p1 * GAIT_AMP; nextJoints.BR_thigh += p1 * GAIT_AMP;
      nextJoints.FR_thigh += p2 * GAIT_AMP; nextJoints.BL_thigh += p2 * GAIT_AMP;
      const l1 = Math.max(0, p1) * 0.5; const l2 = Math.max(0, p2) * 0.5;
      nextJoints.FL_calf -= l1; nextJoints.BR_calf -= l1;
      nextJoints.FR_calf -= l2; nextJoints.BL_calf -= l2;
    }

    setRenderedJoints(nextJoints);
  
    if (onUpdateStats) {
      onUpdateStats({
        position: { x: position.current.x, y: position.current.y, z: position.current.z },
        velocity: isMoving ? MOVE_SPEED : 0,
        rotation: rotation.current,
        isMoving,
        currentAction: activeDesc
      });
    }
  });

  return (
    <group ref={groupRef}> 
      {/* Torso */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[TORSO_DIMS[0], TORSO_DIMS[1], TORSO_DIMS[2]]} />
        <meshStandardMaterial color="#3b82f6" roughness={0.3} metalness={0.8} />
      </mesh>
      
      <mesh position={[0, 0.1, 0.25]}>
         <boxGeometry args={[0.2, 0.1, 0.15]} />
         <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0, 0.1, 0.33]}>
         <planeGeometry args={[0.18, 0.08]} />
         <meshBasicMaterial color="#000" />
      </mesh>

      <Leg side="left" pos={[0.2, -0.05, 0.25]} 
           hipAngle={renderedJoints.FL_hip} thighAngle={renderedJoints.FL_thigh} calfAngle={renderedJoints.FL_calf} />
      <Leg side="right" pos={[-0.2, -0.05, 0.25]} 
           hipAngle={renderedJoints.FR_hip} thighAngle={renderedJoints.FR_thigh} calfAngle={renderedJoints.FR_calf} />
      <Leg side="left" pos={[0.2, -0.05, -0.25]} 
           hipAngle={renderedJoints.BL_hip} thighAngle={renderedJoints.BL_thigh} calfAngle={renderedJoints.BL_calf} />
      <Leg side="right" pos={[-0.2, -0.05, -0.25]} 
           hipAngle={renderedJoints.BR_hip} thighAngle={renderedJoints.BR_thigh} calfAngle={renderedJoints.BR_calf} />
    </group>
  );
};

// Component for physical objects that fall
const RigidBodyObject: React.FC<{ obj: SimObject; tracker: ObjectTracker }> = ({ obj, tracker }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const velocity = useRef(0);
  const pos = useRef(new THREE.Vector3(obj.position.x, obj.position.y, obj.position.z));
  
  // Sync if parent updates (e.g. reset)
  useEffect(() => {
     pos.current.set(obj.position.x, obj.position.y, obj.position.z);
     velocity.current = 0;
     tracker.current.set(obj.id, pos.current); // Initial register
  }, [obj.position, obj.id, tracker]);

  useFrame((_, delta) => {
     if (!meshRef.current) return;
     
     // Only apply physics if in the air (Optimization)
     if (pos.current.y > 0.1501 || Math.abs(velocity.current) > 0.01) {
        
        velocity.current -= GRAVITY * delta;
        pos.current.y += velocity.current * delta;
        
        // Floor Collision (Cube half-height 0.15)
        if (pos.current.y < 0.15) {
           pos.current.y = 0.15;
           velocity.current = -velocity.current * 0.4; // Restitution (Bounciness)
           if (Math.abs(velocity.current) < 0.5) velocity.current = 0;
        }
        
        // Update tracker for collision
        tracker.current.set(obj.id, pos.current);
     }
     
     meshRef.current.position.copy(pos.current);
  });

  return (
    <mesh ref={meshRef} position={[pos.current.x, pos.current.y, pos.current.z]} castShadow>
      <boxGeometry args={[0.3, 0.3, 0.3]} />
      <meshStandardMaterial color={obj.color} />
    </mesh>
  );
};

interface SceneProps {
  joints: JointState;
  objects: SimObject[];
  onUpdateStats?: (stats: SimStats) => void;
  commandQueue: RobotCommand[];
  onUpdateJoints: (joints: JointState) => void;
  onClearQueue: () => void;
}

const SceneContent = (props: SceneProps) => {
  // Shared tracker for collision detection
  const objectTracker = useRef(new Map<string, THREE.Vector3>());

  return (
    <>
      <RobotController 
        baseJoints={props.joints}
        // objects={props.objects} // No longer used for collision directly
        objectTracker={objectTracker}
        onUpdateStats={props.onUpdateStats}
        commandQueue={props.commandQueue}
        onUpdateJoints={props.onUpdateJoints}
        onClearQueue={props.onClearQueue}
      />
      
      {props.objects.map((obj) => (
        <RigidBodyObject key={obj.id} obj={obj} tracker={objectTracker} />
      ))}
      
      <Grid 
        infiniteGrid 
        fadeDistance={20} 
        sectionColor="#4f4f4f" 
        cellColor="#2f2f2f" 
        position={[0, -0.01, 0]}
      />
      <ContactShadows opacity={0.5} scale={10} blur={2.5} far={4} />
      <Environment preset="city" />
    </>
  );
};

export const SimulationCanvas: React.FC<SceneProps> = (props) => {
  return (
    <div className="w-full h-full bg-slate-900 rounded-lg overflow-hidden border border-slate-700 shadow-2xl relative outline-none" tabIndex={0}>
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[3, 2, 3]} fov={50} />
        <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
        <SceneContent {...props} />
      </Canvas>
    </div>
  );
};