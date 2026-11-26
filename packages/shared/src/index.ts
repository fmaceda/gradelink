// Student and teacher schemas stay separate: student/ must never import from teacher/.
export * from "./common/index.ts";
export * from "./student/index.ts";
export * from "./teacher/index.ts";
