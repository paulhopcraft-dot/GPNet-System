import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Workers() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-workers-title">Workers</h1>
            <p className="text-muted-foreground mt-2">Manage worker profiles and health records</p>
          </div>
          <Button data-testid="button-add-worker">
            <Plus className="h-4 w-4 mr-2" />
            Add Worker
          </Button>
        </div>

        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input 
              placeholder="Search workers..." 
              className="pl-10"
              data-testid="input-search-workers"
            />
          </div>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Worker Database
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">Worker Management</h3>
                <p className="text-muted-foreground mb-4">
                  Comprehensive worker profile and health record management system
                </p>
                <p className="text-sm text-muted-foreground">
                  Features: Health assessments • Medical certificates • Risk scoring • Compliance tracking
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}