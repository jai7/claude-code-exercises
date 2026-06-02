import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockCookieGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({ get: mockCookieGet })),
}));

const mockJwtVerify = vi.fn();
vi.mock("jose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jose")>();
  return { ...actual, jwtVerify: mockJwtVerify };
});

// Import after mocks are registered
const { getSession } = await import("@/lib/auth");

describe("getSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns null when auth-token cookie is absent", async () => {
    mockCookieGet.mockReturnValue(undefined);

    expect(await getSession()).toBeNull();
  });

  test("returns SessionPayload for a valid token", async () => {
    const payload = {
      userId: "user-123",
      email: "test@example.com",
      expiresAt: new Date("2030-01-01"),
    };
    mockCookieGet.mockReturnValue({ value: "valid.jwt.token" });
    mockJwtVerify.mockResolvedValue({ payload });

    expect(await getSession()).toEqual(payload);
  });

  test("passes the cookie value to jwtVerify", async () => {
    const payload = { userId: "u1", email: "a@b.com", expiresAt: new Date() };
    mockCookieGet.mockReturnValue({ value: "some.token.value" });
    mockJwtVerify.mockResolvedValue({ payload });

    await getSession();

    const [token, secret] = mockJwtVerify.mock.calls[0];
    expect(token).toBe("some.token.value");
    // secret is a Uint8Array; cross-realm instanceof breaks in jsdom so check constructor name
    expect(secret?.constructor?.name).toBe("Uint8Array");
  });

  test("returns null when jwtVerify throws (expired token)", async () => {
    mockCookieGet.mockReturnValue({ value: "expired.jwt.token" });
    mockJwtVerify.mockRejectedValue(new Error("JWTExpired"));

    expect(await getSession()).toBeNull();
  });

  test("returns null when jwtVerify throws (malformed token)", async () => {
    mockCookieGet.mockReturnValue({ value: "not-a-valid-jwt" });
    mockJwtVerify.mockRejectedValue(new Error("JWSInvalid"));

    expect(await getSession()).toBeNull();
  });
});
