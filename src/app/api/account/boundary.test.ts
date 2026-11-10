import { beforeEach,afterEach,describe,expect,it,vi } from "vitest";
const mocks=vi.hoisted(()=>({cookie:vi.fn(),set:vi.fn(),deleteCookie:vi.fn(),identity:vi.fn(),export:vi.fn(),remove:vi.fn(),sessions:vi.fn(),rate:vi.fn(),mediaStore:vi.fn(),storage:vi.fn(),revalidate:vi.fn(),record:vi.fn(),product:vi.fn()}));
vi.mock("next/headers",()=>({cookies:async()=>({get:mocks.cookie,set:mocks.set,delete:mocks.deleteCookie})}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));
vi.mock("@/db/account",()=>({getAccountStore:()=>({identity:mocks.identity,exportData:mocks.export,deleteAccount:mocks.remove,revokeOthers:mocks.sessions})}));
vi.mock("@/db/media",()=>({getMediaStore:mocks.mediaStore}));
vi.mock("@/lib/media-storage",()=>({getMediaStorage:mocks.storage}));
vi.mock("@/lib/rate-limit",()=>({consumeRateLimit:mocks.rate}));
vi.mock("@/lib/analytics",()=>({recordAnalyticsEvent:mocks.record}));
vi.mock("@/lib/products",()=>({findProductBySlug:mocks.product}));
import { POST as exportAccount } from "@/app/api/account/export/route";
import { POST as deleteAccount } from "@/app/api/account/delete/route";
import { POST as revokeSessions } from "@/app/api/account/sessions/route";
import { POST as privacy } from "@/app/api/privacy/route";
import { POST as analytics } from "@/app/api/analytics/route";
import { GET as outbound } from "@/app/go/[slug]/route";
import { AccountError } from "@/lib/account";
const request=(input?:unknown,origin:string|null="https://app.example")=>new Request("https://app.example/api/account/export",{method:"POST",headers:{...(origin?{origin}:{}),"content-type":"application/json"},body:input?JSON.stringify(input):undefined});
beforeEach(()=>{
  vi.resetAllMocks();vi.stubEnv("NEXT_PUBLIC_APP_URL","https://app.example");
  mocks.cookie.mockReturnValue({value:"trusted-session-token"});mocks.identity.mockResolvedValue({user:{id:"trusted-user"}});mocks.rate.mockResolvedValue({allowed:true});mocks.export.mockResolvedValue('{"format":"beforebig-account"}');mocks.remove.mockResolvedValue({cleanup:[],message:"Account deleted",removedProducts:0,retainedProducts:1});
});
afterEach(()=>vi.unstubAllEnvs());
describe("account request boundary",()=>{
  it("rejects missing/foreign origins and absent sessions before reading account data",async()=>{
    for(const origin of [null,"https://evil.example"])expect((await exportAccount(request(undefined,origin))).status).toBe(403);
    expect(mocks.export).not.toHaveBeenCalled();mocks.cookie.mockReturnValue(undefined);expect((await exportAccount(request())).status).toBe(401);expect(mocks.identity).not.toHaveBeenCalled();
  });
  it("derives identity from the cookie hash, requires fresh access, and fails closed on rate limits",async()=>{
    const result=await exportAccount(request({userId:"forged",fresh:true}));expect(result.status).toBe(200);expect(mocks.identity.mock.calls[0][0]).not.toBe("forged");expect(mocks.identity.mock.calls[0][2]).toBe(true);expect(mocks.rate.mock.calls[0][0].actorKey).toBe("trusted-user");
    mocks.identity.mockRejectedValueOnce(new AccountError("Confirm access",403));expect((await deleteAccount(request({confirmation:"DELETE"}))).status).toBe(403);expect(mocks.remove).not.toHaveBeenCalled();
    mocks.rate.mockResolvedValue({allowed:false});expect((await revokeSessions(request())).status).toBe(429);expect(mocks.sessions).not.toHaveBeenCalled();
  });
  it("forces a private JSON attachment with no-store and never returns provider errors",async()=>{
    const response=await exportAccount(request());expect(response.headers.get("cache-control")).toContain("no-store");expect(response.headers.get("vary")).toBe("Cookie");expect(response.headers.get("content-disposition")).toContain('attachment; filename="beforebig-account.json"');
    mocks.export.mockRejectedValueOnce(Error("database credential do-not-print"));const failed=await exportAccount(request());expect(failed.status).toBe(503);expect(await failed.text()).not.toContain("credential");
  });
  it("does not clear a session on failed deletion and never publishes internal cleanup keys",async()=>{
    mocks.remove.mockRejectedValueOnce(new AccountError("Type DELETE",422));expect((await deleteAccount(request({confirmation:"bad"}))).status).toBe(422);expect(mocks.set).not.toHaveBeenCalled();
    mocks.remove.mockResolvedValue({cleanup:[{id:"image",storageKey:"private-object-key"}],message:"Account deleted"});mocks.storage.mockImplementation(()=>{throw Error("provider unavailable");});
    const response=await deleteAccount(request({confirmation:"DELETE",understood:true,products:"remove"}));expect(response.status).toBe(200);const data=await response.json();expect(data.imagesPendingCleanup).toBe(1);expect(JSON.stringify(data)).not.toContain("private-object-key");expect(mocks.set).toHaveBeenCalledWith("beforebig_session","",expect.objectContaining({maxAge:0,httpOnly:true,path:"/"}));expect(mocks.revalidate).toHaveBeenCalledWith("/","layout");
  });
  it("expires the production host-only session cookie with the required Secure flag",async()=>{
    vi.stubEnv("NODE_ENV","production");const response=await deleteAccount(request({confirmation:"DELETE",understood:true,products:"remove"}));expect(response.status).toBe(200);expect(mocks.set).toHaveBeenCalledWith("__Host-beforebig","",expect.objectContaining({secure:true,httpOnly:true,path:"/",maxAge:0}));
  });
  it("bounds deletion confirmation bodies",async()=>{
    const response=await deleteAccount(request({confirmation:"x".repeat(3000)}));expect(response.status).toBe(400);expect(mocks.remove).not.toHaveBeenCalled();
  });
});
describe("browser analytics choices",()=>{
  it("sets only validated same-origin preferences and does not change account identity",async()=>{
    expect((await privacy(request({choice:"deny"}))).status).toBe(200);expect(mocks.set.mock.calls[0].slice(0,2)).toEqual(["beforebig_privacy","deny"]);expect(mocks.identity).not.toHaveBeenCalled();
    expect((await privacy(request({choice:"not-valid"}))).status).toBe(422);expect((await privacy(request({choice:"allow"},"https://evil.example"))).status).toBe(403);
  });
  it("does not record page events or outbound clicks without opt-in or with GPC",async()=>{
    mocks.product.mockResolvedValue({websiteUrl:"https://product.example"});
    for(const choice of [undefined,"deny","allow"]){mocks.cookie.mockReturnValue(choice?{value:choice}:undefined);const headers:Record<string,string>=choice==="allow"?{"sec-gpc":"1"}:{};expect((await analytics(new Request("https://app.example/api/analytics",{method:"POST",headers}))).status).toBe(204);await outbound(new Request("https://app.example/go/tool",{headers}),{params:Promise.resolve({slug:"tool"})});}
    expect(mocks.record).not.toHaveBeenCalled();
    mocks.cookie.mockReturnValue({value:"allow"});await analytics(new Request("https://app.example/api/analytics",{method:"POST",body:JSON.stringify({eventType:"page_view"})}));expect(mocks.record).toHaveBeenCalledOnce();
  });
});
