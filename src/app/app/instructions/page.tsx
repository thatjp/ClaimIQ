import { ClaimIQLogo } from '@/components/ClaimIQLogo'

export default function InstructionsPage() {
  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="mb-6">
        <ClaimIQLogo variant="light" size="md" />
      </div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">How to use ClaimIQ</h1>
      <p className="text-sm text-gray-500 mb-8">A step-by-step guide for adjusters processing property loss claims.</p>

      <div className="space-y-8">

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shrink-0">1</span>
            Create a new claim
          </h2>
          <div className="pl-8 space-y-2 text-sm text-gray-600">
            <p>Click <strong>New Claim</strong> in the sidebar and fill in the claim details — state, policy type, and date of loss.</p>
            <p>In the <strong>Item Description</strong> box, describe the damaged or lost items as specifically as possible. Include brand names, model numbers, sizes, and approximate purchase year where known.</p>
            <p className="bg-blue-50 border border-blue-100 rounded-md px-3 py-2 text-blue-800">
              <strong>Example:</strong> "65-inch Samsung QLED TV model QN65Q80C purchased 2022, KitchenAid 5qt stand mixer Artisan series, MacBook Pro 14-inch M2 Pro 2023"
            </p>
            <p>You can also use the <strong>Record voice description</strong> button to dictate items hands-free. Press stop when finished — the transcript will appear automatically.</p>
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shrink-0">2</span>
            Review extracted items and pricing
          </h2>
          <div className="pl-8 space-y-2 text-sm text-gray-600">
            <p>After submitting, ClaimIQ automatically extracts individual items from your description and prices each one using a multi-source lookup — checking a shared price cache first, then eBay, Amazon, Walmart, and Home Depot as needed.</p>
            <p>You can watch this happen in real time on the dashboard. Once complete, open the claim to review the full item list.</p>
            <p>Each item shows its <strong>price source</strong> — whether it came from the shared cache (faster) or a live marketplace lookup. Items flagged by the AI will show a flag reason and require manual review.</p>
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shrink-0">3</span>
            Edit and approve items
          </h2>
          <div className="pl-8 space-y-2 text-sm text-gray-600">
            <p>Review each item's name, brand, condition, and price. Click the edit icon on any row to make corrections.</p>
            <p>If the auto-sourced price looks wrong, click <strong>Refresh price</strong> to re-run the lookup. You can also enter a price manually — paste a direct product URL as the source to ground the value.</p>
            <p>Once an item has a valid price and at least one source URL, the <strong>approval checkbox</strong> becomes available. Approved items are included in the generated claim document.</p>
            <p className="bg-amber-50 border border-amber-100 rounded-md px-3 py-2 text-amber-800">
              <strong>Note:</strong> Items cannot be approved without both a price and a verifiable source URL. This is required for document generation.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shrink-0">4</span>
            Generate the claim document
          </h2>
          <div className="pl-8 space-y-2 text-sm text-gray-600">
            <p>Once all items are approved, click <strong>Generate Document</strong>. ClaimIQ produces a professional claim document including an itemized loss schedule, replacement cost values, and an adjuster certification statement.</p>
            <p>The document streams to the screen as it's generated. Any items with prices older than 90 days will be flagged with <strong>[STALE PRICE — VERIFY]</strong> for manual confirmation before submission.</p>
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shrink-0">5</span>
            Add more items to an existing claim
          </h2>
          <div className="pl-8 space-y-2 text-sm text-gray-600">
            <p>Open an existing claim and click <strong>Add Items</strong>. Describe the additional items the same way as the initial submission — they'll be extracted, priced, and added to the existing item list.</p>
          </div>
        </section>

        <section className="border-t border-gray-200 pt-8">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Tips for better results</h2>
          <ul className="pl-4 space-y-1.5 text-sm text-gray-600 list-disc">
            <li>Include brand and model numbers whenever possible — they significantly improve pricing accuracy.</li>
            <li>Describe condition honestly (new, good, fair, poor) — it affects replacement cost calculations.</li>
            <li>List one item per sentence to help the AI extract them cleanly.</li>
            <li>Prices are shared across all adjusters — if a colleague recently priced the same item, yours will resolve instantly from cache.</li>
            <li>Structural items like cabinets, flooring, and built-ins are automatically excluded — these are covered separately under the policy.</li>
          </ul>
        </section>

      </div>
    </div>
  )
}
