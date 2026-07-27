import { LOGO_ARTWORK } from "../constants/logos";
import type { LogoName } from "../types";

interface LogoProps {
  name: LogoName;
  className?: string;
}

export function Logo({ name, className }: LogoProps) {
  const artwork = LOGO_ARTWORK[name];

  return (
    <svg
      viewBox={artwork.viewBox}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {artwork.shapes.map((shape) =>
        shape.kind === "circle" ? (
          <circle
            key={shape.id}
            cx={shape.cx}
            cy={shape.cy}
            r={shape.r}
            fill={shape.fill}
            fillRule={shape.fillRule}
            fillOpacity={shape.fillOpacity}
          />
        ) : (
          <path
            key={shape.id}
            d={shape.d}
            fill={shape.fill}
            fillRule={shape.fillRule}
            fillOpacity={shape.fillOpacity}
          />
        ),
      )}
    </svg>
  );
}
