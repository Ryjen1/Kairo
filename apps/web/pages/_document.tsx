/**
 * Next.js 15.0.3 has a known issue where the App Router build silently
 * needs a pages/_document.tsx for /404 prerender resolution even when
 * everything else uses the App Router. This shim resolves
 * `PageNotFoundError: Cannot find module for page: /_document` during
 * `next build`. It is never rendered at runtime.
 */
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
