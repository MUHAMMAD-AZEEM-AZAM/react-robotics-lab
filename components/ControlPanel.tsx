import React, { useState, useEffect } from 'react';
import { JointState, JOINT_NAMES, SimObject, INITIAL_JOINTS, RobotCommand } from '../types';
import { Terminal, Send, Play, RotateCcw, Download, Info, Activity } from 'lucide-react';
import { generateRobotAction, generateMJCF } from '../services/geminiService';

interface ControlPanelProps {
  joints: JointState;
  setJoints: React.Dispatch<React.SetStateAction<JointState>>;
  objects: SimObject[];
  onQueueCommands: (cmds: RobotCommand[]) => void;
  onResetSimulation: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ joints, setJoints, objects, onQueueCommands, onResetSimulation }) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [mjcf, setMjcf] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('System Ready');

  const handleSliderChange = (joint: string, value: number) => {
    setJoints(prev => ({ ...prev, [joint]: value }));
  };

  const handleGeminiCommand = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setStatus('Planning sequence with Gemini...');
    try {
      const result = await generateRobotAction(prompt, joints, objects);
      if (result.commands.length > 0) {
        onQueueCommands(result.commands);
        setStatus(`Executing plan: ${result.explanation}`);
      } else {
        setStatus(`Done: ${result.explanation}`);
      }
    } catch (error) {
      setStatus('Error: Failed to process command');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    onResetSimulation();
    setStatus('Simulation Reset');
  };

  const handleGenerateMJCF = async () => {
    setLoading(true);
    setStatus('Generating MuJoCo XML...');
    const xml = await generateMJCF(joints);
    setMjcf(xml);
    setLoading(false);
    setStatus('MJCF Generated');
  };

  // Preset Actions
  const applyPreset = (preset: string) => {
    setStatus(`Executing ${preset}...`);
    let newJoints = { ...INITIAL_JOINTS };
    switch (preset) {
      case 'WAVE':
        newJoints = { 
          ...INITIAL_JOINTS, 
          FR_hip: 0, FR_thigh: -0.5, FR_calf: -0.5 // Lift Front Right Leg
        };
        break;
      case 'SIT':
        newJoints = {
          ...INITIAL_JOINTS,
          BL_thigh: 1.0, BL_calf: -2.0,
          BR_thigh: 1.0, BR_calf: -2.0,
          FL_thigh: -0.2, FL_calf: -0.8,
          FR_thigh: -0.2, FR_calf: -0.8
        };
        break;
      case 'POUNCE':
        newJoints = {
          ...INITIAL_JOINTS,
          FL_thigh: 1.2, FL_calf: -2.5,
          FR_thigh: 1.2, FR_calf: -2.5,
          BL_thigh: 0.2, BL_calf: -1.0,
          BR_thigh: 0.2, BR_calf: -1.0
        };
        break;
    }
    setJoints(newJoints);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-700 text-slate-200">
      
      {/* Header */}
      <div className="p-4 border-b border-slate-700 bg-slate-800/50 backdrop-blur">
        <h2 className="text-lg font-bold flex items-center gap-2 text-blue-400">
          <Activity size={20} />
          ROBOT CONTROL
        </h2>
        <div className="text-xs font-mono text-slate-400 mt-1 flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`}></span>
          {status}
        </div>
      </div>

      {/* Main Scrollable Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* AI Command Section */}
        <section className="bg-slate-800 rounded-lg p-3 shadow-sm border border-slate-700/50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-purple-400 flex items-center gap-2">
              <Terminal size={16} />
              AI COMMAND
            </h3>
            <span className="text-[10px] bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded uppercase tracking-wider">Gemini 3 Pro</span>
          </div>
          <div className="space-y-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGeminiCommand()}
              placeholder="e.g., Walk to the red cube then sit..."
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500 transition-colors placeholder-slate-600"
            />
            <button
              onClick={handleGeminiCommand}
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold py-2 px-4 rounded flex items-center justify-center gap-2 transition-all"
            >
              {loading ? 'PLANNING SEQUENCE...' : 'EXECUTE COMMAND'} <Send size={14} />
            </button>
          </div>
        </section>

        {/* Quick Actions */}
        <section>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => applyPreset('WAVE')} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 py-2 rounded text-xs font-medium transition-colors">👋 Wave</button>
            <button onClick={() => applyPreset('SIT')} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 py-2 rounded text-xs font-medium transition-colors">🐕 Sit</button>
            <button onClick={() => applyPreset('POUNCE')} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 py-2 rounded text-xs font-medium transition-colors">🐅 Pounce</button>
            <button onClick={handleReset} className="bg-red-900/20 hover:bg-red-900/40 border border-red-900/30 text-red-400 py-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-2"><RotateCcw size={12}/> Reset</button>
          </div>
        </section>

        {/* Joint Sliders */}
        <section>
           <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex justify-between">
             <span>Joint Override</span>
             <span className="text-slate-600">12-DOF</span>
           </h3>
           <div className="space-y-4">
             {['FL', 'FR', 'BL', 'BR'].map(leg => (
               <div key={leg} className="bg-slate-800/50 p-2 rounded border border-slate-700/50">
                 <div className="text-[10px] font-bold text-blue-300 mb-1">{leg} Leg</div>
                 {['hip', 'thigh', 'calf'].map(part => {
                   const jointName = `${leg}_${part}`;
                   const min = part === 'calf' ? -2.5 : -1.5;
                   const max = part === 'calf' ? -0.5 : 1.5;
                   return (
                     <div key={jointName} className="flex items-center gap-2 mb-1">
                       <span className="text-[10px] text-slate-400 w-8 font-mono">{part}</span>
                       <input
                         type="range"
                         min={min}
                         max={max}
                         step={0.01}
                         value={joints[jointName] || 0}
                         onChange={(e) => handleSliderChange(jointName, parseFloat(e.target.value))}
                         className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                       />
                       <span className="text-[10px] text-slate-500 w-8 text-right font-mono">{joints[jointName]?.toFixed(1)}</span>
                     </div>
                   );
                 })}
               </div>
             ))}
           </div>
        </section>

        {/* MJCF Export */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Simulation Export</h3>
            <button 
              onClick={handleGenerateMJCF} 
              className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <Download size={12}/> Generate XML
            </button>
          </div>
          {mjcf && (
            <div className="relative">
              <pre className="bg-black/50 p-2 rounded text-[10px] text-slate-400 h-32 overflow-y-auto font-mono border border-slate-700">
                {mjcf}
              </pre>
            </div>
          )}
        </section>
      </div>

      {/* Footer */}
      <div className="p-3 bg-slate-900 border-t border-slate-700 text-[10px] text-slate-600 flex items-center justify-between">
         <span>Sim v1.0.0 (Three.js + Gemini)</span>
         <a href="#" className="hover:text-slate-400">Docs</a>
      </div>
    </div>
  );
};