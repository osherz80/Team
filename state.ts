import { Annotation } from "@langchain/langgraph";

export interface SubTask {
  title: string;
  dod: string;
  status: "pending" | "in_progress" | "completed";
  codeOutput?: string;
}

export const AgentState = Annotation.Root({
  mainMission: Annotation<string>(),
  subtasks: Annotation<SubTask[]>({
    reducer: (x, y) => y,
    default: () => [],
  }),
  currentTaskIndex: Annotation<number>({
    reducer: (x, y) => y,
    default: () => 0,
  }),
});

export type AgentStateType = typeof AgentState.State;