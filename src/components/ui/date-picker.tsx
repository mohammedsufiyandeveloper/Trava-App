"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

interface DateTimePickerProps {
  value?: string | Date;
  onChange?: (date: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick date and time",
  disabled,
  className,
}: DateTimePickerProps) {
  const dateValue = React.useMemo(() => {
    if (!value) return undefined;
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d;
  }, [value]);

  const [date, setDate] = React.useState<Date | undefined>(dateValue);
  const [time, setTime] = React.useState<string>(() => {
    if (!dateValue) return "00:00";
    const hours = dateValue.getHours().toString().padStart(2, "0");
    const minutes = dateValue.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  });

  // Sync internal state with external value
  React.useEffect(() => {
    if (dateValue) {
      setDate(dateValue);
      const hours = dateValue.getHours().toString().padStart(2, "0");
      const minutes = dateValue.getMinutes().toString().padStart(2, "0");
      setTime(`${hours}:${minutes}`);
    } else {
      setDate(undefined);
      setTime("00:00");
    }
  }, [dateValue]);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) return;
    
    // Maintain existing time if possible
    const [hours, minutes] = time.split(":").map(Number);
    const newDate = new Date(selectedDate);
    newDate.setHours(hours || 0);
    newDate.setMinutes(minutes || 0);
    newDate.setSeconds(0);
    newDate.setMilliseconds(0);
    
    setDate(newDate);
    if (onChange) {
      // Return ISO string for consistency with datetime-local expectations if needed, 
      // but usually the forms expect a format that parseIST can handle.
      // We'll use ISO string but stripping the timezone to mimic local behavior if needed,
      // or just send the full ISO string. parseIST handles both.
      onChange(newDate.toISOString());
    }
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setTime(newTime);
    
    if (date) {
      const [hours, minutes] = newTime.split(":").map(Number);
      const newDate = new Date(date);
      newDate.setHours(hours || 0);
      newDate.setMinutes(minutes || 0);
      
      setDate(newDate);
      if (onChange) {
        onChange(newDate.toISOString());
      }
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-8 px-2 py-1",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
          <span className="truncate text-xs">
            {date ? format(date, "dd/MM/yyyy HH:mm") : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleDateSelect}
            initialFocus
          />
          <div className="border-t p-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium">Time:</span>
            <Input
              type="time"
              value={time}
              onChange={handleTimeChange}
              className="h-8 w-24 text-xs"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
