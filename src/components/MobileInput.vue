<template>
  <!-- 移动端优化的输入框组件 -->
  <div
    :class="[
      'mobile-input',
      {
        'is-focused': isFocused,
        'is-disabled': disabled,
        'is-readonly': readonly,
        'has-error': error,
        'has-value': hasValue
      }
    ]"
  >
    <label v-if="label" class="mobile-input__label" :for="inputId">
      {{ label }}
      <span v-if="required" class="mobile-input__required">*</span>
    </label>

    <div class="mobile-input__wrapper">
      <span v-if="$slots.prefix" class="mobile-input__prefix">
        <slot name="prefix"></slot>
      </span>

      <input
        :id="inputId"
        ref="inputRef"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :autocomplete="autocomplete"
        :maxlength="maxlength"
        :inputmode="inputmode"
        class="mobile-input__field"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
        @change="handleChange"
        @keyup="handleKeyup"
      />

      <span v-if="$slots.suffix" class="mobile-input__suffix">
        <slot name="suffix"></slot>
      </span>

      <button
        v-if="clearable && hasValue && !disabled && !readonly"
        class="mobile-input__clear"
        @click="handleClear"
        type="button"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      </button>
    </div>

    <p v-if="error" class="mobile-input__error">
      {{ error }}
    </p>

    <p v-if="hint && !error" class="mobile-input__hint">
      {{ hint }}
    </p>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useId } from 'vue'

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  type: {
    type: String,
    default: 'text',
    validator: (value) => ['text', 'password', 'email', 'tel', 'url', 'number'].includes(value)
  },
  label: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  },
  readonly: {
    type: Boolean,
    default: false
  },
  required: {
    type: Boolean,
    default: false
  },
  clearable: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: ''
  },
  hint: {
    type: String,
    default: ''
  },
  autocomplete: {
    type: String,
    default: 'off'
  },
  maxlength: {
    type: [String, Number],
    default: null
  },
  inputmode: {
    type: String,
    default: 'text'
  }
})

const emit = defineEmits(['update:modelValue', 'focus', 'blur', 'change', 'clear', 'keyup'])

const inputId = useId()
const inputRef = ref(null)
const isFocused = ref(false)

const hasValue = computed(() => {
  return props.modelValue !== '' && props.modelValue !== null && props.modelValue !== undefined
})

const handleInput = (e) => {
  const value = props.type === 'number' ? parseFloat(e.target.value) : e.target.value
  emit('update:modelValue', value)
}

const handleFocus = (e) => {
  isFocused.value = true
  emit('focus', e)
}

const handleBlur = (e) => {
  isFocused.value = false
  emit('blur', e)
}

const handleChange = (e) => {
  const value = props.type === 'number' ? parseFloat(e.target.value) : e.target.value
  emit('change', value)
}

const handleKeyup = (e) => {
  emit('keyup', e)
}

const handleClear = () => {
  emit('update:modelValue', '')
  emit('clear')
  inputRef.value?.focus()
}

// 监听 modelValue 变化，自动聚焦
watch(() => props.modelValue, () => {
  // 可以在这里添加自动聚焦逻辑
})

onMounted(() => {
  // 组件挂载后可以做一些初始化
})

// 暴露方法
defineExpose({
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur()
})
</script>

<style scoped>
.mobile-input {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mobile-input__label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-size-sm-mobile);
  font-weight: 500;
  color: var(--text-primary);
}

.mobile-input__required {
  color: var(--accent-red);
  font-weight: 600;
}

.mobile-input__wrapper {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 12px 16px;
  background: var(--card-bg);
  border: 1px solid var(--separator);
  border-radius: var(--radius-field);
  transition: all 0.2s ease;
}

.mobile-input__wrapper.is-focused {
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 2px rgba(10, 132, 255, 0.1);
}

.mobile-input__wrapper.has-error {
  border-color: var(--accent-red);
}

.mobile-input__wrapper.is-disabled {
  background: rgba(0, 0, 0, 0.03);
  color: var(--text-tertiary);
  cursor: not-allowed;
}

.mobile-input__wrapper.is-readonly {
  background: rgba(0, 0, 0, 0.02);
  cursor: default;
}

.mobile-input__prefix,
.mobile-input__suffix {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: var(--font-size-base-mobile);
}

.mobile-input__field {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  font-family: var(--font-body);
  font-size: var(--font-size-base-mobile);
  color: var(--text-primary);
  line-height: 1.5;
  width: 100%;
}

.mobile-input__field::placeholder {
  color: var(--text-tertiary);
}

.mobile-input__field:disabled {
  color: var(--text-tertiary);
  cursor: not-allowed;
}

.mobile-input__field:-webkit-autofill,
.mobile-input__field:-webkit-autofill:hover,
.mobile-input__field:-webkit-autofill:focus {
  -webkit-text-fill-color: var(--text-primary);
  -webkit-box-shadow: 0 0 0 48px var(--card-bg) inset;
  transition: background-color 5000s ease-in-out 0s;
}

.mobile-input__clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: rgba(0, 0, 0, 0.05);
  border: none;
  border-radius: 50%;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.mobile-input__clear:active {
  transform: scale(0.9);
  background: rgba(0, 0, 0, 0.1);
}

.mobile-input__clear svg {
  width: 14px;
  height: 14px;
}

.mobile-input__error,
.mobile-input__hint {
  font-size: var(--font-size-xs-mobile);
  line-height: 1.4;
  padding: 4px 0;
}

.mobile-input__error {
  color: var(--accent-red);
}

.mobile-input__hint {
  color: var(--text-tertiary);
}

/* 深色模式 */
.dark .mobile-input__wrapper {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.1);
}

.dark .mobile-input__wrapper.is-focused {
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 2px rgba(10, 132, 255, 0.2);
}

.dark .mobile-input__wrapper.is-disabled {
  background: rgba(255, 255, 255, 0.02);
}

.dark .mobile-input__wrapper.is-readonly {
  background: rgba(255, 255, 255, 0.01);
}

.dark .mobile-input__field:-webkit-autofill,
.dark .mobile-input__field:-webkit-autofill:hover,
.dark .mobile-input__field:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0 48px rgba(255, 255, 255, 0.03) inset;
}

.dark .mobile-input__clear {
  background: rgba(255, 255, 255, 0.1);
}

.dark .mobile-input__clear:active {
  background: rgba(255, 255, 255, 0.2);
}

/* 高对比度模式 */
@media (prefers-contrast: high) {
  .mobile-input__wrapper {
    border-width: 2px;
  }

  .mobile-input__label {
    font-weight: 600;
  }
}

/* 减少动画 */
@media (prefers-reduced-motion: reduce) {
  .mobile-input__wrapper,
  .mobile-input__clear {
    transition: none;
  }

  .mobile-input__clear:active {
    transform: none;
  }
}

/* 触摸优化 */
@media (hover: none) and (pointer: coarse) {
  .mobile-input__wrapper:active {
    background: rgba(10, 132, 255, 0.03);
  }
}
</style>
