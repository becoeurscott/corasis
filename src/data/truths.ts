import product from '../../shared/product.json';

/** Five Truths content, shared with the iOS app (shared/product.json → "truths"). */
export interface TruthItem { id: string; emoji: string; text: string; options: string[] }

export const truths = product.truths as { intro: string; items: TruthItem[]; talk: string };
export const truthsItemCount = truths.items.length;
