import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ticket, Search, Plus, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function Tickets() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-tickets-title">Tickets</h1>
            <p className="text-muted-foreground mt-2">Track and manage case tickets</p>
          </div>
          <Button data-testid="button-create-ticket">
            <Plus className="h-4 w-4 mr-2" />
            Create Ticket
          </Button>
        </div>

        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input 
              placeholder="Search tickets..." 
              className="pl-10"
              data-testid="input-search-tickets"
            />
          </div>
          <Button variant="outline" data-testid="button-filter-tickets">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5" />
                Case Management System
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Ticket className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">Ticket Management</h3>
                <p className="text-muted-foreground mb-4">
                  Centralized case tracking and workflow management
                </p>
                <div className="flex justify-center gap-2 mb-4">
                  <Badge variant="secondary">New</Badge>
                  <Badge variant="secondary">In Progress</Badge>
                  <Badge variant="secondary">Awaiting Review</Badge>
                  <Badge variant="secondary">Complete</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Features: Status tracking • Priority management • Assignment • Automated workflows
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}