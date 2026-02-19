import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, Trash2 } from "lucide-react";
import type { ApiKeysListProps } from "./types";

const logoImage = "/logo.png";

export function ApiKeysList({ apiKeys, isMobile, onCopyKey, onDeleteKey }: ApiKeysListProps) {
  if (apiKeys.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="h-8 w-8 mx-auto mb-2 flex items-center justify-center">
          <img 
            src={logoImage} 
            alt="Assistant" 
            className="h-8 w-8 object-contain opacity-60"
            data-testid="img-empty-state-icon"
          />
        </div>
        <p className="text-sm text-muted-foreground">No API keys yet</p>
        <p className="text-xs text-muted-foreground">Create your first API key to get started</p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-4">
        {apiKeys.map((key) => (
          <Card key={key.id} data-testid={`card-api-key-${key.id}`}>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-foreground" data-testid={`text-key-name-${key.id}`}>
                    {key.name}
                  </h3>
                  <div className="flex space-x-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onCopyKey(key.maskedKey)}
                      className="h-8 w-8 p-0"
                      data-testid={`button-copy-key-${key.id}`}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDeleteKey(key.id)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      data-testid={`button-delete-key-${key.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-xs font-mono text-muted-foreground bg-muted/50 p-2 rounded" data-testid={`text-key-masked-${key.id}`}>
                  {key.maskedKey}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <div>
                    <span className="font-medium">Created:</span>
                    <br />
                    <span data-testid={`text-key-created-${key.id}`}>
                      {new Date(key.createdAt || "").toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Last Used:</span>
                    <br />
                    <span data-testid={`text-key-last-used-${key.id}`}>
                      {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : "Never"}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Name</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Key</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Created</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Last Used</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {apiKeys.map((key) => (
            <tr key={key.id} data-testid={`row-api-key-${key.id}`}>
              <td className="py-3 px-4 text-sm text-foreground" data-testid={`text-key-name-${key.id}`}>
                {key.name}
              </td>
              <td className="py-3 px-4 text-sm font-mono text-muted-foreground" data-testid={`text-key-masked-${key.id}`}>
                {key.maskedKey}
              </td>
              <td className="py-3 px-4 text-sm text-muted-foreground" data-testid={`text-key-created-${key.id}`}>
                {new Date(key.createdAt || "").toLocaleDateString()}
              </td>
              <td className="py-3 px-4 text-sm text-muted-foreground" data-testid={`text-key-last-used-${key.id}`}>
                {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : "Never"}
              </td>
              <td className="py-3 px-4 text-sm">
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onCopyKey(key.maskedKey)}
                    data-testid={`button-copy-key-${key.id}`}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDeleteKey(key.id)}
                    className="text-destructive hover:text-destructive"
                    data-testid={`button-delete-key-${key.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
