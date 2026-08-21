import { StateGraph, START, END } from "@langchain/langgraph";
import { AgentState } from "./state.js";
import { teamLeadNode } from "./nodes.js";

const builder = new StateGraph(AgentState)
    .addNode("teamLead", teamLeadNode)
    .addEdge(START, "teamLead")
    .addEdge("teamLead", END);

export const graph = builder.compile();

async function main() {
    const initialInput = {
        task: "our mission is to build a carbon copy of netflix, it must be also operational like netflix and support the same users count",
    };

    const result = await graph.invoke(initialInput);
    console.log(result.subtasks)
    result.subtasks.forEach((subtask: string, index: number) => {
        console.log(`${subtask}`);
    });
}

main().catch(console.error);