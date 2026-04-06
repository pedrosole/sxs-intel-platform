"use client"

import Link from "next/link"
import { Users, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export function Header() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-[hsl(0_0%_20%)] bg-[hsl(10_5%_11%)] px-4">
      <Link href="/" className="text-lg font-semibold tracking-tight text-white">
        <span className="text-[hsl(16,100%,50%)]">SXS</span> Intel
      </Link>
      <div className="flex items-center gap-1">
        <Link
          href="/equipe"
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "text-[hsl(0_0%_65%)] hover:text-white hover:bg-[hsl(0_0%_100%/0.06)]"
          )}
          title="Equipe"
        >
          <Users className="h-5 w-5" />
        </Link>
        <button
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "text-[hsl(0_0%_65%)] hover:text-white hover:bg-[hsl(0_0%_100%/0.06)]"
          )}
          title="Configuracoes"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>
    </header>
  )
}
