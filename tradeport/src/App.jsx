import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Collections from "./pages/Collections";
import CollectionHub from "./pages/CollectionHub";
import Trades from "./pages/Trades";
import JoinCommunity from "./pages/JoinCommunity";
import CreateTrade from "./pages/CreateTrade";
import ListingDetail from "./pages/ListingDetail";
import Profile from "./pages/Profile";
import About from "./pages/About";

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "") || undefined}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/collections" element={<Collections />} />
          <Route path="/collection/:id" element={<CollectionHub />} />
          <Route path="/trades" element={<Trades />} />
          <Route path="/join" element={<JoinCommunity />} />
          <Route path="/create" element={<CreateTrade />} />
          <Route path="/listing/:id" element={<ListingDetail />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/about" element={<About />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
