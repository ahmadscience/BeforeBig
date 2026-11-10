import { afterEach,beforeEach,expect,it,vi } from "vitest";
const preference=vi.hoisted(()=>({choice:undefined as string|undefined,gpc:null as string|null}));
vi.mock("next/headers",()=>({cookies:async()=>({get:()=>preference.choice?{value:preference.choice}:undefined}),headers:async()=>({get:()=>preference.gpc})}));
import { GoogleAnalytics } from "@/components/google-analytics";
beforeEach(()=>{preference.choice=undefined;preference.gpc=null;vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID","G-TEST123");});
afterEach(()=>vi.unstubAllEnvs());
it("omits optional GA scripts without opt-in and when GPC overrides an allow preference",async()=>{
  expect(await GoogleAnalytics()).toBeNull();preference.choice="deny";expect(await GoogleAnalytics()).toBeNull();preference.choice="allow";preference.gpc="1";expect(await GoogleAnalytics()).toBeNull();preference.gpc=null;expect(await GoogleAnalytics()).not.toBeNull();
});
