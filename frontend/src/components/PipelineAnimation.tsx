import React from 'react';

export default function PipelineAnimation() {
  return (
    <div className="hidden lg:block absolute right-0 top-[40%] -translate-y-1/2 w-[360px] h-[300px] xl:w-[600px] xl:h-[500px] pointer-events-none select-none opacity-90">
      <svg viewBox="0 0 600 500" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#8b5cf6" stopOpacity="1" />
            <stop offset="100%" stopColor="#ec4899" stopOpacity="0.1" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* --- Connecting Lines (Data Flow) --- */}
        <path d="M120 100 C 200 100, 200 250, 300 250" fill="none" stroke="url(#lineGradient)" strokeWidth="2" />
        <path d="M120 250 C 200 250, 200 250, 300 250" fill="none" stroke="url(#lineGradient)" strokeWidth="2" />
        <path d="M120 400 C 200 400, 200 250, 300 250" fill="none" stroke="url(#lineGradient)" strokeWidth="2" />
        
        <path d="M300 250 C 400 250, 400 250, 480 250" fill="none" stroke="url(#lineGradient)" strokeWidth="2" />

        <path d="M480 250 C 520 250, 520 150, 550 150" fill="none" stroke="url(#lineGradient)" strokeWidth="2" />
        <path d="M480 250 C 520 250, 520 350, 550 350" fill="none" stroke="url(#lineGradient)" strokeWidth="2" />

        {/* --- Animated Particles --- */}
        <circle r="4" fill="#60a5fa" filter="url(#glow)">
          <animateMotion dur="3s" repeatCount="indefinite" path="M120 100 C 200 100, 200 250, 300 250" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.4 0 0.2 1" />
        </circle>
        <circle r="4" fill="#818cf8" filter="url(#glow)">
          <animateMotion dur="3s" begin="1s" repeatCount="indefinite" path="M120 250 C 200 250, 200 250, 300 250" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.4 0 0.2 1" />
        </circle>
        <circle r="4" fill="#c084fc" filter="url(#glow)">
          <animateMotion dur="3s" begin="2s" repeatCount="indefinite" path="M120 400 C 200 400, 200 250, 300 250" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.4 0 0.2 1" />
        </circle>
        
        <circle r="5" fill="#e879f9" filter="url(#glow)">
          <animateMotion dur="2s" begin="0.5s" repeatCount="indefinite" path="M300 250 C 400 250, 400 250, 480 250" />
        </circle>

        {/* --- Nodes --- */}
        
        {/* Source Nodes (Left) */}
        <g transform="translate(60, 100)">
          <rect x="-40" y="-30" width="80" height="60" rx="4" fill="#0f172a" stroke="#334155" strokeWidth="2" />
          <text x="0" y="5" textAnchor="middle" fill="#94a3b8" fontSize="12" fontWeight="600" style={{fontFamily: 'monospace'}}>API</text>
        </g>
        <g transform="translate(60, 250)">
          <rect x="-40" y="-30" width="80" height="60" rx="4" fill="#0f172a" stroke="#334155" strokeWidth="2" />
          <text x="0" y="5" textAnchor="middle" fill="#94a3b8" fontSize="12" fontWeight="600" style={{fontFamily: 'monospace'}}>SQL</text>
        </g>
        <g transform="translate(60, 400)">
          <rect x="-40" y="-30" width="80" height="60" rx="4" fill="#0f172a" stroke="#334155" strokeWidth="2" />
          <text x="0" y="5" textAnchor="middle" fill="#94a3b8" fontSize="12" fontWeight="600" style={{fontFamily: 'monospace'}}>S3</text>
        </g>

        {/* Central Processor */}
        <g transform="translate(300, 250)">
          <circle r="40" fill="#1e1b4b" stroke="#8b5cf6" strokeWidth="2" />
          <circle r="32" fill="none" stroke="#6d28d9" strokeWidth="2" strokeDasharray="4 4" opacity="0.5">
            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="8s" repeatCount="indefinite" />
          </circle>
          <text x="0" y="4" textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="bold" style={{fontFamily: 'monospace'}}>CORE</text>
        </g>

        {/* Storage Node (Right) */}
        <g transform="translate(480, 250)">
          <path d="M-30,-40 L30,-40 L30,40 L-30,40 Z" fill="#0f172a" stroke="#334155" strokeWidth="2" />
          <ellipse cx="0" cy="-40" rx="30" ry="10" fill="#1e293b" stroke="#334155" strokeWidth="2" />
          <path d="M-30,-40 A30,10 0 0,0 30,-40" fill="#0f172a" />
          <text x="0" y="5" textAnchor="middle" fill="#cbd5e1" fontSize="10" fontWeight="600" style={{fontFamily: 'monospace'}}>DATA</text>
        </g>

        {/* Consumer Nodes (Far Right) */}
        <g transform="translate(550, 150)">
          <rect x="-25" y="-20" width="50" height="40" rx="4" fill="#0f172a" stroke="#334155" strokeWidth="2" />
          <text x="0" y="5" textAnchor="middle" fill="#64748b" fontSize="10" style={{fontFamily: 'monospace'}}>BI</text>
        </g>
        <g transform="translate(550, 350)">
          <rect x="-25" y="-20" width="50" height="40" rx="4" fill="#0f172a" stroke="#334155" strokeWidth="2" />
          <text x="0" y="5" textAnchor="middle" fill="#64748b" fontSize="10" style={{fontFamily: 'monospace'}}>ML</text>
        </g>
      </svg>
    </div>
  );
}
