import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

function worker() {
  const listeners: Record<string, (event: unknown) => void> = {};
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const openWindow = vi.fn().mockResolvedValue(undefined);
  const self = {
    location: { origin: "https://lifeos.test" },
    registration: { showNotification },
    clients: { matchAll: vi.fn().mockResolvedValue([]), openWindow },
    addEventListener: (name: string, callback: (event: unknown) => void) => {
      listeners[name] = callback;
    },
  };
  runInNewContext(readFileSync("public/sw.js", "utf8"), { self, URL });
  return { listeners, showNotification, openWindow };
}
describe("push service worker", () => {
  it("shows a safe fallback for malformed payloads", async () => {
    const { listeners, showNotification } = worker();
    let work: Promise<unknown> | undefined;
    listeners.push({
      data: {
        json: () => {
          throw new Error("bad JSON");
        },
      },
      waitUntil: (p: Promise<unknown>) => {
        work = p;
      },
    });
    await work;
    expect(showNotification).toHaveBeenCalledWith(
      "LifeOS",
      expect.objectContaining({ body: "Você tem um novo lembrete." }),
    );
  });
  it.each(["https://evil.test/", "javascript:alert(1)"])(
    "never opens an external notification URL: %s",
    async (url) => {
      const { listeners, openWindow } = worker();
      let work: Promise<unknown> | undefined;
      listeners.notificationclick({
        notification: { close: vi.fn(), data: { url } },
        waitUntil: (p: Promise<unknown>) => {
          work = p;
        },
      });
      await work;
      expect(openWindow).toHaveBeenCalledWith("https://lifeos.test/today");
    },
  );
  it("opens the task referenced by a notification", async () => {
    const { listeners, openWindow } = worker();
    let work: Promise<unknown> | undefined;
    listeners.notificationclick({
      notification: { close: vi.fn(), data: { url: "/tasks?id=123" } },
      waitUntil: (p: Promise<unknown>) => {
        work = p;
      },
    });
    await work;
    expect(openWindow).toHaveBeenCalledWith("https://lifeos.test/tasks?id=123");
  });
});
