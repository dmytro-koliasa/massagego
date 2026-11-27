const routes = [
  "/client/login",
  "/masseur/login",
  "/admin/login",
  "/client",
  "/",
];

for (const route of routes) {
  const res = await fetch(`http://127.0.0.1:3001${route}`, {
    redirect: "manual",
  });
  const html = res.status < 400 ? await res.text() : "";
  const robotsMatch =
    html.match(/name=["']robots["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/content=["']([^"']+)["'][^>]*name=["']robots["']/i);
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  console.log(
    JSON.stringify({
      route,
      status: res.status,
      robots: robotsMatch?.[1] ?? null,
      title: titleMatch?.[1] ?? null,
      hasHydrationErrorMarker: /hydration|Hydration/i.test(html) && false,
    }),
  );
}
