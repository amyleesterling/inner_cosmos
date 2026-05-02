import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Meet from "./pages/Meet";
import MeetDetail from "./pages/MeetDetail";
import Explore from "./pages/Explore";
import Activity from "./pages/Activity";
import Brain from "./pages/Brain";
import Brain2 from "./pages/Brain2";
import Kindergarten from "./pages/Kindergarten";
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
        <Route path="/activity" element={<Activity />} />
        <Route path="/brain" element={<Brain />} />
        <Route path="/brain/2" element={<Brain2 />} />
        <Route path="/kindergarten" element={<Kindergarten />} />
      </Routes>
    </BrowserRouter>
  );
}
