import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link2, ChevronUp, ChevronDown, Play, MoreHorizontal, Trash, Plus } from "lucide-react";
import type { ChatChainsListProps } from "./types";

export function ChatChainsList({
  chatChains,
  chats,
  chainsExpanded,
  isMobile,
  onToggleExpanded,
  onContinueChain,
  onCreateChain,
  onDeleteChain,
  isContinuePending,
  isCreatePending
}: ChatChainsListProps) {
  if (chatChains.length === 0) return null;

  return (
    <div className="p-3 md:p-4 border-b border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground">Chat Chains</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleExpanded}
          className="h-6 w-6 p-0"
          data-testid="button-toggle-chains"
        >
          {chainsExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>
      
      {chainsExpanded && (
        <div className="space-y-2">
          {chatChains.map((chain) => {
            const chainChats = chats.filter(c => c.chainId === chain.id);
            return (
              <div key={chain.id} className="relative group p-2 rounded-md border border-border hover:border-primary/50 transition-colors" data-testid={`chain-${chain.id}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate" data-testid={`text-chain-title-${chain.id}`}>
                      {chain.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {chainChats.length} chat{chainChats.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center space-x-1 ml-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onContinueChain(chain.id)}
                      className="h-7 px-2"
                      disabled={isContinuePending}
                      data-testid={`button-continue-chain-${chain.id}`}
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={isMobile ? 'opacity-100 h-7 w-7 p-0' : 'opacity-0 group-hover:opacity-100 h-7 w-7 p-0'}
                          data-testid={`button-chain-menu-${chain.id}`}
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => onDeleteChain(chain.id)}
                          data-testid={`button-delete-chain-${chain.id}`}
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Delete chain
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            );
          })}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const title = prompt("Enter chain title:");
              if (title) onCreateChain(title);
            }}
            className="w-full"
            disabled={isCreatePending}
            data-testid="button-new-chain"
          >
            <Plus className="h-3 w-3 mr-2" />
            New Chain
          </Button>
        </div>
      )}
    </div>
  );
}
