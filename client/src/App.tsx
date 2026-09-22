import type { ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminUsers from './pages/AdminUsers';
import SevakRegistration from './pages/SevakRegistration';
import SevakList from './pages/SevakList';
import ReceiptEntry from './pages/ReceiptEntry';
import ReceiptSearch from './pages/ReceiptSearch';
import BookAllocation from './pages/BookAllocation';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';

function App(): ReactElement {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/sevaks" element={<SevakList />} />
            <Route path="/sevaks/register" element={<SevakRegistration />} />
            <Route path="/receipts/entry" element={<ReceiptEntry />} />
            <Route path="/receipts/search" element={<ReceiptSearch />} />
            <Route path="/books/allocate" element={<BookAllocation />} />
            <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} />}>
              <Route path="/admin/users" element={<AdminUsers />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
