"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"

interface BackLinkProps {
  href: string
}

export function BackLink({ href }: BackLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <ArrowLeft className="h-5 w-5" />
    </Link>
  )
}
