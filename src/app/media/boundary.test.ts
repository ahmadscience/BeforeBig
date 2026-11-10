import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user:vi.fn(),rate:vi.fn(),store:vi.fn(),storage:vi.fn(),assertEditable:vi.fn(),upload:vi.fn(),readable:vi.fn(),read:vi.fn(),edit:vi.fn(),moderate:vi.fn(),revalidate:vi.fn() }));
vi.mock("@/lib/auth",()=>({getCurrentUser:mocks.user}));
vi.mock("@/lib/rate-limit",()=>({consumeRateLimit:mocks.rate}));
vi.mock("@/db/media",()=>({getMediaStore:mocks.store}));
vi.mock("@/lib/media-storage",()=>({getMediaStorage:mocks.storage}));
vi.mock("@/lib/media-service",()=>({uploadMedia:mocks.upload,readMedia:mocks.read,removeMedia:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));
import { POST } from "@/app/api/products/[slug]/media/route";
import { GET } from "@/app/media/[id]/route";
import { mediaAction } from "@/app/media/actions";
import { MediaError } from "@/lib/media";
const id="11111111-1111-4111-8111-111111111111";
const context={params:Promise.resolve({slug:"test-product"})};
const request=(origin: string | null = "https://app.example")=>new Request("https://app.example/api/products/test-product/media",{method:"POST",body:"not decoded here",headers:origin?{origin}:{}});
beforeEach(()=>{
  vi.resetAllMocks();vi.stubEnv("NEXT_PUBLIC_APP_URL","https://app.example");vi.stubEnv("MEDIA_UPLOADS_ENABLED","true");
  mocks.user.mockResolvedValue({id:"trusted-session",role:"founder"});mocks.rate.mockResolvedValue({allowed:true});
  mocks.store.mockReturnValue({assertEditable:mocks.assertEditable,readable:mocks.readable,edit:mocks.edit,moderate:mocks.moderate});mocks.storage.mockReturnValue({});mocks.upload.mockResolvedValue({id,status:"pending"});
});
describe("media HTTP/action boundary",()=>{
  it("rejects foreign/missing origins and signed-out uploads before reading bodies or storage",async()=>{
    for(const origin of ["https://evil.example",null]) expect((await POST(request(origin),context)).status).toBe(403);
    expect(mocks.upload).not.toHaveBeenCalled();expect(mocks.storage).not.toHaveBeenCalled();
    mocks.user.mockResolvedValue(null);expect((await POST(request(),context)).status).toBe(401);expect(mocks.rate).not.toHaveBeenCalled();
  });
  it("checks ownership, disabled storage, and durable limits before processing",async()=>{
    mocks.assertEditable.mockRejectedValueOnce(new MediaError("Unavailable",404));expect((await POST(request(),context)).status).toBe(404);expect(mocks.storage).not.toHaveBeenCalled();
    vi.stubEnv("MEDIA_UPLOADS_ENABLED","false");expect((await POST(request(),context)).status).toBe(503);expect(mocks.upload).not.toHaveBeenCalled();
    vi.stubEnv("MEDIA_UPLOADS_ENABLED","true");mocks.rate.mockResolvedValue({allowed:false});expect((await POST(request(),context)).status).toBe(429);expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("returns pending-only upload data and sanitizes unexpected failures",async()=>{
    const response=await POST(request(),context);expect(response.status).toBe(201);expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.upload.mock.calls[0][2]).toEqual({id:"trusted-session",role:"founder"});expect(mocks.revalidate).toHaveBeenCalledWith("/admin/moderation");
    mocks.upload.mockRejectedValueOnce(Error("secret provider credential"));const failed=await POST(request(),context);expect(failed.status).toBe(503);expect(JSON.stringify(await failed.json())).not.toContain("credential");
  });
  it("hides inaccessible IDs without touching storage and disables every media cache",async()=>{
    const ctx={params:Promise.resolve({id})};mocks.readable.mockResolvedValue(null);
    expect((await GET(new Request("https://app.example/media/"+id),ctx)).status).toBe(404);expect(mocks.storage).not.toHaveBeenCalled();
    mocks.readable.mockResolvedValue({id});mocks.read.mockResolvedValue(Buffer.from("trusted webp"));
    const response=await GET(new Request("https://app.example/media/"+id),ctx);
    expect(response.headers.get("cache-control")).toBe("private, no-store");expect(response.headers.get("vary")).toBe("Cookie");expect(response.headers.get("x-content-type-options")).toBe("nosniff");expect(response.headers.get("content-type")).toBe("image/webp");expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect((await GET(new Request("https://app.example/media/x"),{params:Promise.resolve({id:"../../secret"})})).status).toBe(404);
  });
  it("uses session identity in actions and fails closed on rate/provider errors",async()=>{
    const form=new FormData();form.set("operation","metadata");form.set("id",id);form.set("actorUserId","forged");form.set("role","admin");form.set("altText","Project board");
    expect(await mediaAction({},form)).toHaveProperty("message");expect(mocks.edit.mock.calls[0][0]).toEqual({id:"trusted-session",role:"founder"});
    mocks.rate.mockResolvedValue({allowed:false});mocks.edit.mockClear();expect(await mediaAction({},form)).toHaveProperty("error");expect(mocks.edit).not.toHaveBeenCalled();
    mocks.rate.mockRejectedValue(Error("credential example"));expect(await mediaAction({},form)).toEqual({error:"Media changes could not be saved. Try again later."});
    mocks.user.mockResolvedValue(null);expect(await mediaAction({},form)).toEqual({error:"Sign in to manage images."});
  });
});
