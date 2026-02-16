export interface JointState {
  // 4 legs x 3 joints = 12 DOF
  // Names: FL_hip, FL_thigh, FL_calf, FR_hip...
  [key: string]: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface SimObject {
  id: string;
  name: string;
  color: string;
  position: Vector3;
}

export enum RobotMode {
  IDLE = 'IDLE',
  MOVING = 'MOVING',
  THINKING = 'THINKING',
}

export type ActionType = 'MOVE_FORWARD' | 'MOVE_BACKWARD' | 'TURN_LEFT' | 'TURN_RIGHT' | 'JUMP' | 'WAIT' | 'SET_JOINTS';

export interface RobotCommand {
  type: ActionType;
  duration?: number; // in seconds (for moves/waits)
  targetJoints?: JointState; // For SET_JOINTS
  description?: string; // Short text for UI
}

export interface SimulationState {
  joints: JointState;
  objects: SimObject[];
  robotPosition: Vector3; // Base position
  robotRotation: Vector3; // Base rotation
}

export interface SimStats {
  position: Vector3;
  velocity: number;
  rotation: number;
  isMoving: boolean;
  currentAction?: string;
}

// Order of joints for array-based processing if needed
export const JOINT_NAMES = [
  'FL_hip', 'FL_thigh', 'FL_calf',
  'FR_hip', 'FR_thigh', 'FR_calf',
  'BL_hip', 'BL_thigh', 'BL_calf',
  'BR_hip', 'BR_thigh', 'BR_calf',
];

export const INITIAL_JOINTS: JointState = {
  FL_hip: 0, FL_thigh: 0.5, FL_calf: -1.0,
  FR_hip: 0, FR_thigh: 0.5, FR_calf: -1.0,
  BL_hip: 0, BL_thigh: 0.5, BL_calf: -1.0,
  BR_hip: 0, BR_thigh: 0.5, BR_calf: -1.0,
};