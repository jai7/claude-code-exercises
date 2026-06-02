import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSignInAction = vi.fn();
const mockSignUpAction = vi.fn();
vi.mock("@/actions", () => ({
  signIn: mockSignInAction,
  signUp: mockSignUpAction,
}));

const mockGetAnonWorkData = vi.fn();
const mockClearAnonWork = vi.fn();
vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: mockGetAnonWorkData,
  clearAnonWork: mockClearAnonWork,
}));

const mockGetProjects = vi.fn();
vi.mock("@/actions/get-projects", () => ({
  getProjects: mockGetProjects,
}));

const mockCreateProject = vi.fn();
vi.mock("@/actions/create-project", () => ({
  createProject: mockCreateProject,
}));

const { useAuth } = await import("@/hooks/use-auth");

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "default-project-id" });
  });

  describe("initial state", () => {
    test("isLoading starts as false", () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);
    });

    test("exposes signIn and signUp functions", () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
    });
  });

  describe("signIn", () => {
    test("calls signInAction with provided credentials", async () => {
      mockSignInAction.mockResolvedValue({ success: false });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "mypassword");
      });

      expect(mockSignInAction).toHaveBeenCalledWith("user@example.com", "mypassword");
    });

    test("returns the result from signInAction", async () => {
      const authResult = { success: false, error: "Invalid credentials" };
      mockSignInAction.mockResolvedValue(authResult);

      const { result } = renderHook(() => useAuth());

      let returnValue;
      await act(async () => {
        returnValue = await result.current.signIn("user@example.com", "wrongpassword");
      });

      expect(returnValue).toEqual(authResult);
    });

    test("sets isLoading to true during sign-in and resets it after", async () => {
      let resolveSignIn!: (v: unknown) => void;
      mockSignInAction.mockReturnValue(
        new Promise((resolve) => {
          resolveSignIn = resolve;
        })
      );

      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.signIn("user@example.com", "password");
      });
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignIn({ success: false });
      });
      expect(result.current.isLoading).toBe(false);
    });

    test("resets isLoading even when signInAction throws", async () => {
      mockSignInAction.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        try {
          await result.current.signIn("user@example.com", "password");
        } catch {
          // expected
        }
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("does not trigger post-sign-in flow when signIn fails", async () => {
      mockSignInAction.mockResolvedValue({ success: false, error: "Invalid credentials" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "wrongpassword");
      });

      expect(mockGetAnonWorkData).not.toHaveBeenCalled();
      expect(mockGetProjects).not.toHaveBeenCalled();
      expect(mockCreateProject).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("signUp", () => {
    test("calls signUpAction with provided credentials", async () => {
      mockSignUpAction.mockResolvedValue({ success: false });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "securepassword");
      });

      expect(mockSignUpAction).toHaveBeenCalledWith("new@example.com", "securepassword");
    });

    test("returns the result from signUpAction", async () => {
      const authResult = { success: false, error: "Email already registered" };
      mockSignUpAction.mockResolvedValue(authResult);

      const { result } = renderHook(() => useAuth());

      let returnValue;
      await act(async () => {
        returnValue = await result.current.signUp("existing@example.com", "password");
      });

      expect(returnValue).toEqual(authResult);
    });

    test("sets isLoading to true during sign-up and resets it after", async () => {
      let resolveSignUp!: (v: unknown) => void;
      mockSignUpAction.mockReturnValue(
        new Promise((resolve) => {
          resolveSignUp = resolve;
        })
      );

      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.signUp("new@example.com", "password123");
      });
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignUp({ success: false });
      });
      expect(result.current.isLoading).toBe(false);
    });

    test("resets isLoading even when signUpAction throws", async () => {
      mockSignUpAction.mockRejectedValue(new Error("Server error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        try {
          await result.current.signUp("user@example.com", "password");
        } catch {
          // expected
        }
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("does not trigger post-sign-in flow when signUp fails", async () => {
      mockSignUpAction.mockResolvedValue({ success: false, error: "Email already registered" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("existing@example.com", "password");
      });

      expect(mockGetAnonWorkData).not.toHaveBeenCalled();
      expect(mockGetProjects).not.toHaveBeenCalled();
      expect(mockCreateProject).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("post-auth navigation (handlePostSignIn)", () => {
    describe("when anonymous work exists with messages", () => {
      const anonWork = {
        messages: [{ role: "user", content: "Build me a button" }],
        fileSystemData: { "/": { type: "directory" }, "/App.tsx": { type: "file", content: "export default () => <div/>" } },
      };

      beforeEach(() => {
        mockGetAnonWorkData.mockReturnValue(anonWork);
        mockCreateProject.mockResolvedValue({ id: "anon-project-id" });
      });

      test("creates a project with the anon messages and file system data", async () => {
        mockSignInAction.mockResolvedValue({ success: true });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password");
        });

        expect(mockCreateProject).toHaveBeenCalledWith({
          name: expect.stringContaining("Design from"),
          messages: anonWork.messages,
          data: anonWork.fileSystemData,
        });
      });

      test("clears anonymous work after claiming it", async () => {
        mockSignInAction.mockResolvedValue({ success: true });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password");
        });

        expect(mockClearAnonWork).toHaveBeenCalled();
      });

      test("navigates to the newly created project", async () => {
        mockSignInAction.mockResolvedValue({ success: true });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password");
        });

        expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
      });

      test("does not fetch existing projects when anon work is present", async () => {
        mockSignInAction.mockResolvedValue({ success: true });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password");
        });

        expect(mockGetProjects).not.toHaveBeenCalled();
      });

      test("works the same after a successful signUp", async () => {
        mockSignUpAction.mockResolvedValue({ success: true });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("new@example.com", "password123");
        });

        expect(mockCreateProject).toHaveBeenCalled();
        expect(mockClearAnonWork).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
      });
    });

    describe("when anonymous work has no messages", () => {
      beforeEach(() => {
        mockSignInAction.mockResolvedValue({ success: true });
      });

      test("skips anon project creation when messages array is empty", async () => {
        mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
        mockGetProjects.mockResolvedValue([{ id: "existing-id", name: "My Project" }]);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password");
        });

        expect(mockCreateProject).not.toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/existing-id");
      });
    });

    describe("when no anonymous work exists", () => {
      beforeEach(() => {
        mockGetAnonWorkData.mockReturnValue(null);
        mockSignInAction.mockResolvedValue({ success: true });
      });

      test("navigates to the most recent existing project", async () => {
        mockGetProjects.mockResolvedValue([
          { id: "recent-project", name: "Latest" },
          { id: "old-project", name: "Older" },
        ]);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password");
        });

        expect(mockPush).toHaveBeenCalledWith("/recent-project");
        expect(mockCreateProject).not.toHaveBeenCalled();
      });

      test("creates a new project when no projects exist", async () => {
        mockGetProjects.mockResolvedValue([]);
        mockCreateProject.mockResolvedValue({ id: "brand-new-id" });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password");
        });

        expect(mockCreateProject).toHaveBeenCalledWith({
          name: expect.stringMatching(/^New Design #\d+$/),
          messages: [],
          data: {},
        });
        expect(mockPush).toHaveBeenCalledWith("/brand-new-id");
      });

      test("new project name contains a numeric suffix", async () => {
        mockGetProjects.mockResolvedValue([]);
        mockCreateProject.mockResolvedValue({ id: "brand-new-id" });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password");
        });

        const [{ name }] = mockCreateProject.mock.calls[0];
        expect(name).toMatch(/^New Design #\d+$/);
      });
    });
  });
});
