import { z } from "zod";
import { geminiModel } from "./llm.ts"
import type { AgentStateType } from "./state.ts";
import { teamLeadPrompt } from "./prompts/teamLead.ts";

const SubtasksSchema = z.object({
    subtasks: z
        .array(z.string())
        .describe("list of subtasks to be done"),
});

export async function teamLeadNode(state: AgentStateType) {
    console.log(`\n📋 [Team Lead] ...`);

    const structuredLlm = geminiModel.withStructuredOutput(SubtasksSchema);

    const prompt = teamLeadPrompt(state.task)
    const response = await structuredLlm.invoke(prompt);
    console.log(`✅ [Team Lead] done, the task was broken down into ${response.subtasks.length} subtasks.`);

    return {
        subtasks: response.subtasks,
    };
}