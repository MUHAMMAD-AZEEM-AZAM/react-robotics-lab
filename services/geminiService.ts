import { GoogleGenAI, Type } from "@google/genai";
import { JointState, SimObject, JOINT_NAMES, RobotCommand } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = "gemini-3-pro-preview";

export const generateRobotAction = async (
  prompt: string,
  currentJoints: JointState,
  objects: SimObject[]
): Promise<{ commands: RobotCommand[]; explanation: string }> => {
  const objectDesc = objects.map(o => `${o.name} at (${o.position.x}, ${o.position.y}, ${o.position.z})`).join(", ");
  
  const systemInstruction = `
    You are the intelligent control system for a 12-DOF quadruped robot simulation.
    The robot has 4 legs (FL, FR, BL, BR) and can perform high-level movements or low-level joint pose adjustments.

    Your goal is to generate a SEQUENCE of commands to fulfill the user's request.
    
    Available Command Types:
    - MOVE_FORWARD (duration in seconds): Robot walks forward using procedural gait.
    - MOVE_BACKWARD (duration in seconds): Robot walks backward.
    - TURN_LEFT (duration in seconds): Robot rotates left in place.
    - TURN_RIGHT (duration in seconds): Robot rotates right in place.
    - JUMP (duration ignored): Applies an instant upward impulse.
    - WAIT (duration in seconds): Robot stands still.
    - SET_JOINTS (targetJoints): Sets the robot's joints to a specific static pose (e.g., sitting, waving). Duration is ignored.

    Joint Limits (for SET_JOINTS):
    - Hip: -0.5 to 0.5 (Roll)
    - Thigh: -1.0 to 1.5 (Pitch)
    - Calf: -2.5 to -0.5 (Pitch)

    Context:
    - Objects in scene: ${objectDesc}
    - Robot starts at (0,0,0) facing +Z (or wherever it currently is).
    - Movement speed is approx 1.5 units/sec. Rotation is approx 2.0 rad/sec.

    Example: "Go to the red cube and sit down"
    Response:
    [
      { type: "TURN_LEFT", duration: 0.5, description: "Align with red cube" },
      { type: "MOVE_FORWARD", duration: 2.0, description: "Walk to cube" },
      { type: "SET_JOINTS", targetJoints: { ...sitPose }, description: "Sit" }
    ]

    Return a JSON object containing the list of 'commands' and a general 'explanation'.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Current Joints: ${JSON.stringify(currentJoints)}. User Command: ${prompt}`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            commands: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, enum: ['MOVE_FORWARD', 'MOVE_BACKWARD', 'TURN_LEFT', 'TURN_RIGHT', 'JUMP', 'WAIT', 'SET_JOINTS'] },
                  duration: { type: Type.NUMBER, description: "Duration in seconds (optional for JUMP/SET_JOINTS)" },
                  targetJoints: {
                    type: Type.OBJECT,
                    description: "Required only for SET_JOINTS",
                    properties: Object.fromEntries(
                      JOINT_NAMES.map(name => [name, { type: Type.NUMBER }])
                    )
                  },
                  description: { type: Type.STRING }
                },
                required: ['type']
              }
            },
            explanation: { type: Type.STRING }
          }
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    // Ensure commands array exists
    return {
      commands: result.commands || [],
      explanation: result.explanation || "Action sequence generated."
    };
  } catch (error) {
    console.error("Gemini Robot Control Error:", error);
    throw error;
  }
};

export const generateMJCF = async (
  currentJoints: JointState
): Promise<string> => {
  const systemInstruction = `
    You are an expert MuJoCo physics engine developer.
    Generate a valid, minimal MJCF (XML) string for a 12-DOF quadruped robot.
    Use the current joint angles provided to set the 'qpos0' (initial position) or 'default' classes.
    The robot should have a torso and 4 legs (FL, FR, BL, BR).
    The XML should be ready to save as 'robot.xml' and load in MuJoCo.
    Include simple geometric primitives (capsules/boxes).
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Generate MJCF for these joint angles: ${JSON.stringify(currentJoints)}`,
      config: {
        systemInstruction,
        responseMimeType: "text/plain", // We want raw XML
      }
    });
    return response.text || "<!-- Error generating MJCF -->";
  } catch (error) {
    console.error("Gemini MJCF Generation Error:", error);
    return "<!-- Error generating MJCF -->";
  }
};