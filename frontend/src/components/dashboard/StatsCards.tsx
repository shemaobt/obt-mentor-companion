import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, Code, Users, Clock, TrendingUp, TrendingDown } from "lucide-react";
import type { StatsCardsProps } from "./types";

export function StatsCards({ stats, isMobile }: StatsCardsProps) {
  return (
    <div className={`grid grid-cols-1 ${isMobile ? 'gap-4 mb-6' : 'md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8'}`}>
      <Card>
        <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>Total Messages</p>
              <p className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-foreground`} data-testid="stat-total-messages">
                {stats?.totalMessages || 0}
              </p>
            </div>
            <div className={`${isMobile ? 'h-10 w-10' : 'h-12 w-12'} bg-primary/10 rounded-lg flex items-center justify-center`}>
              <MessageSquare className={`${isMobile ? 'h-5 w-5' : 'h-6 w-6'} text-primary`} />
            </div>
          </div>
          <div className={`${isMobile ? 'mt-3' : 'mt-4'} flex items-center ${isMobile ? 'text-xs' : 'text-sm'}`}>
            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-green-500">Active</span>
            <span className="text-muted-foreground ml-1">conversations</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>API Calls</p>
              <p className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-foreground`} data-testid="stat-api-calls">
                {stats?.totalApiCalls || 0}
              </p>
            </div>
            <div className={`${isMobile ? 'h-10 w-10' : 'h-12 w-12'} bg-accent/10 rounded-lg flex items-center justify-center`}>
              <Code className={`${isMobile ? 'h-5 w-5' : 'h-6 w-6'} text-accent-foreground`} />
            </div>
          </div>
          <div className={`${isMobile ? 'mt-3' : 'mt-4'} flex items-center ${isMobile ? 'text-xs' : 'text-sm'}`}>
            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-green-500">Requests</span>
            <span className="text-muted-foreground ml-1">processed</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>Active Keys</p>
              <p className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-foreground`} data-testid="stat-active-keys">
                {stats?.activeApiKeys || 0}
              </p>
            </div>
            <div className={`${isMobile ? 'h-10 w-10' : 'h-12 w-12'} bg-secondary/10 rounded-lg flex items-center justify-center`}>
              <Users className={`${isMobile ? 'h-5 w-5' : 'h-6 w-6'} text-secondary-foreground`} />
            </div>
          </div>
          <div className={`${isMobile ? 'mt-3' : 'mt-4'} flex items-center ${isMobile ? 'text-xs' : 'text-sm'}`}>
            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-green-500">Keys</span>
            <span className="text-muted-foreground ml-1">in use</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>Response Time</p>
              <p className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-foreground`} data-testid="stat-response-time">
                ~1.2s
              </p>
            </div>
            <div className={`${isMobile ? 'h-10 w-10' : 'h-12 w-12'} bg-muted/10 rounded-lg flex items-center justify-center`}>
              <Clock className={`${isMobile ? 'h-5 w-5' : 'h-6 w-6'} text-muted-foreground`} />
            </div>
          </div>
          <div className={`${isMobile ? 'mt-3' : 'mt-4'} flex items-center ${isMobile ? 'text-xs' : 'text-sm'}`}>
            <TrendingDown className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-green-500">Optimized</span>
            <span className="text-muted-foreground ml-1">performance</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
