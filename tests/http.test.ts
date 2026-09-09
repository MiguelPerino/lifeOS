import { describe, expect, it } from "vitest";
import { assertOrigin } from "@/lib/http";

function request(
  origin?: string,
  host = "localhost:3000",
  url = "http://0.0.0.0:3000/api/records/tasks",
) {
  const headers = new Headers({ host });
  if (origin !== undefined) headers.set("origin", origin);
  return new Request(url, { method: "POST", headers });
}

describe("write origin validation", () => {
  it.each(["localhost:3000", "127.0.0.1:3000", "192.168.1.10:3000", "[::1]:3000"])(
    "accepts browser requests to %s when Next.js binds to 0.0.0.0",
    (host) => expect(() => assertOrigin(request(`http://${host}`, host))).not.toThrow(),
  );

  it("accepts the public host for HTTPS requests", () => {
    expect(() =>
      assertOrigin(
        request("https://lifeos.example", "lifeos.example", "https://internal/api/records/tasks"),
      ),
    ).not.toThrow();
  });

  it.each([
    undefined,
    "null",
    "invalid",
    "https://untrusted.example",
    "http://localhost:3001",
    "https://localhost:3000",
    "http://localhost:3000.evil.example",
    "http://localhost:3000/path",
    "http://user@localhost:3000",
    "http://0.0.0.0:3000",
  ])("rejects an invalid or different origin: %s", (origin) => {
    expect(() => assertOrigin(request(origin))).toThrow("Origem da solicitação inválida.");
  });

  it("does not trust a forwarded host supplied by the caller", () => {
    const req = request("https://untrusted.example");
    req.headers.set("x-forwarded-host", "untrusted.example");
    expect(() => assertOrigin(req)).toThrow("Origem da solicitação inválida.");
  });

  it("falls back to the request URL when Host is unavailable", () => {
    expect(() =>
      assertOrigin(
        new Request("http://localhost:3000/api/records/tasks", {
          headers: { origin: "http://localhost:3000" },
        }),
      ),
    ).not.toThrow();
  });
});
