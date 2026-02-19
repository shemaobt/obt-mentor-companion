import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface UserSearchCardProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  isMobile: boolean;
}

export function UserSearchCard({ searchQuery, onSearchChange, isMobile }: UserSearchCardProps) {
  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`pl-10 ${isMobile ? 'min-h-12' : ''}`}
            data-testid="input-search-users"
          />
        </div>
      </CardContent>
    </Card>
  );
}
