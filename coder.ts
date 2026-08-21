import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { geminiModel } from "./llm.ts";
import { writeFileTool, readFileTool } from "./tools.ts";
import type { AgentStateType } from "./state.ts";

const coderAgent = createReactAgent({
    llm: geminiModel,
    tools: [writeFileTool, readFileTool],
});

export const coderPrompt = (subtask: string, dod: string) => `
You are an expert Full-Stack Software Engineer equipped with file system tools (read_file, write_file).
Your current task is: ${subtask}
Definition of Done (DOD): ${dod}

Instructions:
1. Analyze what files need to be created or updated for this subtask.
2. Use the 'write_file' tool to actually create or update the required code files in the project workspace (e.g. src/ directory).
3. If necessary, use 'read_file' to inspect existing files.
4. Verify that the written code strictly matches the Definition of Done (DOD).
5. You must use the 'write_file' tool to write every file to disk. Do not just output code blocks in text. Always invoke the tool.
6. Provide a summary of all files created/modified and explain how the solution meets the DOD.
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

    const result = await coderAgent.invoke({
        messages: [{ role: "user", content: coderPrompt(currentTask.title, currentTask.dod) }],
    });

    // בדיקה דיאגנוסטית: האם הופעלו הכלים במהלך הרצת הסוכן?
    const toolMessages = result.messages.filter((m: any) => m._getType() === "tool");
    console.log(`🔍 [Coder Debug] Total tool executions: ${toolMessages.length}`);

    toolMessages.forEach((tm: any, i: number) => {
        console.log(`   └─ Tool Call ${i + 1} (${tm.name}): ${tm.content}`);
    });

    const lastMessage = result.messages?.[result.messages.length - 1];
    const codeOutput = lastMessage && typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage?.content ?? "");

    const updatedSubtasks = [...subtasks];
    updatedSubtasks[currentTaskIndex] = {
        ...currentTask,
        status: "completed",
        codeOutput,
    };

    console.log(`✅ [Coder] Task ${currentTaskIndex + 1} completed.`);

    return {
        subtasks: updatedSubtasks,
        currentTaskIndex: currentTaskIndex + 1,
    };
};