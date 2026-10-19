import * as React from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import Navigation from "./components/Navigation";
import Gallery from "./components/Gallery";
import Footer from "./components/Footer";
import NotFoundPage from "./components/NotFoundPage";
import TemplatePage from "./components/TemplatePage";

function ScrollToTop() {
  const { pathname } = useLocation();
  const previousPathname = React.useRef(pathname);

  React.useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <div className="flex min-h-screen flex-col">
        <Navigation />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Gallery />} />
            <Route path="/templates/:id" element={<TemplatePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
