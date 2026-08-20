import { Annotation } from "@langchain/langgraph";

export const AgentState = Annotation.Root({
  task: Annotation<string>(),
  subtasks: Annotation<string[]>({
    reducer: (x, y) => y, // מחליף את המערך בתוצאה החדשה
    default: () => [],
  }),
});

export type AgentStateType = typeof AgentState.State;