"use client"

import { clients, niches } from "@/data/mock"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, FolderOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

const statusColor = {
  active: "bg-green-500",
  new: "bg-blue-400",
  seasonal: "bg-amber-400",
  inactive: "bg-[hsl(0_0%_45%)]",
}

export function ChatSidebar() {
  return (
    <aside className="flex w-64 flex-col border-r border-[hsl(0_0%_20%)] bg-[hsl(10_5%_10%)]">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[hsl(0_0%_50%)]">
          Clientes
        </h2>
        <button
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon-xs" }),
            "text-[hsl(0_0%_50%)] hover:text-white hover:bg-[hsl(0_0%_100%/0.06)]"
          )}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-0.5">
          {clients.map((client) => (
            <button
              key={client.id}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-[hsl(0_0%_75%)] transition-colors hover:bg-[hsl(0_0%_100%/0.06)] hover:text-white"
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${statusColor[client.status]}`}
              />
              <span className="truncate">{client.name}</span>
            </button>
          ))}
        </div>

        <div className="my-4 h-px bg-[hsl(0_0%_20%)]" />

        <div className="pb-4">
          <h2 className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-widest text-[hsl(0_0%_50%)]">
            Nichos
          </h2>
          <div className="space-y-0.5">
            {niches.map((niche) => (
              <button
                key={niche.id}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-[hsl(0_0%_75%)] transition-colors hover:bg-[hsl(0_0%_100%/0.06)] hover:text-white"
              >
                <FolderOpen className="h-4 w-4 shrink-0 text-[hsl(0_0%_45%)]" />
                <span>{niche.name}</span>
              </button>
            ))}
          </div>
        </div>
      </ScrollArea>
    </aside>
  )
}
