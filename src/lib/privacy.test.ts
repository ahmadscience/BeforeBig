import { describe,expect,it } from "vitest";
import { analyticsAllowed } from "@/lib/privacy";
describe("optional measurement consent",()=>{
  it("requires an explicit allow choice and respects Global Privacy Control",()=>{
    for(const choice of [undefined,null,"","deny","true","forged"])expect(analyticsAllowed(choice,null)).toBe(false);
    expect(analyticsAllowed("allow",null)).toBe(true);expect(analyticsAllowed("allow","1")).toBe(false);expect(analyticsAllowed("deny","1")).toBe(false);
  });
});
