import React, { useState, useEffect, useCallback } from 'react';
import { SimulationCanvas } from './components/SimulationCanvas';
import { ControlPanel } from './components/ControlPanel';
import { INITIAL_JOINTS, JointState, SimObject, SimStats, RobotCommand } from './types';

// Initial Objects in the scene - Spawning high for gravity drop
const INITIAL_OBJECTS: SimObject[] = [
  { id: 'cube_red', name: 'Red Cube', color: '#ef4444', position: { x: 2.0, y: 5.0, z: 2.0 } },
  { id: 'cube_blue', name: 'Blue Cube', color: '#3b82f6', position: { x: -2.0, y: 4.0, z: 2.0 } },
  { id: 'cube_green', name: 'Green Cube', color: '#22c55e', position: { x: 0, y: 3.0, z: -3.0 } },
];

const App: React.FC = () => {
  const [joints, setJoints] = useState<JointState>(INITIAL_JOINTS);
  const [objects, setObjects] = useState<SimObject[]>(INITIAL_OBJECTS);
  const [commandQueue, setCommandQueue] = useState<RobotCommand[]>([]);
  
  // Simulation Statistics for HUD
  const [simStats, setSimStats] = useState<SimStats>({
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    velocity: 0,
    isMoving: false
  });

  // Optimize stats update to prevent React render thrashing (optional, but good practice)
  const handleStatsUpdate = useCallback((stats: SimStats) => {
    // Only update React state if strictly necessary or at a lower rate if performance suffers.
    // For this simple app, 60fps React updates for a small HUD is usually fine.
    setSimStats(stats);
  }, []);

  const handleResetSimulation = () => {
    // Deep copy to ensure fresh physics state (positions)
    setObjects(JSON.parse(JSON.stringify(INITIAL_OBJECTS)));
    setJoints(INITIAL_JOINTS);
    setCommandQueue([]);
  };

  return (
    <div className="flex w-screen h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Main Visualizer Area (2/3 width) */}
      <div className="flex-1 p-4 flex flex-col min-w-0">
        <header className="mb-4 flex items-center justify-between">
          <div>
             <h1 className="text-2xl font-black tracking-tight text-white">MUJOCO<span className="text-blue-500">.SIM</span></h1>
             <p className="text-sm text-slate-400">12-DOF Quadruped • Gemini AI Controller</p>
          </div>
          <div className="flex gap-4 text-xs text-slate-500 font-mono">
            <div>
              <span className="block text-slate-700 uppercase">Input</span>
              <span className="text-green-500">KEYBOARD ACTIVE</span>
            </div>
            <div>
              <span className="block text-slate-700 uppercase">Physics</span>
              <span className="text-blue-500">GRAVITY ON</span>
            </div>
            {commandQueue.length > 0 && (
               <div>
                  <span className="block text-slate-700 uppercase">AI Plan</span>
                  <span className="text-purple-400 animate-pulse">{commandQueue.length} Steps</span>
               </div>
            )}
          </div>
        </header>
        
        <div className="flex-1 relative min-h-0">
           <SimulationCanvas 
              joints={joints} 
              objects={objects} 
              onUpdateStats={handleStatsUpdate}
              commandQueue={commandQueue}
              onUpdateJoints={setJoints}
              onClearQueue={() => setCommandQueue([])}
           />
           
           {/* Overlay HUD */}
           <div className="absolute top-4 left-4 pointer-events-none space-y-1">
              <div className="bg-black/60 backdrop-blur px-3 py-1.5 rounded border border-white/10 text-xs font-mono text-white flex gap-4">
                <span className="text-slate-400">POS</span>
                <span>
                  [{simStats.position.x.toFixed(2)}, {simStats.position.y.toFixed(2)}, {simStats.position.z.toFixed(2)}]
                </span>
              </div>
              <div className="bg-black/60 backdrop-blur px-3 py-1.5 rounded border border-white/10 text-xs font-mono text-white flex gap-4">
                <span className="text-slate-400">ROT</span>
                <span>{(simStats.rotation * 180 / Math.PI).toFixed(0)}°</span>
              </div>
              <div className="bg-black/60 backdrop-blur px-3 py-1.5 rounded border border-white/10 text-xs font-mono text-white flex gap-4">
                <span className="text-slate-400">VEL</span>
                <span>{simStats.velocity.toFixed(2)} m/s</span>
              </div>
           </div>
           
           {/* Current Action Toast */}
           {simStats.currentAction && (
             <div className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-none">
                <div className="bg-purple-600/90 text-white px-4 py-2 rounded-full shadow-lg border border-purple-400/50 backdrop-blur flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                   <span className="text-xs font-bold uppercase tracking-wide">{simStats.currentAction}</span>
                </div>
             </div>
           )}
           
           <div className="absolute bottom-4 left-4 pointer-events-none">
              <div className="bg-black/40 p-2 rounded border border-white/5 backdrop-blur">
                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Controls</div>
                <div className="grid grid-cols-3 gap-1 text-center w-24 mb-2">
                   <div></div>
                   <div className={`w-8 h-8 rounded border flex items-center justify-center text-xs font-bold ${simStats.isMoving ? 'border-blue-500 bg-blue-500/20 text-white' : 'border-slate-600 text-slate-500'}`}>W</div>
                   <div></div>
                   <div className={`w-8 h-8 rounded border flex items-center justify-center text-xs font-bold ${simStats.isMoving ? 'border-blue-500 bg-blue-500/20 text-white' : 'border-slate-600 text-slate-500'}`}>A</div>
                   <div className={`w-8 h-8 rounded border flex items-center justify-center text-xs font-bold ${simStats.isMoving ? 'border-blue-500 bg-blue-500/20 text-white' : 'border-slate-600 text-slate-500'}`}>S</div>
                   <div className={`w-8 h-8 rounded border flex items-center justify-center text-xs font-bold ${simStats.isMoving ? 'border-blue-500 bg-blue-500/20 text-white' : 'border-slate-600 text-slate-500'}`}>D</div>
                </div>
                <div className="flex justify-center">
                    <div className="w-full h-6 rounded border border-slate-600 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase">
                       J - Jump
                    </div>
                </div>
              </div>
           </div>
        </div>
      </div>

      {/* Control Sidebar (1/3 width, fixed min width) */}
      <div className="w-[400px] min-w-[350px] max-w-[450px] h-full shadow-2xl z-10">
        <ControlPanel 
          joints={joints} 
          setJoints={setJoints} 
          objects={objects} 
          onQueueCommands={setCommandQueue}
          onResetSimulation={handleResetSimulation}
        />
      </div>
    </div>
  );
};

export default App;