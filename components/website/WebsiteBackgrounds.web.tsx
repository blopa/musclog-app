export function GridPattern({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`absolute inset-0 h-full w-full ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
          <path
            d="M 40 0 L 0 0 0 40"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            strokeOpacity="0.4"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid-pattern)" />
    </svg>
  );
}

export function DotPattern({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`absolute inset-0 h-full w-full ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="dot-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.15" fill="currentColor" fillOpacity="0.72" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dot-pattern)" />
    </svg>
  );
}

function HeroHexWatermark() {
  return (
    <svg
      className="absolute top-[210px] left-[-64px] h-[260px] w-[260px] text-emerald-400/12"
      viewBox="0 0 220 220"
      fill="none"
      aria-hidden="true"
    >
      <polygon
        points="110,12 191,58 191,162 110,208 29,162 29,58"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <polygon
        points="110,43 163,74 163,146 110,177 57,146 57,74"
        stroke="currentColor"
        strokeWidth="1.25"
      />
    </svg>
  );
}

export function FloatingShapes({ className = '' }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <svg
        className="text-primary/10 absolute -top-20 -right-20 h-96 w-96"
        viewBox="0 0 200 200"
        fill="none"
      >
        <circle cx="100" cy="100" r="80" stroke="currentColor" strokeWidth="0.5" />
        <circle cx="100" cy="100" r="60" stroke="currentColor" strokeWidth="0.5" />
        <circle cx="100" cy="100" r="40" stroke="currentColor" strokeWidth="0.5" />
      </svg>

      <svg
        className="text-primary/10 absolute top-1/3 -left-10 h-64 w-64"
        viewBox="0 0 100 100"
        fill="none"
      >
        <polygon
          points="50,5 90,25 90,75 50,95 10,75 10,25"
          stroke="currentColor"
          strokeWidth="0.5"
        />
        <polygon
          points="50,20 75,35 75,65 50,80 25,65 25,35"
          stroke="currentColor"
          strokeWidth="0.5"
        />
      </svg>

      <svg
        className="text-primary/10 absolute right-1/4 bottom-0 h-80 w-80"
        viewBox="0 0 100 100"
        fill="none"
      >
        {[...Array(5)].map((_, i) => (
          <line
            key={i}
            x1={i * 20}
            y1="0"
            x2={i * 20 + 100}
            y2="100"
            stroke="currentColor"
            strokeWidth="0.3"
          />
        ))}
      </svg>
    </div>
  );
}

export function HeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <GridPattern className="text-emerald-400/10" />
      <DotPattern className="text-emerald-400/20 opacity-75" />
      <HeroHexWatermark />

      <div className="from-background to-background absolute inset-0 bg-gradient-to-b via-transparent" />
      <div className="from-background to-background/50 absolute inset-0 bg-gradient-to-r via-transparent" />

      <div
        className="absolute top-12 right-[14%] h-[520px] w-[520px] rounded-full blur-[150px]"
        style={{ backgroundColor: 'rgba(0, 255, 163, 0.14)' }}
      />
      <div
        className="absolute bottom-[-40px] left-1/2 h-[240px] w-[70%] -translate-x-1/2 rounded-full blur-[120px]"
        style={{
          background:
            'radial-gradient(circle, rgba(34,197,94,0.16) 0%, rgba(34,197,94,0.08) 35%, rgba(0,0,0,0) 72%)',
        }}
      />
      <div className="absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-cyan-500/10 blur-[100px]" />

      <FloatingShapes />

      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

export function SectionBackground({ variant = 'dots' }: { variant?: 'dots' | 'grid' | 'minimal' }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {variant === 'dots' ? <DotPattern className="text-emerald-400/25" /> : null}
      {variant === 'grid' ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(34, 197, 94, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 197, 94, 0.15) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            backgroundPosition: 'center center',
          }}
        />
      ) : null}

      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-400/[0.03] to-transparent" />
      <div className="from-background absolute inset-x-0 top-0 h-16 bg-gradient-to-b to-transparent" />
      <div className="from-background absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t to-transparent" />
    </div>
  );
}
