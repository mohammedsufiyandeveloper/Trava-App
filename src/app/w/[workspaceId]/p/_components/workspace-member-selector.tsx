"use client";

import { useState } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Member {
  userId: string;
  user: {
    name: string | null;
    image?: string | null;
  } | null;
  role?: string | null;
}

interface SelectorProps {
  label: string;
  placeholder: string;
  value: string[];
  onChange: (value: string[]) => void;
  members: Member[];
}

export function WorkspaceMemberSelector({
  label,
  placeholder,
  value,
  onChange,
  members
}: SelectorProps) {
  const [open, setOpen] = useState(false);

  const toggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter(v => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  return (
    <div className="w-full">
      <p className="text-sm font-medium mb-1">{label}</p>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "w-full h-10 rounded-md border bg-background px-3 flex items-center justify-between text-sm",
              !value.length && "text-muted-foreground"
            )}
          >
            {value.length ? `${value.length} selected` : placeholder}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-[300px] p-0">
          <Command>
            <CommandInput placeholder="Search members..." />
            <CommandEmpty>No members found.</CommandEmpty>

            <CommandGroup>
              {members.map((m) => {
                const username = m.user?.name ?? "Unknown";
                const role = (m.role ?? "member").toLowerCase();

                return (
                  <CommandItem
                    key={m.userId}
                    value={username}
                    onSelect={() => toggle(m.userId)}
                    className="flex items-center gap-3"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={m.user?.image || ""} />
                      <AvatarFallback>{username[0] ?? "U"}</AvatarFallback>
                    </Avatar>

                    <div className="flex-1">
                      <p className="text-sm leading-none">{username}</p>
                      <p className="text-xs text-muted-foreground capitalize">{role}</p>
                    </div>

                    <Check
                      className={cn(
                        "h-4 w-4",
                        value.includes(m.userId) ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
