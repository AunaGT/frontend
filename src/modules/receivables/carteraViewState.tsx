import {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
const CarteraViewState = createContext<Map<string, unknown> | null>(null);
export function CarteraViewStateProvider({
  children,
}: {
  children: ReactNode;
}) {
  const memory = useRef(new Map<string, unknown>());
  return (
    <CarteraViewState.Provider value={memory.current}>
      {children}
    </CarteraViewState.Provider>
  );
}
// Only filter/view values survive section switches; inactive query trees stay unmounted.
export function useCarteraField<T>(
  section: string,
  field: string,
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const memory = useContext(CarteraViewState),
    key = section + ":" + field;
  const [value, setValue] = useState<T>(() =>
    memory?.has(key) ? (memory.get(key) as T) : initial,
  );
  const set = useCallback(
    (next: SetStateAction<T>) =>
      setValue((previous) => {
        const value =
          typeof next === "function"
            ? (next as (previous: T) => T)(previous)
            : next;
        memory?.set(key, value);
        return value;
      }),
    [memory, key],
  );
  return [value, set];
}
