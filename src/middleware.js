import { NextResponse } from "next/server";

const toSeoHandle = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export function middleware(request) {
  const url = request.nextUrl.clone();
  const { pathname } = url;

  if (!pathname.startsWith("/collections/")) {
    return NextResponse.next();
  }

  const segments = pathname.split("/").filter(Boolean);
  const hasTypeQuery = url.searchParams.has("type");
  const hasTypeHandleQuery = url.searchParams.has("typeHandle");
  const queryTypeValue =
    url.searchParams.get("type") || url.searchParams.get("typeHandle");

  // Legacy query URL -> canonical path URL
  // /collections/necklaces?type=layered-necklace -> /collections/necklaces/layered-necklace
  if (segments.length === 2 && queryTypeValue) {
    const canonicalTypeHandle = toSeoHandle(queryTypeValue);
    if (!canonicalTypeHandle) {
      return NextResponse.next();
    }

    url.pathname = `/collections/${segments[1]}/${canonicalTypeHandle}`;
    url.searchParams.delete("type");
    url.searchParams.delete("typeHandle");
    return NextResponse.redirect(url, 308);
  }

  // If canonical path already has type segment, strip duplicate query keys.
  if (segments.length >= 3 && (hasTypeQuery || hasTypeHandleQuery)) {
    url.searchParams.delete("type");
    url.searchParams.delete("typeHandle");
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/collections/:path*"],
};
