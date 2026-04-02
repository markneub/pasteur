<script setup>
import { reactiveOmit } from "@vueuse/core";
import { ToggleGroupRoot, useForwardPropsEmits } from "reka-ui";
import { provide } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps({
  rovingFocus: { type: Boolean, required: false },
  disabled: { type: Boolean, required: false },
  orientation: { type: String, required: false },
  dir: { type: String, required: false },
  loop: { type: Boolean, required: false },
  asChild: { type: Boolean, required: false },
  as: { type: null, required: false },
  name: { type: String, required: false },
  required: { type: Boolean, required: false },
  type: { type: String, required: false },
  modelValue: { type: null, required: false },
  defaultValue: { type: null, required: false },
  class: {
    type: [Boolean, null, String, Object, Array],
    required: false,
    skipCheck: true,
  },
  variant: { type: null, required: false },
  size: { type: null, required: false },
});
const emits = defineEmits(["update:modelValue"]);

provide("toggleGroup", {
  variant: props.variant,
  size: props.size,
});

const delegatedProps = reactiveOmit(props, "class");

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <ToggleGroupRoot
    v-slot="slotProps"
    v-bind="forwarded"
    :class="cn('flex items-center justify-center gap-1', props.class)"
  >
    <slot v-bind="slotProps" />
  </ToggleGroupRoot>
</template>
