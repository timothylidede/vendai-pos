# Pagewise Product Addition TODO

This checklist tracks page-by-page extraction of distributor pricelists using the new pagewise agent (`scripts/pagewise-product-agent.ts`). Check off each page as you regenerate and review the data.

## Sam West Pricelist (153 pages)
- [ ] Pages 1-10
- [ ] Pages 11-20
- [ ] Pages 21-30
- [ ] Pages 31-40
- [ ] Pages 41-50
- [ ] Pages 51-60
- [ ] Pages 61-70
- [ ] Pages 71-80
- [ ] Pages 81-90
- [ ] Pages 91-100
- [ ] Pages 101-110
- [ ] Pages 111-120
- [ ] Pages 121-130
- [ ] Pages 131-140
- [ ] Pages 141-153

## Mahitaji Pricelist (to be confirmed)
- [ ] Pages 1-10
- [ ] Pages 11-20
- [ ] Pages 21-30
- [ ] Pages 31-40
- [ ] Pages 41-50
- [ ] Pages 51+

## How to Run

1. Ensure `.env.local` contains `OPENAI_API_KEY` and optional Firebase credentials.
2. Dry run a batch to preview the cleaning rules (Sam West headers are stripped automatically; Mahitaji lines are normalized):
   
   ```powershell
   npx tsx scripts/pagewise-product-agent.ts --txt="data/SAM WEST SUPERMARKET PRICELIST_20250726_094811 (2)_extracted_text.txt" --distributor="Sam West" --id=sam-west --max-pages=1 --dry-run
   ```
3. Process a specific page range (example for pages 1-5):
   
   ```powershell
   npx tsx scripts/pagewise-product-agent.ts --txt="data/SAM WEST SUPERMARKET PRICELIST_20250726_094811 (2)_extracted_text.txt" --distributor="Sam West" --id=sam-west --start-page=1 --end-page=5
   ```
4. Repeat for Mahitaji by swapping the TXT path, distributor name, and ID. No additional flags are required—the agent automatically chunks Mahitaji blocks into manageable pages and inserts spaces between units/prices.

Tips:
- Use `--max-pages=N` when spot-checking a few pages before a full run.
- Add `--resume` to reuse cached JSON for pages you have already accepted.
- For large reruns, process 5–10 pages per invocation so you can review and commit incrementally.

Tick off the relevant checklist sections as you complete each batch and review the generated `data/distributors/*.ts` files.
