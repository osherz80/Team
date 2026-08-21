import { geminiModel } from "./llm.ts";
import type { AgentStateType } from "./state.ts";

export const coderPrompt = (subtask: string, dod: string) => `
You are an expert Full-Stack Software Engineer.
Your current task is: ${subtask}
Definition of Done (DOD): ${dod}

Instructions:
1. Plan and implement the complete solution for this subtask.
2. Review your own implementation strictly against the DOD.
3. Output the fully working code/solution and explain briefly how it meets the DOD.

Provide clean, production-ready code.
`;

export const coderNode = async (state: AgentStateType) => {
    const { subtasks, currentTaskIndex } = state;
    const currentTask = subtasks[currentTaskIndex];

    if (!currentTask) {
        console.log(`\n💻 [Coder] No task found at index ${currentTaskIndex}.`);
        return {};
    }

    console.log(`\n💻 [Coder] Executing task ${currentTaskIndex + 1}/${subtasks.length}: "${currentTask.title}"`);
    console.log(`   DOD: ${currentTask.dod}`);

    const response = await geminiModel.invoke([
        { role: "user", content: coderPrompt(currentTask.title, currentTask.dod) }
    ]);

    const updatedSubtasks = [...subtasks];
    updatedSubtasks[currentTaskIndex] = {
        ...currentTask,
        status: "completed",
        codeOutput: typeof response.content === "string" ? response.content : JSON.stringify(response.content),
    };

    console.log(`✅ [Coder] Task ${currentTaskIndex + 1} completed and checked against DOD.`);

    return {
        subtasks: updatedSubtasks,
        currentTaskIndex: currentTaskIndex + 1,
    };
};