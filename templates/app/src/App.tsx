import { BrowserRouter, Route, Routes } from "react-router-dom";
import Navigation from "./components/Navigation";
import Gallery from "./components/Gallery";
import Footer from "./components/Footer";
import NotFoundPage from "./components/NotFoundPage";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col">
        <Navigation />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Gallery />} />
            <Route path="/templates/:id" element={<Gallery />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
