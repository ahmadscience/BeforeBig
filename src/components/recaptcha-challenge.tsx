"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef } from "react";

declare global {
  interface Window {
    grecaptcha?: {
      render: (element: HTMLElement, options: Record<string, string>) => number;
    };
  }
}

export function RecaptchaChallenge({ siteKey }: { siteKey: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  const renderChallenge = useCallback(() => {
    if (!containerRef.current || !window.grecaptcha || widgetIdRef.current !== null) return;
    widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
      sitekey: siteKey,
      theme: document.documentElement.dataset.theme === "light" ? "light" : "dark",
      size: window.innerWidth <= 350 ? "compact" : "normal",
    });
  }, [siteKey]);

  useEffect(() => {
    renderChallenge();
  }, [renderChallenge]);

  return (
    <>
      <Script src="https://www.google.com/recaptcha/api.js?render=explicit" strategy="afterInteractive" onReady={renderChallenge} />
      <div ref={containerRef} className="recaptcha-slot" aria-label="Google reCAPTCHA verification" />
    </>
  );
}
