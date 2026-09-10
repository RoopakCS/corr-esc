import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { RegisterOrg } from "./pages/RegisterOrg.js";
import { Login } from "./pages/Login.js";
import { AdminDashboard } from "./pages/AdminDashboard.js";
import { RegisterComplainant } from "./pages/RegisterComplainant.js";
import { ComplainantPortal } from "./pages/ComplainantPortal.js";
import { StaffPortal } from "./pages/StaffPortal.js";

function OrgRedirect() {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate to={`/org/${slug}/login`} replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RegisterOrg />} />
        <Route path="/register" element={<RegisterOrg />} />
        <Route path="/org/:slug" element={<OrgRedirect />} />
        <Route path="/org/:slug/login" element={<Login />} />
        <Route path="/org/:slug/register" element={<RegisterComplainant />} />
        <Route path="/org/:slug/portal" element={<ComplainantPortal />} />
        <Route path="/org/:slug/staff/dashboard" element={<StaffPortal />} />
        <Route path="/org/:slug/admin/dashboard" element={<AdminDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
