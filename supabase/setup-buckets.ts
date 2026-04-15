// Run with: npx tsx supabase/setup-buckets.ts
// Creates Storage buckets for Design Studio (Epic 2)

import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
)

const BUCKETS = [
  { id: "client-assets", public: false },
  { id: "generated-images", public: false },
  { id: "exports", public: true },
]

async function main() {
  for (const bucket of BUCKETS) {
    const { error } = await supabase.storage.createBucket(bucket.id, {
      public: bucket.public,
    })

    if (error) {
      if (error.message.includes("already exists")) {
        console.log(`Bucket "${bucket.id}" already exists — skipping`)
      } else {
        console.error(`Failed to create bucket "${bucket.id}":`, error.message)
      }
    } else {
      console.log(`Bucket "${bucket.id}" created (public: ${bucket.public})`)
    }
  }
}

main()
