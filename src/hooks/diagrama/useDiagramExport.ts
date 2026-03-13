'use client';

import { useCallback, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import 'svg2pdf.js';

import { buildExportSvg, type Bounds } from '@/components/diagrama/exportSvg';
import {
  interBoldBase64,
  interRegularBase64,
  interSemiBoldBase64,
} from '@/assets/fonts/interPdfFonts';
import type { PrintMode, PrintOptions } from '@/components/diagrama/PrintDialog';
import type { Card, Connection } from '@/types/diagrama';
import { A4_HEIGHT, A4_WIDTH, GRID_SIZE } from '@/types/diagrama';

type UseDiagramExportParams = {
  cards: Card[];
  connections: Connection[];
  fileName: string;
  printOptions: PrintOptions;
  selectedCardIds: Set<string>;
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
  fileName,
  printOptions,
  selectedCardIds,
}: UseDiagramExportParams) {
  const [isPrinting, setIsPrinting] = useState(false);

  const getExportBounds = useCallback(
    (opts: PrintOptions): Bounds | null => {
      const sourceCards = opts.selectionOnly
        ? cards.filter((card) => selectedCardIds.has(card.id))
        : cards;

      return getBoundsForCards(sourceCards, opts.margin);
    },
    [cards, selectedCardIds]
  );

  const buildExportSvgForViewBox = useCallback(
    (opts: PrintOptions, viewBox: Bounds) =>
      buildExportSvg({
        cards,
        connections,
        bounds: viewBox,
        viewBox,
        opts: {
          includeGrid: opts.includeGrid,
          includeShadows: opts.includeShadows,
          gridSize: GRID_SIZE,
          background: '#ffffff',
        },
      }),
    [cards, connections]
  );

  const getPaperFramedExport = useCallback(
    (opts: PrintOptions) => {
      const bounds = getExportBounds(opts);
      if (!bounds) return null;

      const paper = resolvePaperLayout(opts, bounds);
      const viewBox = getFittedPageViewBox(bounds, paper);
      const svg = buildExportSvgForViewBox(opts, viewBox);

      return { bounds, paper, viewBox, svg };
    },
    [buildExportSvgForViewBox, getExportBounds]
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
      const bounds = getExportBounds(opts);
      if (!bounds) return;

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

          const svg = buildExportSvgForViewBox(opts, viewBox);

          if (pageIndex > 0) {
            pdf.addPage([paper.width, paper.height], paper.orientation);
          }

          await renderSvgPageToPdf(pdf, svg, paper);
          pageIndex += 1;
        }
      }

      pdf.save(`${fileName}.pdf`);
    },
    [buildExportSvgForViewBox, fileName, getExportBounds, renderSvgPageToPdf]
  );

  const exportScaleToXYVector = useCallback(
    async (opts: PrintOptions) => {
      const bounds = getExportBounds(opts);
      if (!bounds) return;

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

          const svg = buildExportSvgForViewBox(opts, viewBox);

          if (pageIndex > 0) {
            pdf.addPage([paper.width, paper.height], paper.orientation);
          }

          await renderSvgPageToPdf(pdf, svg, paper);
          pageIndex += 1;
        }
      }

      pdf.save(`${fileName}.pdf`);
    },
    [buildExportSvgForViewBox, fileName, getExportBounds, renderSvgPageToPdf]
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
