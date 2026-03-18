import { useCallback, useEffect, useRef, useState } from 'react';

import type { PrintOptions } from '@/components/diagrama/PrintDialog';
import { useDiagramExport } from '@/hooks/diagrama/useDiagramExport';

type UseDiagramOutputParams = Omit<Parameters<typeof useDiagramExport>[0], 'printOptions'>;

export function useDiagramOutput(params: UseDiagramOutputParams) {
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [printOptions, setPrintOptions] = useState<PrintOptions>({
    selectionOnly: false,
    mode: 'fit' as const,
    pagesX: 1,
    pagesY: 1,
    margin: 60,
    exportZoom: 1,
    includeGrid: true,
    includeShadows: true,
    orientation: 'auto' as const,
  });
  const saveMenuRef = useRef<HTMLDivElement>(null);

  const { isPrinting, printPreview, saveAsSvg, saveAsPng, saveAsPdf, generatePdf, printDocument } =
    useDiagramExport({
      ...params,
      printOptions,
    });

  useEffect(() => {
    if (!showSaveMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (saveMenuRef.current && !saveMenuRef.current.contains(event.target as Node)) {
        setShowSaveMenu(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [showSaveMenu]);

  const openPrintDialog = useCallback(() => setShowPrintDialog(true), []);
  const closePrintDialog = useCallback(() => setShowPrintDialog(false), []);
  const toggleSaveMenu = useCallback(() => setShowSaveMenu((value) => !value), []);

  const handleSavePng = useCallback(async () => {
    await saveAsPng();
    setShowSaveMenu(false);
  }, [saveAsPng]);

  const handleSaveSvg = useCallback(async () => {
    await saveAsSvg();
    setShowSaveMenu(false);
  }, [saveAsSvg]);

  const handleSavePdf = useCallback(async () => {
    await saveAsPdf();
    setShowSaveMenu(false);
  }, [saveAsPdf]);

  const handleConfirmPdf = useCallback(async () => {
    await generatePdf(printOptions);
    setShowPrintDialog(false);
  }, [generatePdf, printOptions]);

  const handlePrint = useCallback(async () => {
    await printDocument(printOptions);
  }, [printDocument, printOptions]);

  return {
    showPrintDialog,
    showSaveMenu,
    printOptions,
    setPrintOptions,
    saveMenuRef,
    isPrinting,
    printPreview,
    openPrintDialog,
    closePrintDialog,
    toggleSaveMenu,
    handleSavePng,
    handleSaveSvg,
    handleSavePdf,
    handleConfirmPdf,
    handlePrint,
  };
}
