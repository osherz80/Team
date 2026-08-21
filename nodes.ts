import { z } from "zod";
import { geminiModel } from "./llm.ts";
import type { AgentStateType, SubTask } from "./state.ts";
import { teamLeadPrompt } from "./prompts/teamLead.ts";

const SubtasksSchema = z.object({
    subtasks: z
        .array(
            z.object({
                title: z.string().describe("Title or brief description of the subtask"),
                dod: z.string().describe("Definition of done for this subtask"),
            })
        )
        .describe("List of subtasks with DOD"),
});

export async function teamLeadNode(state: AgentStateType) {
    console.log(`\n📋 [Team Lead] Analyzing main mission...`);

    const structuredLlm = geminiModel.withStructuredOutput(SubtasksSchema);
    const prompt = teamLeadPrompt(state.mainMission);
    const response = await structuredLlm.invoke(prompt);

    const subtasks: SubTask[] = response.subtasks.map((item) => ({
        title: item.title,
        dod: item.dod,
        status: "pending",
    }));

    console.log(`✅ [Team Lead] Done. Mission broken down into ${subtasks.length} subtasks.`);

    return {
        subtasks,
        currentTaskIndex: 0,
    };
}