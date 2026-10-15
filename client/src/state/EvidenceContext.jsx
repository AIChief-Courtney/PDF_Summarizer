import { createContext, useContext, useMemo, useState } from "react";

const EvidenceContext = createContext(null);

export function EvidenceProvider({ children }) {
  const [evidence, setEvidence] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const value = useMemo(
    () => ({
      evidence,
      drawerOpen,
      openEvidence: (payload) => {
        setEvidence(payload);
        setDrawerOpen(true);
      },
      closeEvidence: () => {
        setDrawerOpen(false);
      },
    }),
    [evidence, drawerOpen]
  );

  return (
    <EvidenceContext.Provider value={value}>{children}</EvidenceContext.Provider>
  );
}

export function useEvidence() {
  const ctx = useContext(EvidenceContext);
  if (!ctx) throw new Error("EvidenceProvider required");
  return ctx;
}
