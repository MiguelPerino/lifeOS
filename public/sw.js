/* Push only: authenticated pages and API responses are never cached. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("push", (event) => {
  let message = {};
  try {
    message = event.data?.json() ?? {};
  } catch {
    /* Show a safe fallback. */
  }
  event.waitUntil(
    self.registration.showNotification(message.title || "LifeOS", {
      body: message.body || "Você tem um novo lembrete.",
      icon: "/icons/lifeos-192.png",
      tag: message.key || "lifeos",
      data: { url: message.url || "/today" },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let target = new URL("/today", self.location.origin);
  try {
    const requested = new URL(event.notification.data?.url || "/today", self.location.origin);
    if (requested.origin === self.location.origin) target = requested;
  } catch {
    /* Keep the safe default URL. */
  }
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === target.origin && "navigate" in client) {
          const navigated = await client.navigate(target.href);
          if (navigated) return navigated.focus();
        }
      }
      return self.clients.openWindow(target.href);
    })(),
  );
});
