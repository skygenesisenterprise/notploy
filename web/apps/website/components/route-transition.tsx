"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

interface RouteTransitionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Thin route-change indicator shown on path changes.
 *
 * Styled with the ADS tokens (`var(--ads-*)`, provided by
 * `@codegouvaor/react-ads/main.css`) and inline styles — no local stylesheet.
 */
export function RouteTransition({ children, className }: RouteTransitionProps) {
  const pathname = usePathname();
  const [progress, setProgress] = React.useState(0);
  const [isVisible, setIsVisible] = React.useState(false);
  const prevPathname = React.useRef(pathname);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    if (prevPathname.current === pathname) return;

    prevPathname.current = pathname;
    setIsVisible(true);
    setProgress(0);

    let current = 0;
    intervalRef.current = setInterval(() => {
      current += Math.random() * 12 + 4;
      if (current >= 90) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setProgress(90);
        return;
      }
      setProgress(current);
    }, 100);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pathname]);

  React.useEffect(() => {
    if (!isVisible) return;

    if (intervalRef.current) clearInterval(intervalRef.current);

    setProgress(100);
    const timer = setTimeout(() => {
      setIsVisible(false);
      setProgress(0);
    }, 400);

    return () => clearTimeout(timer);
  }, [children, isVisible]);

  return (
    <div style={{ position: "relative" }} className={className}>
      {/* Progress bar */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "4px",
          zIndex: 100,
          opacity: isVisible ? 1 : 0,
          pointerEvents: isVisible ? "auto" : "none",
          transition: "opacity 300ms ease",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            transition: "width 150ms ease-out",
            background: "linear-gradient(90deg, #F47521 0%, #ff8c42 50%, #F47521 100%)",
            boxShadow:
              "0 0 12px rgba(244, 117, 33, 0.8), 0 0 24px rgba(244, 117, 33, 0.4)",
          }}
        />
      </div>

      {/* Content */}
      {children}
    </div>
  );
}
