import React from 'react';

export default function PipelineAnimation() {
  return (
    <div className="hidden lg:block absolute right-0 top-[40%] -translate-y-1/2 w-[360px] h-[300px] xl:w-[600px] xl:h-[500px] pointer-events-none select-none opacity-70">
      <svg viewBox="0 0 600 500" className="w-full h-full drop-shadow-2xl" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="flowGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#8b5cf6" stopOpacity="1" />
            <stop offset="100%" stopColor="#ec4899" stopOpacity="0.3" />
          </linearGradient>
          <filter id="iconGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* --- Connecting Lines (Data Flow) --- */}
        <g stroke="url(#flowGradient)" strokeWidth="2" fill="none" opacity="0.6">
            {/* Sources to Core */}
            <path d="M120 100 C 200 100, 200 250, 300 250" />
            <path d="M120 250 C 200 250, 200 250, 300 250" />
            <path d="M120 400 C 200 400, 200 250, 300 250" />
            {/* Core to Storage */}
            <path d="M300 250 C 400 250, 400 250, 480 250" />
            {/* Storage to Consumers */}
            <path d="M480 250 C 520 250, 520 150, 550 150" />
            <path d="M480 250 C 520 250, 520 350, 550 350" />
        </g>

        {/* --- Animated Particles (Data Packets) --- */}
        <circle r="3" fill="#60a5fa" filter="url(#iconGlow)">
          <animateMotion dur="3s" repeatCount="indefinite" path="M120 100 C 200 100, 200 250, 300 250" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.4 0 0.2 1" />
        </circle>
        <circle r="3" fill="#818cf8" filter="url(#iconGlow)">
          <animateMotion dur="3s" begin="1s" repeatCount="indefinite" path="M120 250 C 200 250, 200 250, 300 250" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.4 0 0.2 1" />
        </circle>
        <circle r="3" fill="#c084fc" filter="url(#iconGlow)">
          <animateMotion dur="3s" begin="2s" repeatCount="indefinite" path="M120 400 C 200 400, 200 250, 300 250" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.4 0 0.2 1" />
        </circle>
        <circle r="4" fill="#e879f9" filter="url(#iconGlow)">
          <animateMotion dur="2s" begin="0.5s" repeatCount="indefinite" path="M300 250 C 400 250, 400 250, 480 250" />
        </circle>
        <circle r="3" fill="#38bdf8" filter="url(#iconGlow)">
          <animateMotion dur="2.5s" begin="1.5s" repeatCount="indefinite" path="M480 250 C 520 250, 520 150, 550 150" />
        </circle>
        <circle r="3" fill="#38bdf8" filter="url(#iconGlow)">
          <animateMotion dur="2.5s" begin="1.8s" repeatCount="indefinite" path="M480 250 C 520 250, 520 350, 550 350" />
        </circle>

        {/* --- NODES --- */}
        
        {/* The nodes themselves in a group to control common styles */}
        <g strokeWidth="2" stroke="#334155" fill="#0f172a">
        
        {/* 1. API Node (Top Left) */}
            <g transform="translate(60, 100)">
                <rect x="-35" y="-35" width="70" height="70" rx="12" fill="#0f172a" stroke="#475569" strokeWidth="2" />
                {/* Cloud Icon */}
                <path d="M-12 5 A 8 8 0 0 1 -4 -10 A 12 12 0 0 1 18 -4 A 8 8 0 0 1 18 12 L -12 12 Z" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <text x="0" y="24" textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="400" stroke="none" style={{fontFamily: 'sans-serif'}}>API</text>
            </g>

            {/* 2. SQL Node (Mid Left) */}
            <g transform="translate(60, 250)">
                <rect x="-35" y="-35" width="70" height="70" rx="12" fill="#0f172a" stroke="#475569" strokeWidth="2" />
                {/* Database Icon */}
                <g transform="scale(0.8) translate(0,-2)">
                    <ellipse cx="0" cy="-8" rx="14" ry="4" fill="none" stroke="#818cf8" strokeWidth="2.5" />
                    <path d="M-14 -8 v 16 c 0 2.2 6.3 4 14 4 s 14 -1.8 14 -4 v -16" fill="none" stroke="#818cf8" strokeWidth="2.5" />
                    <path d="M-14 8 c 0 2.2 6.3 4 14 4 s 14 -1.8 14 -4" fill="none" stroke="#818cf8" strokeWidth="2.5" />
                </g>
                <text x="0" y="24" textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="400" stroke="none" style={{fontFamily: 'sans-serif'}}>SQL</text>
            </g>

            {/* 3. S3 Icon (Bot Left) should be S3 not just third source */}
            <g transform="translate(60, 400)">
                <rect x="-35" y="-35" width="70" height="70" rx="12" fill="#0f172a" stroke="#475569" strokeWidth="2" />
                {/* Bucket/Object Icon */}
                <g transform="scale(0.8)">
                    <rect x="-10" y="-12" width="20" height="24" rx="2" fill="none" stroke="#c084fc" strokeWidth="2.5" />
                    <path d="M-10 0 h20" stroke="#c084fc" strokeWidth="2.5" />
                </g>
                <text x="0" y="24" textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="400" stroke="none" style={{fontFamily: 'sans-serif'}}>S3</text>
            </g>

            {/* 4. Core/Processor Node (Center) - The Engine */}
            <g transform="translate(300, 250)">
                {/* Outer Ring Animation */}
                <circle r="45" fill="#1e1b4b" stroke="#7c3aed" strokeWidth="1" opacity="0.5" />
                <circle r="46" fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="8 8" strokeLinecap="round" opacity="0.8">
                    <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="20s" repeatCount="indefinite" />
                </circle>
                
                {/* Inner Chip Icon */}
                <rect x="-18" y="-18" width="36" height="36" rx="4" fill="#1e1b4b" stroke="#a78bfa" strokeWidth="2" />
                <path d="M-18 -6 h-4 M-18 0 h-4 M-18 6 h-4  M18 -6 h4 M18 0 h4 M18 6 h4  M-6 -18 v-4 M0 -18 v-4 M6 -18 v-4  M-6 18 v4 M0 18 v4 M6 18 v4" stroke="#a78bfa" strokeWidth="2" />
                <rect x="-6" y="-6" width="12" height="12" fill="#8b5cf6" opacity="0.8" />
            </g>

            {/* 4.5. Human/Engineer Node (Between Core and DW) */}
            <g transform="translate(390, 250)">
                <rect x="-24" y="-24" width="48" height="48" rx="8" fill="#0f172a" stroke="#475569" strokeWidth="2" />
                {/* Human Icon */}
                <g transform="scale(0.8)">
                    {/* Head */}
                    <circle cx="0" cy="-8" r="6" fill="none" stroke="#e2e8f0" strokeWidth="2" />
                    {/* Body */}
                    <path d="M-10 14 Q0 6 10 14 V16 H-10 Z" fill="none" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    {/* Shoulders */}
                    <path d="M-12 16 Q-12 4 0 4 Q12 4 12 16" fill="none" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
                </g>
                <text x="0" y="34" textAnchor="middle" fill="#e2e8f0" fontSize="9" fontWeight="400" stroke="none" style={{fontFamily: 'sans-serif'}}>USER</text>
            </g>

            {/* 5. Data Warehouse Node (Right) */}
            <g transform="translate(480, 250)">
                <rect x="-35" y="-35" width="70" height="70" rx="12" fill="#0f172a" stroke="#475569" strokeWidth="2" />
                {/* Server Stack Icon */}
                <g transform="scale(0.8) translate(0,-2)">
                    <rect x="-14" y="-12" width="28" height="6" rx="1" fill="none" stroke="#e879f9" strokeWidth="2" />
                    <rect x="-14" y="-2" width="28" height="6" rx="1" fill="none" stroke="#e879f9" strokeWidth="2" />
                    <rect x="-14" y="8" width="28" height="6" rx="1" fill="none" stroke="#e879f9" strokeWidth="2" />
                    <circle cx="8" cy="-9" r="1.5" fill="#e879f9" />
                    <circle cx="8" cy="1" r="1.5" fill="#e879f9" />
                    <circle cx="8" cy="11" r="1.5" fill="#e879f9" />
                </g>
                <text x="0" y="24" textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="400" stroke="none" style={{fontFamily: 'sans-serif'}}>DW</text>
            </g>

            {/* 6. BI Node (Top Right) */}
            <g transform="translate(550, 150)">
                <rect x="-28" y="-28" width="56" height="56" rx="10" fill="#0f172a" stroke="#475569" strokeWidth="2" />
                {/* Chart Icon */}
                <g transform="scale(0.9)">
                    <path d="M-10 10 L-10 0" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
                    <path d="M0 10 L0 -6" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
                    <path d="M10 10 L10 4" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
                </g>
                <text x="0" y="20" textAnchor="middle" fill="#e2e8f0" fontSize="9" fontWeight="400" stroke="none" style={{fontFamily: 'sans-serif'}}>BI</text>
            </g>

            {/* 7. ML Node (Bot Right) */}
            <g transform="translate(550, 350)">
                <rect x="-28" y="-28" width="56" height="56" rx="10" fill="#0f172a" stroke="#475569" strokeWidth="2" />
                {/* Network / Brain Icon */}
                <g transform="scale(0.8)">
                    <circle cx="-8" cy="6" r="3" fill="#38bdf8" />
                    <circle cx="8" cy="6" r="3" fill="#38bdf8" />
                    <circle cx="0" cy="-8" r="3" fill="#38bdf8" />
                    <path d="M-8 6 L0 -8 L8 6 Z" stroke="#38bdf8" strokeWidth="1.5" fill="none" />
                </g>
                <text x="0" y="20" textAnchor="middle" fill="#e2e8f0" fontSize="9" fontWeight="400" stroke="none" style={{fontFamily: 'sans-serif'}}>ML</text>
            </g>
        </g>
      </svg>
    </div>
  );
}
