import { describe,expect,it } from "vitest";import { assertSafeUrl } from "./security";
describe("SSRF",()=>{it("rejects local networks",()=>{for(const u of ['http://localhost/x','http://127.0.0.1/x','http://192.168.1.2/x'])expect(()=>assertSafeUrl(u)).toThrow()});it("accepts public https",()=>expect(assertSafeUrl('https://example.org/a').hostname).toBe('example.org'))});
