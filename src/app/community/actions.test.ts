import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(), rate: vi.fn(), create: vi.fn(), propose: vi.fn(), revalidate: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: mocks.rate }));
vi.mock("@/db/community", () => ({ getCommunityStore: () => ({ createCollection: mocks.create, propose: mocks.propose }) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
import { communityAction } from "@/app/community/actions";

function form(operation: string) { const data = new FormData(); data.set("operation", operation); data.set("title", "Team tools"); return data; }

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "trusted-session-user", role: "scout" });
  mocks.rate.mockResolvedValue({ allowed: true });
  mocks.create.mockResolvedValue("11111111-1111-4111-8111-111111111111");
});
describe("community action boundary", () => {
  it("requires a session before any write", async () => {
    mocks.user.mockResolvedValue(null);
    expect(await communityAction({}, form("create"))).toHaveProperty("error", "Sign in to use recommendations and collections.");
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.rate).not.toHaveBeenCalled();
  });
  it("uses the session actor instead of forged form identity and revalidates reads", async () => {
    const data = form("create"); data.set("ownerUserId", "another-user"); data.set("role", "admin");
    const result = await communityAction({}, data);
    expect(result.href).toBe("/collections/11111111-1111-4111-8111-111111111111");
    expect(mocks.create.mock.calls[0][0]).toEqual({ id: "trusted-session-user", role: "scout" });
    expect(mocks.revalidate).toHaveBeenCalledWith("/collections", "layout");
  });
  it("fails closed when durable rate limiting denies writes", async () => {
    mocks.rate.mockResolvedValue({ allowed: false });
    expect(await communityAction({}, form("create"))).toHaveProperty("error");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("does not return raw provider errors or accept invalid operations", async () => {
    mocks.create.mockRejectedValue(new Error("database credential secret-example-do-not-expose"));
    const result = await communityAction({}, form("create"));
    expect(result.error).toBe("Changes could not be saved. Check your connection and try again.");
    expect(await communityAction({}, form("delete-other-account"))).toHaveProperty("error");
  });
});
