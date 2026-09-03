/**
 * DeepSeek usage host — delegate to sibling package (fused via dsh-self).
 */
import { apply as applyUsagePatch } from '../dsh-deepseek-usage-patch/index.js'

export async function applyUsageHost(ctx) {
  return applyUsagePatch(ctx)
}
