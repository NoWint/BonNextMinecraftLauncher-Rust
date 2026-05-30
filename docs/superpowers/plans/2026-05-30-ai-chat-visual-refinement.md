# AI Chat Panel Visual Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure AI chat panel into two visual layers (gradient-blurred background + Gaussian-blurred controls card on right), replace single right-edge rainbow line with four-edge right-to-left ripple animation.

**Architecture:** Two CSS layers in the same React component. `.panel` becomes a content-free background with gradient mask + strong blur. A new `.controlsCard` wraps the chat content with uniform Gaussian blur, positioned right (~45% width). `.rainbowEdge` is replaced by `.rainbowBorder` with 4 child elements that cascade-animate from right to left.

**Tech Stack:** React 18, TypeScript, CSS Modules

---

### Task 1: Rewrite CSS Module — Rainbow Border, Background, Controls Card

**Files:**

- Modify: `src/components/ai/ChatPanel.module.css`

- [ ] **Step 1: Replace `.rainbowEdge` and `.rainbowGlow` with `.rainbowBorder` system**

Replace the old rainbow edge/glow CSS (lines 1–76) with the new four-edge ripple border:

```css
/* ========================================
   Rainbow Ripple Border — 4 edges, right-to-left cascade
   ======================================== */

.rainbowBorder {
  position: fixed;
  inset: 0;
  z-index: 1003;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.5s ease;
}

.rainbowBorder--visible {
  opacity: 1;
}

.rainbowBorder__edge {
  position: absolute;
  background: linear-gradient(90deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3, #54a0ff, #5f27cd);
  background-size: 200% 100%;
  animation: rainbowFlowBorder 4s linear infinite;
  opacity: 0;
}

.rainbowBorder--visible .rainbowBorder__edge--right {
  animation: edgeFadeIn 0.3s ease-out forwards;
  animation-delay: 0s;
}

.rainbowBorder--visible .rainbowBorder__edge--top {
  animation: edgeGrowRight 0.4s ease-out forwards;
  animation-delay: 0.15s;
}

.rainbowBorder--visible .rainbowBorder__edge--bottom {
  animation: edgeGrowRight 0.4s ease-out forwards;
  animation-delay: 0.15s;
}

.rainbowBorder--visible .rainbowBorder__edge--left {
  animation: edgeFadeIn 0.3s ease-out forwards;
  animation-delay: 0.35s;
}

/* Right edge: full height, 3px wide, on right */
.rainbowBorder__edge--right {
  top: 0;
  right: 0;
  width: 3px;
  height: 100%;
  background: linear-gradient(180deg, #ff6b6b 0%, #feca57 20%, #48dbfb 40%, #ff9ff3 60%, #54a0ff 80%, #5f27cd 100%);
  background-size: 100% 200%;
  filter: blur(1px);
  box-shadow:
    0 0 12px rgba(72, 219, 251, 0.3),
    0 0 24px rgba(255, 159, 243, 0.15);
}

/* Top edge: full width, 3px tall, on top */
.rainbowBorder__edge--top {
  top: 0;
  left: 0;
  height: 3px;
  width: 100%;
  filter: blur(1px);
  box-shadow: 0 0 12px rgba(72, 219, 251, 0.3);
  transform-origin: right center;
}

/* Bottom edge: full width, 3px tall, on bottom */
.rainbowBorder__edge--bottom {
  bottom: 0;
  left: 0;
  height: 3px;
  width: 100%;
  filter: blur(1px);
  box-shadow: 0 0 12px rgba(255, 159, 243, 0.3);
  transform-origin: right center;
}

/* Left edge: full height, 3px wide, on left */
.rainbowBorder__edge--left {
  top: 0;
  left: 0;
  width: 3px;
  height: 100%;
  background: linear-gradient(180deg, #ff6b6b 0%, #feca57 20%, #48dbfb 40%, #ff9ff3 60%, #54a0ff 80%, #5f27cd 100%);
  background-size: 100% 200%;
  filter: blur(1px);
  box-shadow:
    0 0 12px rgba(72, 219, 251, 0.3),
    0 0 24px rgba(84, 160, 255, 0.15);
}

/* Rainbow flow for horizontal edges */
@keyframes rainbowFlowBorder {
  0%,
  100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

/* Fade in (right and left edges) */
@keyframes edgeFadeIn {
  from {
    opacity: 0;
    filter: blur(6px);
  }
  to {
    opacity: 0.85;
    filter: blur(1px);
  }
}

/* Grow from right (top and bottom edges) */
@keyframes edgeGrowRight {
  from {
    opacity: 0;
    transform: scaleX(0);
  }
  to {
    opacity: 0.85;
    transform: scaleX(1);
  }
}
```

- [ ] **Step 2: Rewrite `.panel` as background-only layer**

Replace the old `.panel` styles (lines 78–115) with a content-free background layer:

