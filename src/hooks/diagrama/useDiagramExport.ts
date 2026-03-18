'use client';

import { useCallback, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import 'svg2pdf.js';

import { buildExportSvg, type Bounds } from '@/components/diagrama/exportSvg';
import { getConnectionGeometry } from '@/components/diagrama/connectionRouting';
import {
  interBoldBase64,
  interRegularBase64,
  interSemiBoldBase64,
} from '@/assets/fonts/interPdfFonts';
import type { PrintMode, PrintOptions } from '@/components/diagrama/PrintDialog';
import type { Card, Connection, DiagramText, GroupBox } from '@/types/diagrama';
import { A4_HEIGHT, A4_WIDTH, GRID_SIZE } from '@/types/diagrama';

type UseDiagramExportParams = {
  cards: Card[];
  connections: Connection[];
  texts: DiagramText[];
  groupBoxes: GroupBox[];
  fileName: string;
  printOptions: PrintOptions;
  selectedCardIds: Set<string>;
  selectedConnectionIds: Set<string>;
  selectedTextIds: Set<string>;
  selectedGroupBoxIds: Set<string>;
};

export type ExportPreview = {
  hasContent: boolean;
  orientation: 'portrait' | 'landscape';
  pageWidth: number;
  pageHeight: number;
  pageLabel: string;
  estimatedPages: number;
  scalePercent: number;
  contentWidth: number;
  contentHeight: number;
  previewSvg: string | null;
};

type PaperLayout = {
  orientation: 'portrait' | 'landscape';
  width: number;
  height: number;
};

type ExportScene = {
  cards: Card[];
  connections: Connection[];
  texts: DiagramText[];
  groupBoxes: GroupBox[];
  bounds: Bounds;
};

const getBoundsForCards = (cards: Card[], padding: number): Bounds | null => {
  if (!cards.length) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const card of cards) {
    minX = Math.min(minX, card.x);
    minY = Math.min(minY, card.y);
    maxX = Math.max(maxX, card.x + card.width);
    maxY = Math.max(maxY, card.y + card.height);
  }

  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
};

const expandBounds = (bounds: Bounds, point: { x: number; y: number }) => ({
  x: Math.min(bounds.x, point.x),
  y: Math.min(bounds.y, point.y),
  width: Math.max(bounds.x + bounds.width, point.x) - Math.min(bounds.x, point.x),
  height: Math.max(bounds.y + bounds.height, point.y) - Math.min(bounds.y, point.y),
});

const getSceneBounds = (cards: Card[], connections: Connection[], texts: DiagramText[], groupBoxes: GroupBox[], padding: number): Bounds | null => {
  const cardBounds = getBoundsForCards(cards, 0);
  const extraBounds = [...texts, ...groupBoxes];
  const fallbackBounds = extraBounds.length
    ? {
        x: Math.min(...extraBounds.map((item) => item.x)),
        y: Math.min(...extraBounds.map((item) => item.y)),
        width:
          Math.max(...extraBounds.map((item) => item.x + item.width)) -
          Math.min(...extraBounds.map((item) => item.x)),
        height:
          Math.max(...extraBounds.map((item) => item.y + item.height)) -
          Math.min(...extraBounds.map((item) => item.y)),
      }
    : null;
  if (!cardBounds && !fallbackBounds) return null;

  let bounds = { ...(cardBounds ?? fallbackBounds!) };

  for (const item of extraBounds) {
    bounds = expandBounds(bounds, { x: item.x, y: item.y });
    bounds = expandBounds(bounds, { x: item.x + item.width, y: item.y + item.height });
  }

  for (const connection of connections) {
    const fromCard = cards.find((card) => card.id === connection.fromCard);
    const toCard = cards.find((card) => card.id === connection.toCard);
    if (!fromCard || !toCard) continue;

    const geometry = getConnectionGeometry(
      fromCard,
      toCard,
      {
        fromSide: connection.fromSide,
        toSide: connection.toSide,
      },
      connection.routeStyle ?? 'bezier'
    );

    bounds = expandBounds(bounds, geometry.startPoint);
    bounds = expandBounds(bounds, geometry.endPoint);
    bounds = expandBounds(bounds, geometry.labelPoint);

    if ('points' in geometry) {
      for (const point of geometry.points) {
        bounds = expandBounds(bounds, point);
      }
    } else {
      bounds = expandBounds(bounds, geometry.controlPoint1);
      bounds = expandBounds(bounds, geometry.controlPoint2);
    }
  }

  return {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  };
};

