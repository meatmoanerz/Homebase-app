-- Product group ("varugrupp") chosen by the user on the Kvitton page. NULL
-- means the app guesses the group from the product name; a stored value
-- always wins. Keys: barn, fisk, snacks, kott, mejeri, frukt, brod, dryck,
-- skafferi, hem, blommor, ovrigt.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_group text;
