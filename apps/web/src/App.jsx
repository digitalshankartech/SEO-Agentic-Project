import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ProductContext from './pages/ProductContext';
import SEOAudit from './pages/SEOAudit';
import Copywriter from './pages/Copywriter';
import CROAnalyzer from './pages/CROAnalyzer';
import EmailBuilder from './pages/EmailBuilder';
import ContentStrategy from './pages/ContentStrategy';
import CompetitorAnalysis from './pages/CompetitorAnalysis';
import SEOAEOMissingAnalysis from './pages/SEOAEOMissingAnalysis';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="context" element={<ProductContext />} />
          <Route path="seo" element={<SEOAudit />} />
          <Route path="copy" element={<Copywriter />} />
          <Route path="cro" element={<CROAnalyzer />} />
          <Route path="email" element={<EmailBuilder />} />
          <Route path="content" element={<ContentStrategy />} />
          <Route path="competitor-gap" element={<SEOAEOMissingAnalysis />} />
          <Route path="competitor" element={<CompetitorAnalysis />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