const svgStringToElement = (svg: string): SVGSVGElement => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, 'image/svg+xml');
  return doc.documentElement as unknown as SVGSVGElement;
};

const resolvePaperLayout = (opts: PrintOptions, bounds: Bounds): PaperLayout => {
  const orientation =
    opts.orientation === 'auto'
      ? bounds.width > bounds.height
        ? 'landscape'
        : 'portrait'
      : opts.orientation;

  return {
    orientation,
    width: orientation === 'landscape' ? A4_HEIGHT : A4_WIDTH,
    height: orientation === 'landscape' ? A4_WIDTH : A4_HEIGHT,
  };
};

const getFittedPageViewBox = (bounds: Bounds, paper: PaperLayout): Bounds => {
  const contentAspect = bounds.width / Math.max(bounds.height, 1);
  const paperAspect = paper.width / Math.max(paper.height, 1);

  if (contentAspect >= paperAspect) {
    const fittedHeight = bounds.width / paperAspect;
    return {
      x: bounds.x,
      y: bounds.y - (fittedHeight - bounds.height) / 2,
      width: bounds.width,
      height: fittedHeight,
    };
  }

  const fittedWidth = bounds.height * paperAspect;
  return {
    x: bounds.x - (fittedWidth - bounds.width) / 2,
    y: bounds.y,
    width: fittedWidth,
    height: bounds.height,
  };
};

const estimateScalePercent = (bounds: Bounds, paper: PaperLayout, mode: PrintMode, opts: PrintOptions) => {
  if (mode === 'crop') {
    return Math.round(Math.max(20, opts.exportZoom * 100));
  }

  if (mode === 'scale') {
    const pagesX = Math.max(1, opts.pagesX);
    const pagesY = Math.max(1, opts.pagesY);
    return Math.round(
      Math.min((paper.width * pagesX) / bounds.width, (paper.height * pagesY) / bounds.height) * 100
    );
  }

  return Math.round(Math.min(paper.width / bounds.width, paper.height / bounds.height) * 100);
};

const estimatePages = (bounds: Bounds, paper: PaperLayout, mode: PrintMode, opts: PrintOptions) => {
  if (mode === 'scale') {
    return Math.max(1, opts.pagesX) * Math.max(1, opts.pagesY);
  }

  if (mode === 'crop') {
    const exportScale = Math.max(0.2, opts.exportZoom || 1);
    const pageWorldW = paper.width / exportScale;
    const pageWorldH = paper.height / exportScale;
    return Math.ceil(bounds.width / pageWorldW) * Math.ceil(bounds.height / pageWorldH);
  }

  return 1;
};

const makeResponsivePreviewSvg = (svg: string) =>
  svg
    .replace(/width="[^"]*"/, 'width="100%"')
    .replace(/height="[^"]*"/, 'height="100%"')
    .replace('<svg ', '<svg preserveAspectRatio="xMidYMid meet" ');

const registerPdfFonts = (pdf: jsPDF) => {
  const fontApi = pdf as jsPDF & {
    addFileToVFS: (fileName: string, fileData: string) => void;
    addFont: (
      postScriptName: string,
      id: string,
      fontStyle: 'normal' | 'bold' | 'italic' | 'bolditalic'
    ) => void;
    getFontList: () => Record<string, string[]>;
  };

  const existingFonts = fontApi.getFontList();
  if (existingFonts.Inter?.includes('normal') && existingFonts.Inter?.includes('bold')) {
    return;
  }

  fontApi.addFileToVFS('Inter-Regular.ttf', interRegularBase64);
  fontApi.addFont('Inter-Regular.ttf', 'Inter', 'normal');
  fontApi.addFileToVFS('Inter-SemiBold.ttf', interSemiBoldBase64);
  fontApi.addFont('Inter-SemiBold.ttf', 'Inter-SemiBold', 'normal');
  fontApi.addFileToVFS('Inter-Bold.ttf', interBoldBase64);
  fontApi.addFont('Inter-Bold.ttf', 'Inter', 'bold');
};

