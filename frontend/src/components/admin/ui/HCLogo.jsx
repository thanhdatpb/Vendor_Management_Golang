import React from 'react';

export default function HCLogo({ size = 32, color = '#F5A623' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <path d="M168 44 A88 88 0 1 0 168 156" stroke={color} strokeWidth="20" strokeLinecap="round" fill="none" />
      <path d="M118 128 Q130 142 145 132" stroke={color} strokeWidth="18" strokeLinecap="round" fill="none" />
    </svg>
  );
}
