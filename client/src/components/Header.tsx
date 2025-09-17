import { Bell, Search, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Logo and Brand */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">GP</span>
            </div>
            <span className="text-xl font-semibold">GPNet</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            Pre-Employment v1.1
          </Badge>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-md mx-8">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search cases, workers, or tickets..."
              className="pl-9"
              data-testid="input-search"
            />
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" data-testid="button-notifications">
            <Bell className="h-4 w-4" />
            <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs">
              3
            </Badge>
          </Button>

          <Button size="icon" variant="ghost" data-testid="button-settings">
            <Settings className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" data-testid="button-user-menu">
                <User className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem data-testid="menu-profile">Profile</DropdownMenuItem>
              <DropdownMenuItem data-testid="menu-settings">Settings</DropdownMenuItem>
              <DropdownMenuItem data-testid="menu-logout">Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}