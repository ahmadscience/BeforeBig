import { afterEach, describe, expect, it, vi } from "vitest";
import { sendMagicLinkEmail } from "@/lib/email";

const emailEnvironmentKeys = [
  "EMAIL_PROVIDER",
  "EMAIL_API_KEY",
  "EMAIL_FROM",
  "MAILGUN_DOMAIN",
  "MAILGUN_API_BASE_URL",
] as const;

const originalEnvironment = Object.fromEntries(emailEnvironmentKeys.map((key) => [key, process.env[key]]));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const key of emailEnvironmentKeys) {
    const original = originalEnvironment[key];
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
});

describe("Mailgun email delivery", () => {
  it("sends a form-encoded magic link through the selected Mailgun region", async () => {
    process.env.EMAIL_PROVIDER = "mailgun";
    process.env.EMAIL_API_KEY = "test-mailgun-api-key";
    process.env.EMAIL_FROM = "BeforeBig <hello@mg.beforebig.test>";
    process.env.MAILGUN_DOMAIN = "mg.beforebig.test";
    process.env.MAILGUN_API_BASE_URL = "https://api.eu.mailgun.net";
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendMagicLinkEmail({ to: "founder@example.com", link: "https://beforebig.test/auth/verify?token=secret&next=%2Fdashboard" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.eu.mailgun.net/v3/mg.beforebig.test/messages");
    expect(request.method).toBe("POST");
    expect(request.headers).toMatchObject({
      Authorization: `Basic ${Buffer.from("api:test-mailgun-api-key").toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    });
    const body = request.body as URLSearchParams;
    expect(body.get("to")).toBe("founder@example.com");
    expect(body.get("subject")).toBe("Your BeforeBig sign-in link");
    expect(body.get("html")).toContain("&amp;next=");
  });

  it("rejects an unapproved Mailgun API origin before making a request", async () => {
    process.env.EMAIL_PROVIDER = "mailgun";
    process.env.EMAIL_API_KEY = "test-mailgun-api-key";
    process.env.EMAIL_FROM = "hello@beforebig.test";
    process.env.MAILGUN_DOMAIN = "mg.beforebig.test";
    process.env.MAILGUN_API_BASE_URL = "https://mailgun.invalid";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendMagicLinkEmail({ to: "founder@example.com", link: "https://beforebig.test/auth/verify?token=secret" })).rejects.toThrow("Mailgun API region is invalid.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
