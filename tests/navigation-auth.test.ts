import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const auth = vi.hoisted(() => ({
  getClaims: vi.fn(),
  getUser: vi.fn(),
  configured: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth }) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth }),
  supabaseConfigured: auth.configured,
}));
vi.mock("next/navigation", () => ({ redirect: auth.redirect }));
vi.mock("@/components/shell", () => ({ Shell: () => null }));
import { proxy } from "@/proxy";
import WorkspaceLayout from "@/app/(workspace)/layout";

beforeEach(() => {
  vi.clearAllMocks();
  auth.configured.mockReturnValue(true);
  auth.redirect.mockImplementation(() => {
    throw new Error("redirect-login");
  });
});
describe("navigation authentication", () => {
  it("verifies claims in the proxy instead of fetching the user record", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
    auth.getClaims.mockResolvedValue({ data: { claims: { sub: "owner" } }, error: null });
    try {
      const response = await proxy(new NextRequest("http://localhost:3000/tasks"));
      expect(auth.getClaims).toHaveBeenCalledOnce();
      expect(auth.getUser).not.toHaveBeenCalled();
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("renders the shell only after verified claims", async () => {
    auth.getClaims.mockResolvedValue({ data: { claims: { sub: "owner" } }, error: null });
    expect(await WorkspaceLayout({ children: null })).toBeTruthy();
    expect(auth.getUser).not.toHaveBeenCalled();
    expect(auth.redirect).not.toHaveBeenCalled();
  });
  it.each([
    { data: null, error: null },
    { data: { claims: {} }, error: null },
    { data: { claims: { sub: "owner" } }, error: new Error("invalid signature") },
  ])("rejects missing or invalid claims", async (result) => {
    auth.getClaims.mockResolvedValue(result);
    await expect(WorkspaceLayout({ children: null })).rejects.toThrow("redirect-login");
    expect(auth.redirect).toHaveBeenCalledWith("/login");
  });
});
