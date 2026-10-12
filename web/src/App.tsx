import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { MonitorDetail } from "./pages/MonitorDetail";
import { MonitorForm } from "./pages/MonitorForm";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/status" element={<Dashboard />} />
        <Route path="/monitors/new" element={<MonitorForm />} />
        <Route path="/monitors/:id/edit" element={<MonitorForm />} />
        <Route path="/monitors/:id" element={<MonitorDetail />} />
      </Route>
    </Routes>
  );
}
