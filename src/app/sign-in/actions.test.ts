import { beforeEach,describe,expect,it,vi } from "vitest";
const mocks=vi.hoisted(()=>({user:vi.fn(),create:vi.fn(),rate:vi.fn(),captcha:vi.fn()}));
vi.mock("next/headers",()=>({headers:async()=>new Headers()}));
vi.mock("@/lib/auth",()=>({getCurrentUser:mocks.user,createMagicLink:mocks.create}));
vi.mock("@/lib/rate-limit",()=>({consumeRateLimit:mocks.rate}));
vi.mock("@/lib/recaptcha",()=>({anonymousRecaptchaRequired:()=>true,verifyRecaptchaToken:mocks.captcha}));
vi.mock("@/lib/config",()=>({appConfig:{appUrl:"https://app.example",emailFeatureEnabled:false,authDevMagicLinkEnabled:true}}));
import { requestMagicLink } from "@/app/sign-in/actions";
function form(email:string){const data=new FormData();data.set("email",email);data.set("returnTo","/settings/privacy");return data;}
beforeEach(()=>{vi.resetAllMocks();mocks.user.mockResolvedValue({id:"signed-in",email:"owner@example.test"});mocks.rate.mockResolvedValue({allowed:true});mocks.create.mockResolvedValue({token:"fictional-test-token"});mocks.captcha.mockResolvedValue({verified:false});});
describe("account reauthentication",()=>{
  it("sends a new link for the signed-in account without an anonymous CAPTCHA",async()=>{expect(await requestMagicLink({},form("owner@example.test"))).toHaveProperty("devMagicLink");expect(mocks.captcha).not.toHaveBeenCalled();expect(mocks.create).toHaveBeenCalledWith("owner@example.test","/settings/privacy");});
  it("rejects a forged different email before sending mail",async()=>{expect(await requestMagicLink({},form("another@example.test"))).toHaveProperty("error");expect(mocks.create).not.toHaveBeenCalled();});
  it("preserves CAPTCHA checks for anonymous sign-in",async()=>{mocks.user.mockResolvedValue(null);expect(await requestMagicLink({},form("owner@example.test"))).toHaveProperty("error","Complete the reCAPTCHA check and try again.");expect(mocks.captcha).toHaveBeenCalledOnce();expect(mocks.create).not.toHaveBeenCalled();});
});
