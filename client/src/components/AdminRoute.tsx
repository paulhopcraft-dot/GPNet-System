import ProtectedRoute from '@/components/ProtectedRoute';
import AdminConsole from '@/pages/AdminConsole';

export default function AdminRoute() {
  return (
    <ProtectedRoute requireAdmin>
      <AdminConsole />
    </ProtectedRoute>
  );
}