import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Meet from "./pages/Meet";
import MeetDetail from "./pages/MeetDetail";
import Explore from "./pages/Explore";
import NavBar from "./components/NavBar";

// Vite's BASE_URL is "/" in dev and "/inner_cosmos/" in production. React
// Router wants the basename WITHOUT a trailing slash, so strip it.
const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function App() {
  return (
    <BrowserRouter basename={BASENAME}>
      <NavBar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/meet" element={<Meet />} />
        <Route path="/meet/:id" element={<MeetDetail />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/explore/:stage" element={<Explore />} />
      </Routes>
    </BrowserRouter>
  );
}