```css
/* ========================================
   Background Layer — gradient blur, no content
   ======================================== */

.panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: var(--sidebar-width, 190px);
  z-index: 1000;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.5s ease;
  backdrop-filter: blur(28px) saturate(120%);
  -webkit-backdrop-filter: blur(28px) saturate(120%);
  mask-image: linear-gradient(
    to left,
    rgba(0, 0, 0, 1) 0%,
    rgba(0, 0, 0, 1) 40%,
    rgba(0, 0, 0, 0.95) 60%,
    rgba(0, 0, 0, 0.8) 75%,
    rgba(0, 0, 0, 0.4) 90%,
    rgba(0, 0, 0, 0) 100%
  );
  -webkit-mask-image: linear-gradient(
    to left,
    rgba(0, 0, 0, 1) 0%,
    rgba(0, 0, 0, 1) 40%,
    rgba(0, 0, 0, 0.95) 60%,
    rgba(0, 0, 0, 0.8) 75%,
    rgba(0, 0, 0, 0.4) 90%,
    rgba(0, 0, 0, 0) 100%
  );
}

.panel--open {
  opacity: 1;
  pointer-events: none;
}
```

- [ ] **Step 3: Add `.controlsCard` styles**

Add the new controls card with Gaussian blur, right-aligned:

```css
/* ========================================
   Controls Card — Gaussian blur, right-aligned
   ======================================== */

.controlsCard {
  position: fixed;
  top: 40px;
  right: 4%;
  bottom: 40px;
  width: 45%;
  z-index: 1001;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 20px;
  border: 0.5px solid rgba(255, 255, 255, 0.06);
  box-shadow:
    0 8px 40px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  transform: translateX(120%);
  transition: transform 0.55s cubic-bezier(0.22, 0.8, 0.25, 1);
}

.controlsCard--open {
  transform: translateX(0);
}
```

- [ ] **Step 4: Move header, messages, input styles to `.controlsCard__*`**

Replace the old `.panel__header`, `.panel__messages`, `.panel__inputArea` (and nested) classes with card-scoped versions:

```css
/* ========================================
   Controls Card — Header
   ======================================== */

.controlsCard__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px 14px;
  flex-shrink: 0;
}

.controlsCard__title {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif;
  font-size: 0.95em;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: rgba(255, 255, 255, 0.85);
  display: flex;
  align-items: center;
  gap: 8px;
}

.controlsCard__title::before {
  content: '';
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: linear-gradient(135deg, #48dbfb, #54a0ff);
  box-shadow: 0 0 10px rgba(72, 219, 251, 0.5);
  flex-shrink: 0;
}

.controlsCard__actions {
  display: flex;
  gap: 4px;
}

.controlsCard__actionBtn {
  background: rgba(255, 255, 255, 0.06);
  border: none;
  color: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  width: 28px;
  height: 28px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.55em;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif;
  font-weight: 500;
  transition: all 0.2s ease;
}

.controlsCard__actionBtn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.8);
}

/* ========================================
   Controls Card — Messages
   ======================================== */

.controlsCard__messages {
  flex: 1;
  overflow-y: auto;
  padding: 8px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  scroll-behavior: smooth;
}

.controlsCard__messages::-webkit-scrollbar {
  width: 2px;
}
.controlsCard__messages::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
}

/* Empty state */
.controlsCard__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.25);
  font-size: 0.7em;
}

.controlsCard__emptyIcon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(72, 219, 251, 0.12), rgba(255, 159, 243, 0.1));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1em;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.4);
}

.controlsCard__emptyText {
  text-align: center;
  line-height: 1.6;
  font-size: 0.9em;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif;
}

/* ========================================
   Controls Card — Input Area
   ======================================== */

.controlsCard__inputArea {
  padding: 12px 20px 20px;
  flex-shrink: 0;
}

.controlsCard__inputWrapper {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 22px;
  padding: 5px 5px 5px 18px;
  border: 0.5px solid rgba(255, 255, 255, 0.04);
  transition: all 0.25s ease;
}

.controlsCard__inputWrapper:focus-within {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 0 0 3px rgba(72, 219, 251, 0.06);
}

.controlsCard__input {
  flex: 1;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.85);
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif;
  font-size: 0.76em;
  padding: 7px 0;
  resize: none;
  outline: none;
  min-height: 1.4em;
  max-height: 5em;
  line-height: 1.4;
}

.controlsCard__input::placeholder {
  color: rgba(255, 255, 255, 0.2);
}

.controlsCard__sendBtn {
  background: linear-gradient(135deg, #48dbfb, #54a0ff);
  color: #fff;
  border: none;
  cursor: pointer;
  width: 34px;
  height: 34px;
  border-radius: 17px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75em;
  font-weight: 700;
  flex-shrink: 0;
  transition: all 0.2s cubic-bezier(0.22, 0.8, 0.25, 1);
  box-shadow: 0 2px 10px rgba(72, 219, 251, 0.2);
}

.controlsCard__sendBtn:hover:not(:disabled) {
  transform: scale(1.06);
  box-shadow: 0 4px 18px rgba(72, 219, 251, 0.35);
}

.controlsCard__sendBtn:active:not(:disabled) {
  transform: scale(0.93);
  transition: transform 0.1s ease;
}

.controlsCard__sendBtn:disabled {
  opacity: 0.2;
  cursor: not-allowed;
}

/* ========================================
   Error
   ======================================== */

.controlsCard__error {
  font-size: 0.55em;
  color: #ff6b6b;
  padding: 6px 20px 4px;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif;
  font-weight: 500;
  opacity: 0.8;
}
```

