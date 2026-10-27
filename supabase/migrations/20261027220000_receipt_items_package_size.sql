-- Pack size per receipt line, so prices can be compared per kg/l/st.
-- package_size = how much ONE quantity contains, in package_unit.
--   Goods sold by weight: quantity = kg, package_size = 1, package_unit = 'kg'.
--   "Ägg 6-pack" x2: quantity = 2, package_size = 6, package_unit = 'st'.
--   Unknown size: both NULL (the price is then compared per article).

ALTER TABLE public.receipt_items
  ADD COLUMN IF NOT EXISTS package_size numeric,
  ADD COLUMN IF NOT EXISTS package_unit text;

ALTER TABLE public.receipt_items DROP CONSTRAINT IF EXISTS receipt_items_package_check;
ALTER TABLE public.receipt_items ADD CONSTRAINT receipt_items_package_check CHECK (
  (package_size IS NULL AND package_unit IS NULL)
  OR (package_size > 0 AND package_unit IN ('kg', 'l', 'st'))
);

-- Deposits are never a product.
UPDATE public.receipt_items SET product_id = NULL WHERE is_deposit AND product_id IS NOT NULL;

-- Loose weighed goods: the quantity already is the weight.
UPDATE public.receipt_items SET package_size = 1, package_unit = 'kg'
WHERE package_unit IS NULL AND NOT is_deposit AND quantity <> round(quantity);

-- Prepacked weighed goods read as "1 st" with the kilo price ("Wagyu Biff 1 x 1795 = 240,50"):
-- the weight is the ordinary price divided by the kilo price.
UPDATE public.receipt_items
SET quantity = round((total_price + coalesce(discount_amount, 0)) / unit_price, 3),
    package_size = 1, package_unit = 'kg'
WHERE package_unit IS NULL AND NOT is_deposit AND quantity = 1
  AND total_price > 0 AND unit_price > 2 * (total_price + coalesce(discount_amount, 0));
