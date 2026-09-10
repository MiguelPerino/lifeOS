"use client";
import { api } from "@/lib/client-api";

export async function currentPushSubscription() {
  if (!("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration("/");
  return (await registration?.pushManager?.getSubscription()) ?? null;
}
export async function disableDevicePush() {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  // Delete on the server first, so a failed request cannot leave a signed-out device subscribed.
  await api("/api/notifications/subscription", { endpoint: subscription.endpoint }, "DELETE");
  await subscription.unsubscribe();
}
export async function enableDevicePush() {
  if (
    !window.isSecureContext ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  )
    throw new Error("Abra o LifeOS no Chrome atualizado, usando o endereço HTTPS.");
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
    throw new Error("As notificações ainda não foram configuradas.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error("Permita as notificações nas configurações deste site no Chrome.");
  await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  const registration = await navigator.serviceWorker.ready;
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY.replace(/-/g, "+").replace(/_/g, "/");
  const applicationServerKey = Uint8Array.from(atob(key), (char) => char.charCodeAt(0));
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey }));
  try {
    await api("/api/notifications/subscription", subscription.toJSON());
  } catch (error) {
    if (!existing) await subscription.unsubscribe();
    throw error;
  }
  return subscription;
}
