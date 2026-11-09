type MagicLinkMessage = {
  to: string;
  link: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}

export async function sendMagicLinkEmail({ to, link }: MagicLinkMessage) {
  const provider = process.env.EMAIL_PROVIDER;
  const apiKey = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!provider || !apiKey || !from) throw new Error("Email delivery is not configured.");

  const subject = "Your BeforeBig sign-in link";
  const text = `Sign in to BeforeBig: ${link}\n\nThis link expires in 15 minutes and can only be used once.`;
  const html = `<p>Sign in to BeforeBig:</p><p><a href="${escapeHtml(link)}">Continue to BeforeBig</a></p><p>This link expires in 15 minutes and can only be used once.</p>`;

  if (provider === "resend") {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("Email delivery failed.");
    return;
  }

  if (provider === "postmark") {
    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: { "X-Postmark-Server-Token": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ From: from, To: to, Subject: subject, TextBody: text, HtmlBody: html, MessageStream: "outbound" }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("Email delivery failed.");
    return;
  }

  if (provider === "mailgun") {
    const domain = process.env.MAILGUN_DOMAIN?.trim().toLowerCase();
    const baseUrl = process.env.MAILGUN_API_BASE_URL?.trim().replace(/\/$/, "") || "https://api.mailgun.net";
    if (!domain || !/^[a-z0-9.-]+$/.test(domain)) throw new Error("Mailgun domain is not configured.");
    if (!new Set(["https://api.mailgun.net", "https://api.eu.mailgun.net"]).has(baseUrl)) throw new Error("Mailgun API region is invalid.");

    const body = new URLSearchParams({ from, to, subject, text, html });
    const response = await fetch(`${baseUrl}/v3/${encodeURIComponent(domain)}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("Email delivery failed.");
    return;
  }

  throw new Error("Unsupported email provider.");
}