export function useDiagramExport({
  cards,
  connections,
  texts,
  groupBoxes,
  fileName,
  printOptions,
  selectedCardIds,
  selectedConnectionIds,
  selectedTextIds,
  selectedGroupBoxIds,
}: UseDiagramExportParams) {
  const [isPrinting, setIsPrinting] = useState(false);

  const getExportScene = useCallback(
    (opts: PrintOptions): ExportScene | null => {
      if (!opts.selectionOnly) {
        const bounds = getSceneBounds(cards, connections, texts, groupBoxes, opts.margin);
        if (!bounds) return null;

        return { cards, connections, texts, groupBoxes, bounds };
      }

      const selectedConnectionItems = connections.filter((connection) => selectedConnectionIds.has(connection.id));
      const selectedCardIdSet = new Set(selectedCardIds);
      selectedConnectionItems.forEach((connection) => {
        selectedCardIdSet.add(connection.fromCard);
        selectedCardIdSet.add(connection.toCard);
      });

      const sourceCards = cards.filter((card) => selectedCardIdSet.has(card.id));
      const sourceCardIds = new Set(sourceCards.map((card) => card.id));
      const sourceConnections = connections.filter(
        (connection) =>
          selectedConnectionIds.has(connection.id) ||
          (sourceCardIds.has(connection.fromCard) && sourceCardIds.has(connection.toCard))
      );
      const sourceTexts = texts.filter((item) => selectedTextIds.has(item.id));
      const sourceGroupBoxes = groupBoxes.filter((item) => selectedGroupBoxIds.has(item.id));

      const bounds = getSceneBounds(sourceCards, sourceConnections, sourceTexts, sourceGroupBoxes, opts.margin);
      if (!bounds) return null;

      return { cards: sourceCards, connections: sourceConnections, texts: sourceTexts, groupBoxes: sourceGroupBoxes, bounds };
    },
    [cards, connections, groupBoxes, selectedCardIds, selectedConnectionIds, selectedGroupBoxIds, selectedTextIds, texts]
  );

  const buildExportSvgForViewBox = useCallback(
    (scene: { cards: Card[]; connections: Connection[]; texts: DiagramText[]; groupBoxes: GroupBox[] }, opts: PrintOptions, viewBox: Bounds) =>
      buildExportSvg({
        cards: scene.cards,
        connections: scene.connections,
        texts: scene.texts,
        groupBoxes: scene.groupBoxes,
        bounds: viewBox,
        viewBox,
        opts: {
          includeGrid: opts.includeGrid,
          includeShadows: opts.includeShadows,
          gridSize: GRID_SIZE,
          background: '#ffffff',
        },
      }),
    []
  );

  const getPaperFramedExport = useCallback(
    (opts: PrintOptions) => {
      const scene = getExportScene(opts);
      if (!scene) return null;

      const { cards: sceneCards, connections: sceneConnections, texts: sceneTexts, groupBoxes: sceneGroupBoxes, bounds } = scene;
      const paper = resolvePaperLayout(opts, bounds);
      const viewBox = getFittedPageViewBox(bounds, paper);
      const svg = buildExportSvgForViewBox(
        { cards: sceneCards, connections: sceneConnections, texts: sceneTexts, groupBoxes: sceneGroupBoxes },
        opts,
        viewBox
      );

      return { bounds, paper, viewBox, svg, cards: sceneCards, connections: sceneConnections, texts: sceneTexts, groupBoxes: sceneGroupBoxes };
    },
    [buildExportSvgForViewBox, getExportScene]
  );

  const downloadBlob = useCallback(
    (blob: Blob, extension: string) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${fileName}.${extension}`;
      anchor.click();
      URL.revokeObjectURL(url);
    },
    [fileName]
  );

  const printPreview = useMemo<ExportPreview>(() => {
    const exportResult = getPaperFramedExport(printOptions);
    if (!exportResult) {
      return {
        hasContent: false,
        orientation: 'portrait',
        pageWidth: A4_WIDTH,
        pageHeight: A4_HEIGHT,
        pageLabel: 'A4 retrato',
        estimatedPages: 0,
        scalePercent: 100,
        contentWidth: 0,
        contentHeight: 0,
        previewSvg: null,
      };
    }

    const { bounds, paper, svg } = exportResult;
    const pageLabel = paper.orientation === 'landscape' ? 'A4 paisagem' : 'A4 retrato';

    return {
      hasContent: true,
      orientation: paper.orientation,
      pageWidth: paper.width,
      pageHeight: paper.height,
      pageLabel,
      estimatedPages: estimatePages(bounds, paper, printOptions.mode, printOptions),
      scalePercent: estimateScalePercent(bounds, paper, printOptions.mode, printOptions),
      contentWidth: Math.round(bounds.width),
      contentHeight: Math.round(bounds.height),
      previewSvg: makeResponsivePreviewSvg(svg),
    };
  }, [getPaperFramedExport, printOptions]);

  const saveAsSvg = useCallback(async () => {
    const exportResult = getPaperFramedExport(printOptions);
    if (!exportResult) return;

    downloadBlob(new Blob([exportResult.svg], { type: 'image/svg+xml;charset=utf-8' }), 'svg');
  }, [downloadBlob, getPaperFramedExport, printOptions]);

  const saveAsPng = useCallback(async () => {
    const exportResult = getPaperFramedExport(printOptions);
    if (!exportResult) return;

    const svgBlob = new Blob([exportResult.svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const image = new Image();

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Erro ao carregar SVG para PNG'));
      image.src = url;
    });

    const outputWidth = Math.max(1200, Math.round(exportResult.paper.width * 2));
    const outputHeight = Math.max(1600, Math.round(exportResult.paper.height * 2));
    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext('2d');

    if (!context) {
      URL.revokeObjectURL(url);
      return;
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        downloadBlob(blob, 'png');
      }
    }, 'image/png');

    URL.revokeObjectURL(url);
  }, [downloadBlob, getPaperFramedExport, printOptions]);

  const renderSvgPageToPdf = useCallback(async (pdf: jsPDF, svgString: string, paper: PaperLayout) => {
    registerPdfFonts(pdf);
    pdf.setFont('Inter', 'normal');

    const svgElement = svgStringToElement(svgString);

    await (
      pdf as jsPDF & {
        svg: (
          element: SVGSVGElement,
          options: { x: number; y: number; width: number; height: number }
        ) => Promise<void>;
      }
    ).svg(svgElement, {
      x: 0,
      y: 0,
      width: paper.width,
      height: paper.height,
    });
  }, []);

  const exportFitOnePageVector = useCallback(
    async (opts: PrintOptions) => {
      const exportResult = getPaperFramedExport(opts);
      if (!exportResult) return;

      const pdf = new jsPDF({
        orientation: exportResult.paper.orientation,
        unit: 'px',
        format: [exportResult.paper.width, exportResult.paper.height],
      });

      await renderSvgPageToPdf(pdf, exportResult.svg, exportResult.paper);
      pdf.save(`${fileName}.pdf`);
    },
    [fileName, getPaperFramedExport, renderSvgPageToPdf]
  );

  const exportCropMultipageVector = useCallback(
    async (opts: PrintOptions) => {
      const scene = getExportScene(opts);
      if (!scene) return;
      const { cards: sceneCards, connections: sceneConnections, texts: sceneTexts, groupBoxes: sceneGroupBoxes, bounds } = scene;

      const paper = resolvePaperLayout(opts, bounds);
      const exportScale = Math.max(0.2, opts.exportZoom || 1);
      const pageWorldW = paper.width / exportScale;
      const pageWorldH = paper.height / exportScale;
      const cols = Math.ceil(bounds.width / pageWorldW);
      const rows = Math.ceil(bounds.height / pageWorldH);

      const pdf = new jsPDF({
        orientation: paper.orientation,
        unit: 'px',
        format: [paper.width, paper.height],
      });

      let pageIndex = 0;

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const viewBox: Bounds = {
            x: bounds.x + col * pageWorldW,
            y: bounds.y + row * pageWorldH,
            width: pageWorldW,
            height: pageWorldH,
          };

          const svg = buildExportSvgForViewBox(
            { cards: sceneCards, connections: sceneConnections, texts: sceneTexts, groupBoxes: sceneGroupBoxes },
            opts,
            viewBox
          );

          if (pageIndex > 0) {
            pdf.addPage([paper.width, paper.height], paper.orientation);
          }

          await renderSvgPageToPdf(pdf, svg, paper);
          pageIndex += 1;
        }
      }

      pdf.save(`${fileName}.pdf`);
    },
    [buildExportSvgForViewBox, fileName, getExportScene, renderSvgPageToPdf]
  );

  const exportScaleToXYVector = useCallback(
    async (opts: PrintOptions) => {
      const scene = getExportScene(opts);
      if (!scene) return;
      const { cards: sceneCards, connections: sceneConnections, texts: sceneTexts, groupBoxes: sceneGroupBoxes, bounds } = scene;

      const paper = resolvePaperLayout(opts, bounds);
      const pagesX = Math.max(1, opts.pagesX);
      const pagesY = Math.max(1, opts.pagesY);
      const ratio = Math.min((paper.width * pagesX) / bounds.width, (paper.height * pagesY) / bounds.height);
      const totalWorldW = (paper.width * pagesX) / ratio;
      const totalWorldH = (paper.height * pagesY) / ratio;
      const pageWorldW = paper.width / ratio;
      const pageWorldH = paper.height / ratio;
      const startX = bounds.x - (totalWorldW - bounds.width) / 2;
      const startY = bounds.y - (totalWorldH - bounds.height) / 2;

      const pdf = new jsPDF({
        orientation: paper.orientation,
        unit: 'px',
        format: [paper.width, paper.height],
      });

      let pageIndex = 0;

      for (let row = 0; row < pagesY; row += 1) {
        for (let col = 0; col < pagesX; col += 1) {
          const viewBox: Bounds = {
            x: startX + col * pageWorldW,
            y: startY + row * pageWorldH,
            width: pageWorldW,
            height: pageWorldH,
          };

          const svg = buildExportSvgForViewBox(
            { cards: sceneCards, connections: sceneConnections, texts: sceneTexts, groupBoxes: sceneGroupBoxes },
            opts,
            viewBox
          );

          if (pageIndex > 0) {
            pdf.addPage([paper.width, paper.height], paper.orientation);
          }

          await renderSvgPageToPdf(pdf, svg, paper);
          pageIndex += 1;
        }
      }

      pdf.save(`${fileName}.pdf`);
    },
    [buildExportSvgForViewBox, fileName, getExportScene, renderSvgPageToPdf]
  );

  const generatePdf = useCallback(
    async (opts: PrintOptions) => {
      setIsPrinting(true);
      try {
        if (opts.mode === 'fit') {
          await exportFitOnePageVector(opts);
        } else if (opts.mode === 'scale') {
          await exportScaleToXYVector(opts);
        } else {
          await exportCropMultipageVector(opts);
        }
      } finally {
        setIsPrinting(false);
      }
    },
    [exportCropMultipageVector, exportFitOnePageVector, exportScaleToXYVector]
  );

  const printDocument = useCallback(
    async (opts: PrintOptions) => {
      const exportResult = getPaperFramedExport(opts);
      if (!exportResult) return;

      setIsPrinting(true);
      try {
        const printableSvg = makeResponsivePreviewSvg(exportResult.svg);
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentWindow?.document;
        if (!iframeDoc) {
          document.body.removeChild(iframe);
          return;
        }

        const pageWidth = `${exportResult.paper.width}px`;
        const pageHeight = `${exportResult.paper.height}px`;

        iframeDoc.open();
        iframeDoc.write(`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>${fileName}</title>
    <style>
      @page { size: ${pageWidth} ${pageHeight}; margin: 0; }
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
      }
      body {
        width: ${pageWidth};
        height: ${pageHeight};
      }
      .sheet {
        width: ${pageWidth};
        height: ${pageHeight};
        overflow: hidden;
      }
      .sheet svg {
        display: block;
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    <div class="sheet">${printableSvg}</div>
  </body>
</html>`);
        iframeDoc.close();

        await new Promise<void>((resolve) => {
          const onLoad = () => resolve();
          iframe.onload = onLoad;
          setTimeout(onLoad, 250);
        });

        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();

        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1000);
      } finally {
        setIsPrinting(false);
      }
    },
    [fileName, getPaperFramedExport]
  );

  const saveAsPdf = useCallback(async () => {
    await generatePdf(printOptions);
  }, [generatePdf, printOptions]);

  return {
    isPrinting,
    printPreview,
    saveAsSvg,
    saveAsPng,
    saveAsPdf,
    generatePdf,
    printDocument,
  };
}
