import type { CardType } from '@/types/diagrama';

export type CardPreset = {
  title: string;
  label: string;
  content: string;
  accent: string;
};

const CARD_TYPE_PRESETS: Record<CardType, CardPreset> = {
  default: {
    title: 'Evento',
    label: 'NOVO',
    content: 'Descreva o conteúdo aqui.',
    accent: '#19B7C6',
  },
  input: {
    title: 'Entrada',
    label: 'ORIGEM',
    content: 'Informe o dado ou fato inicial.',
    accent: '#34D399',
  },
  process: {
    title: 'Processo',
    label: 'AÇÃO',
    content: 'Descreva a etapa principal.',
    accent: '#19B7C6',
  },
  output: {
    title: 'Saída',
    label: 'RESULTADO',
    content: 'Descreva a entrega ou resposta.',
    accent: '#F39A1F',
  },
  decision: {
    title: 'Decisão',
    label: 'ANÁLISE',
    content: 'Registre o critério ou conclusão.',
    accent: '#7C5CFF',
  },
};

export function getCardPreset(type: CardType = 'default', sequence?: number): CardPreset {
  const preset = CARD_TYPE_PRESETS[type];
  const baseTitle =
    type === 'default'
      ? `Evento ${sequence ?? ''}`.trim()
      : sequence
      ? `${preset.title} ${sequence}`
      : preset.title;

  return {
    ...preset,
    title: baseTitle,
  };
}

export function isFlowShape(type?: CardType) {
  return type !== undefined && type !== 'default';
}
