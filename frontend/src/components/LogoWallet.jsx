import React from 'react';

export default function LogoWallet({ size = 28, color = 'currentColor', style = {} }) {
  // A simple, clean wallet with notes SVG. Adapts to text color via currentColor.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Logo: wallet with notes"
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    >
      {/* Notes (use darker brand color) */}
      <rect x="14" y="10" width="30" height="12" rx="2" fill="var(--primary-600)" opacity="0.35"/>
      <rect x="18" y="6" width="30" height="12" rx="2" fill="var(--primary-600)" opacity="0.25"/>

      {/* Wallet body */}
      <rect x="8" y="16" width="48" height="34" rx="6" stroke={color} strokeWidth="3" fill="none"/>

      {/* Wallet flap */}
      <path d="M10 24C10 20.686 12.686 18 16 18H42C45.314 18 48 20.686 48 24V26H10V24Z" fill={color} opacity="0.12"/>

      {/* Strap */}
      <path d="M48 30H54C56.209 30 58 31.791 58 34C58 36.209 56.209 38 54 38H48V30Z" stroke={color} strokeWidth="3" fill="none"/>
      <circle cx="52" cy="34" r="2.5" fill={color} />

      {/* Subtle bottom shadow */}
      <rect x="10" y="48" width="44" height="4" rx="2" fill={color} opacity="0.08"/>
    </svg>
  );
}
