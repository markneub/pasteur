<script setup>
import { PopoverAnchor, useForwardProps } from 'reka-ui'

const props = defineProps({
  asChild: { type: Boolean, required: false },
  as: { type: null, required: false },
  class: {
    type: [Boolean, null, String, Object, Array],
    required: false,
    skipCheck: true,
  },
})

const forwarded = useForwardProps(props)
</script>

<template>
  <PopoverAnchor v-bind="forwarded" :class="props.class">
    <slot />
  </PopoverAnchor>
</template>
