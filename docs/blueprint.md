# **App Name**: Cronograma Evidência

## Core Features:

- Canvas Interativo e Elementos: Permite criar, arrastar, editar o conteúdo e deletar elementos (cards) em um canvas infinito, com funcionalidades de zoom e pan que afetam apenas os elementos. Suporte a seleção múltipla com feedback visual e arrasto/redimensionamento em grupo.
- Gestão Inteligente de Cronologia: Automatiza a indexação numérica dos cards da linha do tempo. Ao deletar um elemento, o sistema reindexa automaticamente os elementos subsequentes para manter uma sequência sem 'buracos'.
- Conexões Ortogonais Dinâmicas: Implementa linhas de conexão entre cards com quebras em 90° e pontas de seta personalizáveis para indicar o fluxo, garantindo uma visualização clara das relações.
- Barra de Ferramentas e Título Flutuantes: Exibe o título da aplicação e uma barra de ferramentas consolidada com as principais ações ('Selecionar', 'Conectar', 'Novo Elemento', 'Deletar Elemento', 'Editar Texto', 'Imprimir/PDF') como overlays fixos sobre o canvas, garantindo acessibilidade constante.
- Persistência em Tempo Real com Firestore: Salva automaticamente todas as alterações (posições de cards, conteúdo de texto, estados de conexão e ordem sequencial) no Firestore em tempo real, garantindo que os dados estejam sempre atualizados e disponíveis.
- Exportação Inteligente para PDF (A4): Gera um arquivo PDF da linha do tempo com ajuste automático de escala para caber em uma folha A4. A função calcula o 'bounding box' de todos os elementos e otimiza a escala para legibilidade sem cortes.
- Geração de Resumos por IA: Um tool de inteligência artificial que auxilia na organização, sugerindo automaticamente um resumo conciso ou tags relevantes para o conteúdo de um novo card de evidência adicionado pelo usuário.

## Style Guidelines:

- Primary color: Um elegante violeta azulado (#6233CC), simbolizando sofisticação e seriedade, ideal para elementos interativos e títulos importantes.
- Background color: Um suave tom de lavanda claro (#F2F0F7), sutilmente análogo ao primário, perfeito para o efeito Glassmorphism do canvas e fundos translúcidos.
- Accent color: Um azul profundo e distinto (#1133B8), fornecendo contraste marcante para indicadores de foco ou seleções, harmonizando com a paleta primária análoga.
- Headline and body font: 'Inter', um sans-serif moderno e objetivo, selecionado pela sua excelente legibilidade e adequação a uma aplicação de organização de evidências.
- Use ícones minimalistas e baseados em linha que se integrem perfeitamente com a estética Glassmorphism, mantendo a clareza visual para as ações da barra de ferramentas e interações do canvas.
- O design deve apresentar um canvas infinito que preenche 100% da tela. O título da aplicação e a barra de ferramentas centralizada devem permanecer como overlays fixos e flutuantes na parte superior, garantindo uma área de trabalho desimpedida para o diagrama.
- Implemente transições e micro-interações suaves e sutis para seleção de cards, movimentos, criação de conexões e foco, reforçando a experiência do usuário sem distrair do conteúdo. Utilize efeitos de 'blur' ao estilo Glassmorphism em elementos flutuantes para profundidade visual.