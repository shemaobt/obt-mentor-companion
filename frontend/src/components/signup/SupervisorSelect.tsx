import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SupervisorSelectProps } from "./types";

export function SupervisorSelect({ form, supervisors, loadingSupervisors, open, setOpen }: SupervisorSelectProps) {
  return (
    <FormField
      control={form.control}
      name="supervisorId"
      render={({ field }) => (
        <FormItem className="flex flex-col">
          <FormLabel>Supervisor (optional)</FormLabel>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <FormControl>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className={cn(
                    "w-full justify-between",
                    !field.value && "text-muted-foreground"
                  )}
                  data-testid="button-select-supervisor"
                >
                  {field.value
                    ? supervisors.find((supervisor) => supervisor.id === field.value)?.fullName
                    : "Select supervisor..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0">
              <Command>
                <CommandInput placeholder="Search supervisor..." data-testid="input-search-supervisor" />
                <CommandEmpty>
                  {loadingSupervisors ? "Loading..." : "No supervisor found."}
                </CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="none"
                    onSelect={() => {
                      form.setValue("supervisorId", undefined);
                      setOpen(false);
                    }}
                    data-testid="option-supervisor-none"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        !field.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    No supervisor
                  </CommandItem>
                  {supervisors.map((supervisor) => (
                    <CommandItem
                      key={supervisor.id}
                      value={supervisor.fullName}
                      onSelect={() => {
                        form.setValue("supervisorId", supervisor.id);
                        setOpen(false);
                      }}
                      data-testid={`option-supervisor-${supervisor.id}`}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          supervisor.id === field.value
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      {supervisor.fullName}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
