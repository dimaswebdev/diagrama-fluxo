declare module "recharts" {
  import * as React from "react"

  export type TooltipValue = string | number
  export type TooltipName = string | number

  export interface TooltipPayload {
    color?: string
    dataKey?: string | number
    name?: TooltipName
    value?: TooltipValue
    payload?: Record<string, unknown> & { fill?: string }
  }

  export interface ResponsiveContainerProps {
    children?: React.ReactNode
  }

  export const ResponsiveContainer: React.ComponentType<ResponsiveContainerProps>

  export interface TooltipProps {
    active?: boolean
    payload?: TooltipPayload[]
    label?: React.ReactNode
    labelClassName?: string
    color?: string
    formatter?: (
      value: TooltipValue,
      name: TooltipName,
      item: TooltipPayload,
      index: number,
      payload: TooltipPayload["payload"]
    ) => React.ReactNode
    labelFormatter?: (
      label: React.ReactNode,
      payload: TooltipPayload[]
    ) => React.ReactNode
  }

  export const Tooltip: React.ComponentType<TooltipProps>

  export interface LegendPayload {
    color?: string
    dataKey?: string | number
    value?: string | number
  }

  export interface LegendProps {
    payload?: LegendPayload[]
    verticalAlign?: "top" | "middle" | "bottom"
  }

  export const Legend: React.ComponentType<LegendProps>
}
