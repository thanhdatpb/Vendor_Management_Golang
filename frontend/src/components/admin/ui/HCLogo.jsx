import React from 'react';
import logoImg from '../../../assets/logo.png';

export default function HCLogo({ size = 32 }) {
  return (
    <img
      src={logoImg}
      alt="Happy Creative Logo"
      style={{ width: size, height: size, objectFit: 'contain', display: 'block' }}
    />
  );
}