- [ ] **Step 5: Keep overlay styles**

Keep the existing `.panel__overlay` styles (lines 332–345) unchanged.

- [ ] **Step 6: Delete all old panel content styles**

Remove the old `.panel__header`, `.panel__messages`, `.panel__inputArea`, `.panel__sendBtn`, `.panel__input`, `.panel__inputWrapper`, `.panel__empty`, `.panel__emptyIcon`, `.panel__emptyText`, `.panel__title`, `.panel__actions`, `.panel__actionBtn`, `.panel__error` style blocks (lines 121–326).

---

### Task 2: Restructure TSX Markup

**Files:**

- Modify: `src/components/ai/ChatPanel.tsx`

- [ ] **Step 1: Replace the rainbow edge markup**

Replace lines 46–47 (the old `.rainbowEdge` and `.rainbowGlow` divs) with the new border:

```tsx
{
  /* Rainbow ripple border — 4 edges, right-to-left cascade */
}
<div className={`${styles.rainbowBorder} ${state.isOpen ? styles['rainbowBorder--visible'] : ''}`}>
  <div className={`${styles.rainbowBorder__edge} ${styles['rainbowBorder__edge--right']}`} />
  <div className={`${styles.rainbowBorder__edge} ${styles['rainbowBorder__edge--top']}`} />
  <div className={`${styles.rainbowBorder__edge} ${styles['rainbowBorder__edge--bottom']}`} />
  <div className={`${styles.rainbowBorder__edge} ${styles['rainbowBorder__edge--left']}`} />
</div>;
```

- [ ] **Step 2: Keep `.panel` as background-only, remove all content from it**

Replace the `.panel` div (lines 53–116) to be empty — just the background layer:

```tsx
{
  /* Background layer — gradient blur only */
}
<div className={`${styles.panel} ${state.isOpen ? styles['panel--open'] : ''}`} />;
```

- [ ] **Step 3: Add `.controlsCard` with all content**

Insert the controls card after the background panel:

```tsx
{
  /* Controls card — Gaussian blur, right-aligned */
}
<div className={`${styles.controlsCard} ${state.isOpen ? styles['controlsCard--open'] : ''}`}>
  <div className={styles.controlsCard__header}>
    <span className={styles.controlsCard__title}>{t('ai.title')}</span>
    <div className={styles.controlsCard__actions}>
      <button className={styles.controlsCard__actionBtn} onClick={clearMessages} title={t('ai.clear')}>
        {t('ai.clear')}
      </button>
      <button className={styles.controlsCard__actionBtn} onClick={handleOpenSettings} title={t('ai.settings')}>
        {t('ai.settings')}
      </button>
      <button className={styles.controlsCard__actionBtn} onClick={handleClose} title={t('ai.close')}>
        {t('ai.close')}
      </button>
    </div>
  </div>

  <div className={styles.controlsCard__messages}>
    {state.messages.length === 0 && (
      <div className={styles.controlsCard__empty}>
        <div className={styles.controlsCard__emptyIcon}>AI</div>
        <div className={styles.controlsCard__emptyText}>
          {t('ai.empty.line1')}
          <br />
          {t('ai.empty.line2')}
        </div>
      </div>
    )}
    {state.messages.map((msg) => (
      <ChatMessage
        key={msg.id}
        message={msg}
        tasks={state.tasks}
        onConfirm={confirmTask}
        onCancel={cancelTask}
        onRetry={retryTask}
      />
    ))}
    <div ref={messagesEndRef} />
  </div>

  {state.error && <div className={styles.controlsCard__error}>{state.error}</div>}

  <div className={styles.controlsCard__inputArea}>
    <div className={styles.controlsCard__inputWrapper}>
      <textarea
        ref={textareaRef}
        className={styles.controlsCard__input}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={state.config.enabled ? t('ai.placeholder.enabled') : t('ai.placeholder.disabled')}
        disabled={state.isLoading || !state.config.enabled}
        rows={1}
      />
      <button
        className={styles.controlsCard__sendBtn}
        onClick={handleSend}
        disabled={state.isLoading || !input.trim() || !state.config.enabled}
      >
        {t('ai.send')}
      </button>
    </div>
  </div>
</div>;
```

---

### Task 3: Verify Build

**Files:**

- (none modified)

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors (or only pre-existing errors unrelated to these changes).

- [ ] **Step 2: Verify CSS builds**

```bash
pnpm build 2>&1 | tail -5
```

Expected: Build succeeds.

---

### Task 4: Commit

- [ ] **Step 1: Stage and commit**

```bash
git add src/components/ai/ChatPanel.tsx src/components/ai/ChatPanel.module.css
git commit -m "feat: refine AI chat panel with layered blur and rainbow ripple border"
```
