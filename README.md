# 12-DOF Quadruped Simulation Environment

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Gemini 3](https://img.shields.io/badge/Gemini%203%20AI-8E75B2?style=for-the-badge&logo=google&logoColor=white)

A browser-based robotics simulator that bridges the gap between Large Language Models (LLMs) and low-level motor control. This project visualizes a 12-DOF (Degrees of Freedom) quadruped robot using a custom physics loop and integrates **Google Gemini 3** to translate natural language prompts into complex kinematic trajectories.

### 🎯 Objective

To explore **Embodied AI** by prototyping how multimodal models can act as high-level planners for physical systems without requiring expensive hardware.

### ⚡ Key Features

*   **Custom Physics Engine:** Implements a localized physics loop (Gravity, Euler Integration, Ground Collision, Object Interaction) running at ~60Hz within the React render cycle.
*   **LLM Motion Planning:** Uses **Gemini 3 Pro** to decompose abstract commands (e.g., *"Walk to the red cube and sit"*) into precise joint angles and temporal sequences.
*   **12-DOF Kinematics:** Full control over 12 individual joints (Hip, Thigh, Calf) with limit constraints mimicking real servo capabilities.
*   **Procedural Gait Generation:** Sine-wave based inverse kinematics for locomotion.
*   **MJCF Export:** Generates MuJoCo-compatible XML configurations dynamically based on current robot states.

### 🛠️ Tech Stack

*   **Core:** React 19, TypeScript, Vite
*   **Visualization:** React Three Fiber (Three.js), Drei
*   **AI/Inference:** Google GenAI SDK (Gemini 3 Pro Preview)
*   **Styling:** Tailwind CSS

### 🚀 Getting Started

1.  **Clone the repo**
    ```bash
    git clone https://github.com/MUHAMMAD-AZEEM-AZAM/react-robotics-lab.git
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Set up API Key**
    Create a `.env` file in the root directory and add your Google Gemini API key:
    ```env
    API_KEY=your_google_ai_studio_key_here
    ```

4.  **Run the simulation**
    ```bash
    npm run dev
    ```

### 🧠 How it Works

The system operates on a dual-loop architecture:

1.  **The Physics Loop (`useFrame`):** Handles gravity, velocity integration, and collision detection every frame. It manages the state of the robot and dynamic objects (cubes) in the scene.
2.  **The Reasoning Loop (Gemini):** Processes text input, analyzes the 3D scene state (object positions), and outputs a structured JSON sequence of `RobotCommand` primitives (e.g., `SET_JOINTS`, `MOVE_FORWARD`).

### 📚 Future Research Goals

*   Implementing ZMP (Zero Moment Point) for dynamic balance.
*   Moving from kinematic translation to force-based locomotion.
*   Integrating vision encoders for true "Sim2Real" computer vision tasks.

---

*Built for research and educational purposes.*
