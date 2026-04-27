import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Meet from "./pages/Meet";
import MeetDetail from "./pages/MeetDetail";
import Explore from "./pages/Explore";
import NavBar from "./components/NavBar";

export default function App() {
  return (
    <BrowserRouter>
      <NavBar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/meet" element={<Meet />} />
        <Route path="/meet/:id" element={<MeetDetail />} />
        <Route path="/explore" element={<Explore />} />
      </Routes>
    </BrowserRouter>
  );
}
