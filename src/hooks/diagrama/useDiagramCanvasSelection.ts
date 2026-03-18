import { useCallback, useState } from 'react';

import { doesConnectionIntersectSelectionBox } from '@/components/diagrama/connectionRouting';
import type { ConnectionSide } from '@/components/diagrama/connectionRouting';
import type {
  Card as CardType,
  Connection,
  DiagramText,
  GroupBox as GroupBoxType,
  Point,
  SelectionBox as SelectionBoxType,
} from '@/types/diagrama';

type ConnectionStart = { cardId: string; point: Point; side: ConnectionSide } | null;

export function useDiagramCanvasSelection({
  cards,
  connections,
  cardMap,
}: {
  cards: CardType[];
  texts: DiagramText[];
  groupBoxes: GroupBoxType[];
  connections: Connection[];
  cardMap: Map<string, CardType>;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [dragEnd, setDragEnd] = useState<Point>({ x: 0, y: 0 });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStart, setConnectionStart] = useState<ConnectionStart>(null);
  const [tempConnectionEnd, setTempConnectionEnd] = useState<Point | null>(null);

  const findCardAtPosition = useCallback(
    (x: number, y: number): CardType | null => {
      for (const card of cards) {
        if (x >= card.x && x <= card.x + card.width && y >= card.y && y <= card.y + card.height) {
          return card;
        }
      }
      return null;
    },
    [cards]
  );

  const getSelectionBox = useCallback((): SelectionBoxType => {
    return {
      x: Math.min(dragStart.x, dragEnd.x),
      y: Math.min(dragStart.y, dragEnd.y),
      width: Math.abs(dragEnd.x - dragStart.x),
      height: Math.abs(dragEnd.y - dragStart.y),
    };
  }, [dragEnd, dragStart]);

  const isCardInSelection = useCallback((card: CardType, selection: SelectionBoxType): boolean => {
    return (
      card.x < selection.x + selection.width &&
      card.x + card.width > selection.x &&
      card.y < selection.y + selection.height &&
      card.y + card.height > selection.y
    );
  }, []);

  const isBoxInSelection = useCallback(
    (
      item: {
        x: number;
        y: number;
        width: number;
        height: number;
      },
      selection: SelectionBoxType
    ) =>
      item.x < selection.x + selection.width &&
      item.x + item.width > selection.x &&
      item.y < selection.y + selection.height &&
      item.y + item.height > selection.y,
    []
  );

  const isConnectionInSelection = useCallback(
    (connection: Connection, selection: SelectionBoxType): boolean => {
      const fromCard = cardMap.get(connection.fromCard);
      const toCard = cardMap.get(connection.toCard);
      if (!fromCard || !toCard) return false;

      return doesConnectionIntersectSelectionBox(
        fromCard,
        toCard,
        selection,
        {
          fromSide: connection.fromSide,
          toSide: connection.toSide,
        },
        connection.routeStyle ?? 'bezier'
      );
    },
    [cardMap]
  );

  const cancelConnection = useCallback(() => {
    setIsConnecting(false);
    setConnectionStart(null);
    setTempConnectionEnd(null);
  }, []);

  const handleConnectionStart = useCallback((cardId: string, side: ConnectionSide, point: Point) => {
    setIsConnecting(true);
    setConnectionStart({ cardId, point, side });
  }, []);

  return {
    isDragging,
    setIsDragging,
    dragStart,
    setDragStart,
    dragEnd,
    setDragEnd,
    isConnecting,
    connectionStart,
    tempConnectionEnd,
    setTempConnectionEnd,
    findCardAtPosition,
    getSelectionBox,
    isCardInSelection,
    isBoxInSelection,
    isConnectionInSelection,
    cancelConnection,
    handleConnectionStart,
  };
}
