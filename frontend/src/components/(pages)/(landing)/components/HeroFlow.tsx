import { BlockCardBody } from "@/components/ui/BlockCardBody";
import { Logo } from "@/components/ui/Logo";
import {
  FLOW_CARDS,
  FLOW_CONNECTORS,
  FLOW_HEIGHT,
  FLOW_WIDTH,
} from "../constants";

const CARD_HEIGHT = 72;

export function HeroFlow() {
  return (
    <div className="scroll-slim overflow-x-auto">
      <div
        style={{ width: FLOW_WIDTH, height: FLOW_HEIGHT }}
        className="relative mx-auto"
      >
        <svg
          viewBox={`0 0 ${FLOW_WIDTH} ${FLOW_HEIGHT}`}
          className="absolute inset-0 size-full"
        >
          <title>Strategy flow preview</title>
          {FLOW_CONNECTORS.map((connector) => (
            <path
              key={connector.id}
              d={connector.path}
              fill="none"
              strokeWidth={1.5}
              className="stroke-line-strong"
            />
          ))}

          {FLOW_CONNECTORS.filter((connector) => connector.label).map(
            (connector) => (
              <g key={`${connector.id}-label`}>
                <rect
                  x={(connector.labelX ?? 0) - 34}
                  y={(connector.labelY ?? 0) - 11}
                  width={68}
                  height={22}
                  className="fill-surface stroke-line"
                />
                <text
                  x={connector.labelX}
                  y={(connector.labelY ?? 0) + 4}
                  textAnchor="middle"
                  className="fill-ink-muted text-[11px]"
                >
                  {connector.label}
                </text>
              </g>
            ),
          )}
        </svg>

        {FLOW_CARDS.map((card) => (
          <article
            key={card.id}
            style={{
              left: card.x,
              top: card.y,
              width: card.width,
              height: CARD_HEIGHT,
            }}
            className="absolute flex border border-line bg-surface shadow-sm"
          >
            <BlockCardBody
              title={card.title}
              subtitle={card.subtitle}
              tile={<Logo name={card.logo} className="size-8" />}
              trailing={
                <span className="absolute top-1/2 -right-2.5 grid size-5 -translate-y-1/2 place-items-center border border-line bg-surface text-ink-subtle">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    className="size-3"
                    aria-hidden="true"
                  >
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                </span>
              }
            />
          </article>
        ))}
      </div>
    </div>
  );
}
