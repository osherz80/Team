import { StateGraph, START, END } from "@langchain/langgraph";
import { AgentState, type AgentStateType, type SubTask } from "./state.ts";
import { teamLeadNode } from "./nodes.ts";
import { coderNode } from "./coder.ts";

function shouldContinue(state: AgentStateType) {
    if (state.currentTaskIndex < state.subtasks.length) {
        console.log(`🔄 [Loop] Proceeding to subtask ${state.currentTaskIndex + 1}/${state.subtasks.length}...`);
        return "coder";
    }
    console.log(`\n🏁 [Loop] All ${state.subtasks.length} subtasks completed!`);
    return END;
}

const builder = new StateGraph(AgentState)
    .addNode("teamLead", teamLeadNode)
    .addNode("coder", coderNode)
    .addEdge(START, "teamLead")
    .addEdge("teamLead", "coder")
    .addConditionalEdges("coder", shouldContinue, {
        coder: "coder",
        [END]: END,
    });

export const graph = builder.compile();

async function main() {
    const initialInput = {
        mainMission: "Build a secure user authentication module with JWT login, registration, and password hashing.",
    };

    const result = await graph.invoke(initialInput);

    console.log("\n=================== FINAL SUBTASKS SUMMARY ===================");
    result.subtasks.forEach((subtask: SubTask, index: number) => {
        console.log(`\n📌 Task ${index + 1}: ${subtask.title}`);
        console.log(`   DOD: ${subtask.dod}`);
        console.log(`   Status: ${subtask.status}`);
        console.log(`   Code Output Snippet:\n${subtask.codeOutput?.slice(0, 150)}...`);
    });
}

main().catch(console.error);