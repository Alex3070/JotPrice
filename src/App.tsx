import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { initDB } from "./db/database";
import { ToastProvider } from "./components/ui";
import { OcrQueueProvider } from "./hooks/useOcrQueue";
import { BottomNav } from "./components/BottomNav";
import HomePage from "./pages/HomePage";
import ListPage from "./pages/ListPage";
import ManagePage from "./pages/ManagePage";

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initDB()
      .then(() => setReady(true))
      .catch((e) => console.error("initDB failed", e));
  }, []);

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center bg-soft-bg">
        <div className="animate-pop text-3xl">🥬</div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <OcrQueueProvider>
        <div className="min-h-full bg-soft-bg">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/list" element={<ListPage />} />
            <Route path="/manage" element={<ManagePage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
          <BottomNav />
        </div>
      </OcrQueueProvider>
    </ToastProvider>
  );
}
