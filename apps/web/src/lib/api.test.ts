import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiError, getSession, SIGN_IN_PATH, signOut, teacherRequest } from "./api";

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

const betterAuthSession = {
  session: { id: "fabricated-session-id", token: "fabricated-session-token" },
  user: { id: "user-1", email: "teacher@example.com", name: "teacher", image: null },
};

describe("getSession", () => {
  it("calls the relative Better Auth path and keeps only the id and email", async () => {
    const fetchSpy = mockFetch(200, betterAuthSession);

    const session = await getSession();

    expect(fetchSpy).toHaveBeenCalledWith("/api/auth/get-session", expect.anything());
    expect(session).toEqual({ user: { id: "user-1", email: "teacher@example.com" } });
    expect(JSON.stringify(session)).not.toContain("fabricated-session-token");
  });

  it("returns null when signed out", async () => {
    mockFetch(200, null);

    expect(await getSession()).toBeNull();
  });

  it("rejects a response that doesn't match the schema", async () => {
    mockFetch(200, { user: { id: "user-1" } });

    await expect(getSession()).rejects.toThrow();
  });

  it("throws an ApiError with the status on a failure", async () => {
    mockFetch(500, { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } });

    const error = await getSession().catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 500, code: "INTERNAL_ERROR" });
  });
});

describe("signOut", () => {
  it("posts JSON to Better Auth's sign-out endpoint", async () => {
    const fetchSpy = mockFetch(200, { success: true });

    await signOut();

    const [path, init] = fetchSpy.mock.calls[0] ?? [];
    expect(path).toBe("/api/auth/sign-out");
    expect(init).toMatchObject({ method: "POST", body: "{}" });
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
  });

  it("throws when sign-out fails", async () => {
    mockFetch(500, undefined);

    await expect(signOut()).rejects.toBeInstanceOf(ApiError);
  });

  it("throws when the network fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(signOut()).rejects.toThrow("Failed to fetch");
  });
});

describe("teacherRequest", () => {
  const itemSchema = z.object({ id: z.string() });

  it("parses the response with the given schema", async () => {
    mockFetch(200, { id: "q1", extra: "dropped" });

    expect(await teacherRequest("/api/teacher/questions/q1", itemSchema)).toEqual({ id: "q1" });
  });

  it("turns a 401 into a redirect to sign-in (session ended mid-use)", async () => {
    mockFetch(401, { error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } });

    const thrown = await teacherRequest("/api/teacher/questions", itemSchema).catch(
      (error: unknown) => error,
    );

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(302);
    expect((thrown as Response).headers.get("location")).toBe(SIGN_IN_PATH);
  });

  it("keeps other errors as ApiError with the shared error code", async () => {
    mockFetch(404, { error: { code: "NOT_FOUND", message: "Not found." } });

    const thrown = await teacherRequest("/api/teacher/questions/x", itemSchema).catch(
      (error: unknown) => error,
    );

    expect(thrown).toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("sends a JSON body when given one", async () => {
    const fetchSpy = mockFetch(200, { id: "q1" });

    await teacherRequest("/api/teacher/questions", itemSchema, {
      method: "POST",
      body: { prompt: "x" },
    });

    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({ method: "POST", body: '{"prompt":"x"}' });
  });
});
