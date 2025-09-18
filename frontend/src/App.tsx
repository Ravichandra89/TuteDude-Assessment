import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import InterviewPage from "./pages/InterviewPage";
import LandingPage from "./pages/LandingPage";

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Landing page with role selection */}
        <Route path="/" element={<LandingPage />} />

        {/* Interview page with role query */}
        <Route path="/interview" element={<InterviewPage />} />

        {/* Catch-all fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
