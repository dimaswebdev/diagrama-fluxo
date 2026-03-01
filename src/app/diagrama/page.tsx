'use client'

import dynamic from 'next/dynamic';

const Diagrama = dynamic(
  () => import('@/components/diagrama/Diagrama'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }
);

export default function DiagramaPage() {
  return (
    <div className="w-full h-screen">
      <Diagrama />
    </div>
  );
}
