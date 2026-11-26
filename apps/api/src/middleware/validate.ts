import type { ErrorFields } from "@gradelink/shared";
import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../errors.ts";

type RequestSchemas<B extends z.ZodType, P extends z.ZodType, Q extends z.ZodType> = {
  // Use z.undefined() for a route with no body: Express leaves req.body undefined then.
  body: B;
  params: P;
  query: Q;
};

type ParsedRequest<B extends z.ZodType, P extends z.ZodType, Q extends z.ZodType> = {
  body: z.output<B>;
  params: z.output<P>;
  query: z.output<Q>;
};

type Location = keyof RequestSchemas<z.ZodType, z.ZodType, z.ZodType>;

// Looks through wrappers that don't change which keys an object declares.
function unwrap(schema: unknown): unknown {
  if (
    schema instanceof z.ZodOptional ||
    schema instanceof z.ZodNullable ||
    schema instanceof z.ZodDefault ||
    schema instanceof z.ZodPrefault ||
    schema instanceof z.ZodReadonly
  ) {
    return unwrap(schema.unwrap());
  }
  if (schema instanceof z.ZodPipe) {
    return unwrap(schema.in);
  }
  return schema;
}

// Echoes only keys the schema itself declares. Any other string segment, such as a record key
// or a key under a union the walk can't follow, was typed by the client, so it and everything
// after it is masked (TASK-005 decision: messages never include submitted values).
function fieldPath(location: Location, schema: z.ZodType, path: readonly PropertyKey[]) {
  const segments: string[] = [];
  let current: unknown = schema;
  for (const segment of path) {
    const node = unwrap(current);
    if (typeof segment === "number") {
      segments.push(String(segment));
      current = node instanceof z.ZodArray ? node.element : undefined;
    } else if (
      typeof segment === "string" &&
      node instanceof z.ZodObject &&
      Object.hasOwn(node.shape, segment)
    ) {
      segments.push(segment);
      current = node.shape[segment];
    } else {
      segments.push("*");
      current = undefined;
    }
  }
  return [location, ...segments].join(".");
}

// Zod's default messages name types and limits, not input, except unrecognized_keys, which
// lists the submitted keys. Schema authors must not interpolate input into custom messages.
function fieldMessage(issue: z.core.$ZodIssue) {
  return issue.code === "unrecognized_keys" ? "Contains an unexpected field." : issue.message;
}

function collectIssues(
  fields: ErrorFields,
  location: Location,
  schema: z.ZodType,
  error: z.ZodError,
) {
  for (const issue of error.issues) {
    const path = fieldPath(location, schema, issue.path);
    fields[path] ??= fieldMessage(issue);
  }
}

// Parses body, params and query with the route's shared schemas before the handler runs, so the
// handler only sees parsed, typed values and never reads req.body itself (BP-005, BP-001).
// Any failure is one 400 listing every bad field; submitted values are never echoed.
export function validated<B extends z.ZodType, P extends z.ZodType, Q extends z.ZodType>(
  schemas: RequestSchemas<B, P, Q>,
  handler: (input: ParsedRequest<B, P, Q>, req: Request, res: Response) => unknown,
) {
  return async (req: Request, res: Response) => {
    const body = schemas.body.safeParse(req.body);
    const params = schemas.params.safeParse(req.params);
    const query = schemas.query.safeParse(req.query);

    if (!body.success || !params.success || !query.success) {
      const fields: ErrorFields = {};
      if (!body.success) collectIssues(fields, "body", schemas.body, body.error);
      if (!params.success) collectIssues(fields, "params", schemas.params, params.error);
      if (!query.success) collectIssues(fields, "query", schemas.query, query.error);
      throw new AppError(400, "VALIDATION_ERROR", "Some fields aren't valid.", fields);
    }

    await handler({ body: body.data, params: params.data, query: query.data }, req, res);
  };
}
