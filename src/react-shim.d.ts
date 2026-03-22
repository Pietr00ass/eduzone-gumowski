declare module 'react' {
  export type ReactNode = unknown;
  export function useState<T>(initial: T): [T, (value: T) => void];
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useRef<T>(initial: T): { current: T };
  export function useCallback<T extends (...args: never[]) => unknown>(callback: T, deps: readonly unknown[]): T;
  const React: unknown;
  export default React;
}

declare module '@mantine/core' {
  export const Badge: (props: Record<string, unknown>) => unknown;
  export const Card: (props: Record<string, unknown>) => unknown;
  export const Group: (props: Record<string, unknown>) => unknown;
  export const Progress: (props: Record<string, unknown>) => unknown;
  export const RingProgress: (props: Record<string, unknown>) => unknown;
  export const Stack: (props: Record<string, unknown>) => unknown;
  export const Text: (props: Record<string, unknown>) => unknown;
  export const ThemeIcon: (props: Record<string, unknown>) => unknown;
}

declare module '@tabler/icons-react' {
  export const IconBolt: (props: Record<string, unknown>) => unknown;
  export const IconClockPause: (props: Record<string, unknown>) => unknown;
}

declare namespace JSX {
  interface IntrinsicElements {
    div: Record<string, unknown>;
    span: Record<string, unknown>;
    strong: Record<string, unknown>;
  }
}

declare module 'react/jsx-runtime' {
  export const Fragment: unique symbol;
  export function jsx(type: unknown, props: unknown, key?: unknown): unknown;
  export function jsxs(type: unknown, props: unknown, key?: unknown): unknown;
}
