import { Routes, Route } from "react-router-dom";
import { HomePage } from "./routes/HomePage";
import { HostPage } from "./routes/HostPage";
import { PlayPage } from "./routes/PlayPage";
import { ModPage } from "./routes/ModPage";
import { CollectionsPage } from "./routes/CollectionsPage";
import { ScreenCheckerPage } from "./routes/ScreenCheckerPage";
import { useButtonPressSound } from "./hooks/useButtonPressSound";

export function App() {
  useButtonPressSound();

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/host" element={<HostPage />} />
      <Route path="/host/:code" element={<HostPage />} />
      <Route path="/play" element={<PlayPage />} />
      <Route path="/play/:code" element={<PlayPage />} />
      <Route path="/mod/:code" element={<ModPage />} />
      <Route path="/collections" element={<CollectionsPage />} />
      <Route path="/screen-checker" element={<ScreenCheckerPage />} />
    </Routes>
  );
}
