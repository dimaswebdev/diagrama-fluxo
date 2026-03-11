# Diagrama Fluxo

Editor visual de diagramas e cronogramas com cards, conexoes, zoom, pan, selecao e exportacao para PDF.

## Estrutura atual

- `src/app`: rotas e layout do Next.js
- `src/components/diagrama`: implementacao oficial do editor
- `src/components/ui`: componentes reutilizaveis de interface
- `src/hooks/diagrama`: hooks do editor, como historico e persistencia local
- `src/types/diagrama`: tipos da implementacao oficial
- `archive/legacy-timeline`: implementacao antiga arquivada para referencia e reaproveitamento pontual

## Rotas

- `/`: abre o editor principal
- `/diagrama`: redireciona para `/`

## Scripts

- `npm run dev`: ambiente local na porta `9002`
- `npm run build`: build de producao
- `npm run typecheck`: checagem TypeScript
- `npm run lint`: checagem ESLint

## Estado do projeto

- Implementacao oficial consolidada em `src/components/diagrama`
- Implementacao antiga removida do fluxo ativo e arquivada em `archive/legacy-timeline`
- `/diagrama` mantida apenas como alias de compatibilidade
- Build, lint e typecheck passam no estado atual

## Proximos passos recomendados

- eliminar a duplicacao entre `/` e `/diagrama`
- corrigir o fluxo de selecao multipla e arraste em grupo
- reforcar `undo/redo` em `useHistory`
- revisar textos com encoding corrompido
- decidir o que reaproveitar da versao arquivada, especialmente recursos de IA e toolbar
