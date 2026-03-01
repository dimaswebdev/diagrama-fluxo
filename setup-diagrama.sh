#!/bin/bash

echo "🎨 INICIANDO SETUP DO DIAGRAMA DE FLUXO"
echo "========================================"
echo ""

# 1. Verificar se está no branch correto
echo "📌 Verificando branch..."
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "feature/diagrama-fluxo" ]; then
    echo "❌ ERRO: Você não está no branch feature/diagrama-fluxo"
    echo "   Execute: git switch feature/diagrama-fluxo"
    exit 1
fi
echo "✅ Branch correto: $CURRENT_BRANCH"
echo ""

# 2. Criar estrutura de pastas
echo "📁 Criando estrutura de pastas..."
mkdir -p src/components/diagrama
mkdir -p src/hooks/diagrama
mkdir -p src/types/diagrama
mkdir -p src/app/diagrama
mkdir -p src/utils
echo "✅ Pastas criadas!"
echo ""

# 3. Instalar dependências
echo "📦 Instalando dependências necessárias..."
npm install html2canvas jspdf
echo "✅ Dependências instaladas!"
echo ""

# 4. Criar arquivo de tipos
echo "📄 Criando arquivo de tipos..."
cat > src/types/diagrama/index.ts << 'EOF'
export interface Card {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  type?: 'default' | 'input' | 'output' | 'process' | 'decision';
  color?: string;
}

export interface Connection {
  id: string;
  fromCard: string;
  toCard: string;
  type?: 'normal' | 'dashed' | 'dotted';
  color?: string;
  label?: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface DiagramState {
  cards: Card[];
  connections: Connection[];
}

export const GRID_SIZE = 20;
export const A4_WIDTH = 595;
export const A4_HEIGHT = 842;
EOF
echo "✅ src/types/diagrama/index.ts criado!"
echo ""

# 5. Criar hook useLocalStorage
echo "📄 Criando hook useLocalStorage..."
cat > src/hooks/diagrama/useLocalStorage.ts << 'EOF'
'use client'

import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      }
    } catch (error) {
      console.log('Erro ao carregar do localStorage:', error);
    }
  }, [key]);

  const setValue = (value: T) => {
    try {
      setStoredValue(value);
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.log('Erro ao salvar no localStorage:', error);
    }
  };

  return [storedValue, setValue];
}
EOF
echo "✅ src/hooks/diagrama/useLocalStorage.ts criado!"
echo ""

# 6. Criar hook useHistory
echo "📄 Criando hook useHistory..."
cat > src/hooks/diagrama/useHistory.ts << 'EOF'
'use client'

import { useState, useCallback } from 'react';
import { DiagramState } from '@/types/diagrama';

export function useHistory(initialState: DiagramState) {
  const [history, setHistory] = useState<DiagramState[]>([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const pushState = useCallback((newState: DiagramState) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, currentIndex + 1);
      return [...newHistory, newState];
    });
    setCurrentIndex(prev => prev + 1);
  }, [currentIndex]);

  const undo = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      return history[currentIndex - 1];
    }
    return null;
  }, [currentIndex, history]);

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(prev => prev + 1);
      return history[currentIndex + 1];
    }
    return null;
  }, [currentIndex, history]);

  return {
    history: history[currentIndex],
    canUndo: currentIndex > 0,
    canRedo: currentIndex < history.length - 1,
    pushState,
    undo,
    redo
  };
}
EOF
echo "✅ src/hooks/diagrama/useHistory.ts criado!"
echo ""

# 7. Criar página do diagrama
echo "📄 Criando página do diagrama..."
cat > src/app/diagrama/page.tsx << 'EOF'
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
EOF
echo "✅ src/app/diagrama/page.tsx criado!"
echo ""

# 8. Criar componente SelectionBox
echo "📄 Criando componente SelectionBox..."
cat > src/components/diagrama/SelectionBox.tsx << 'EOF'
'use client'

import React from 'react';

interface SelectionBoxProps {
  start: { x: number; y: number };
  end: { x: number; y: number };
}

const SelectionBox: React.FC<SelectionBoxProps> = ({ start, end }) => {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);

  if (width < 5 || height < 5) return null;

  return (
    <div
      className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none"
      style={{
        left,
        top,
        width,
        height
      }}
    />
  );
};

export default SelectionBox;
EOF
echo "✅ src/components/diagrama/SelectionBox.tsx criado!"
echo ""

# 9. Mensagem final
echo "========================================"
echo "🎉 SETUP CONCLUÍDO COM SUCESSO! 🎉"
echo "========================================"
echo ""
echo "📁 Pastas criadas:"
echo "   ├── src/components/diagrama/"
echo "   ├── src/hooks/diagrama/"
echo "   ├── src/types/diagrama/"
echo "   ├── src/app/diagrama/"
echo "   └── src/utils/"
echo ""
echo "📄 Arquivos criados:"
echo "   ├── src/types/diagrama/index.ts"
echo "   ├── src/hooks/diagrama/useLocalStorage.ts"
echo "   ├── src/hooks/diagrama/useHistory.ts"
echo "   ├── src/app/diagrama/page.tsx"
echo "   └── src/components/diagrama/SelectionBox.tsx"
echo ""
echo "📦 Dependências instaladas:"
echo "   ├── html2canvas"
echo "   └── jspdf"
echo ""
echo "👉 PRÓXIMOS PASSOS:"
echo "   1. Copie os componentes principais para:"
echo "      - src/components/diagrama/Diagrama.tsx"
echo "      - src/components/diagrama/Card.tsx"
echo "      - src/components/diagrama/ConnectionLine.tsx"
echo "      - src/components/diagrama/FloatingToolbar.tsx"
echo ""
echo "   2. Acesse: http://localhost:3000/diagrama"
echo ""

