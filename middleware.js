export default function middleware(request) {
  const country = request.headers.get("x-vercel-ip-country");

  if (country === "SG") {
    return new Response("Access blocked", {
      status: 403,
      headers: {
        "content-type": "text/plain; charset=utf-8"
      }
    });
  }

  return;
}

export const config = {
  matcher: [
    "/((?!api|_next|assets|favicon.ico|robots.txt|sitemap.xml).*)"
  ]
};