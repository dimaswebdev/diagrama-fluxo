# Structure Audit

## Oficial

- `src/app/page.tsx`
- `src/app/diagrama/page.tsx`
- `src/app/layout.tsx`
- `src/components/diagrama/*`
- `src/components/ui/*`
- `src/hooks/diagrama/*`
- `src/types/diagrama/index.ts`

## Arquivado

Itens movidos para `archive/legacy-timeline`:

- `connection-line.tsx`
- `edit-card-dialog.tsx`
- `evidence-card.tsx`
- `floating-header.tsx`
- `floating-toolbar.tsx`
- `left-toolbar.tsx`
- `timeline-canvas.tsx`
- `timeline.tsx`
- `Diagrama.tsx.bak`

## Criterio usado

- `ativo`: importado pela aplicacao atual
- `aproveitavel`: pode inspirar ou ceder trechos para a implementacao oficial
- `sobra`: nao participa do fluxo atual e gera ruido de manutencao

## Observacoes

- A implementacao antiga continua preservada para consulta, mas saiu de `src` para nao parecer parte ativa do produto.
- A rota `/` e a rota `/diagrama` nao duplicam mais implementacao; `/diagrama` agora redireciona para `/`.
- Ainda existe codigo potencialmente reaproveitavel no legado, especialmente a versao antiga do dialogo de edicao com recursos de IA.
