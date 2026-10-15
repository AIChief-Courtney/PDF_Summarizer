import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./layout/AppShell.jsx";
import { EvidenceProvider } from "./state/EvidenceContext.jsx";
import { Overview } from "./pages/Overview.jsx";
import { Documents } from "./pages/Documents.jsx";
import { SummariesList } from "./pages/SummariesList.jsx";
import { CreateSummary } from "./pages/CreateSummary.jsx";
import { SummaryDetail } from "./pages/SummaryDetail.jsx";
import { AskAI } from "./pages/AskAI.jsx";
import { Settings } from "./pages/Settings.jsx";
import "./App.css";
import "./styles/shell.css";

export default function AppRouter() {
  return (
    <EvidenceProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Overview />} />
            <Route path="documents" element={<Documents />} />
            <Route path="summaries" element={<SummariesList />} />
            <Route path="summaries/new" element={<CreateSummary />} />
            <Route path="summaries/:id" element={<SummaryDetail />} />
            <Route path="ask" element={<AskAI />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </EvidenceProvider>
  );
}
