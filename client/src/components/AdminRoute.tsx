import { useUser } from '@/components/UserContext';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import AdminLogin from '@/pages/AdminLogin';
import AdminConsole from '@/pages/AdminConsole';

export default function AdminRoute() {
  const { user, isLoading } = useUser();

  // TEMPORARY: Bypass authentication for development - go straight to admin console
  return <AdminConsole />;

  // Show loading while fetching user data
  // if (isLoading) {
  //   return (
  //     <div className="min-h-screen flex items-center justify-center">
  //       <Card className="w-96">
  //         <CardContent className="pt-6">
  //           <div className="text-center py-8">
  //             <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-4" />
  //             <p className="text-muted-foreground">Loading...</p>
  //           </div>
  //         </CardContent>
  //       </Card>
  //     </div>
  //   );
  // }

  // Show admin login if not authenticated or not admin
  // if (!user || user.userType !== 'admin') {
  //   return <AdminLogin />;
  // }

  // Show admin console if authenticated as admin
  // return <AdminConsole />;
}