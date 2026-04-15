export function buildRedirectUrl(
  requestUrl: string,
  redirectTo: string,
  params: URLSearchParams,
) {
  const url = new URL(redirectTo, requestUrl);

  for (const [key, value] of params.entries()) {
    url.searchParams.set(key, value);
  }

  return url;
}
