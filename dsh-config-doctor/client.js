/**
 * dsh-config-doctor client — ARCHIVED (UI fused into dsh-self SelfCard).
 */
export default {
  id: 'dsh-config-doctor',
  reusable: true,
  apply(ctx) {
    ctx.effect(() => () => {}, 'dsh-config-doctor: archived')
  },
}
