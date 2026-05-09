'use client';

import { useState, useRef, useEffect, type RefObject } from 'react';
import { Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * A small popover emoji picker that inserts at the cursor position of
 * the bound textarea/input ref. We keep the dataset inline (no external
 * library) — covers the most common categories for Telegram channel posts.
 */

interface EmojiCategory {
  label: string;
  emojis: string[];
}

const CATEGORIES: EmojiCategory[] = [
  {
    label: 'Часто используемые',
    emojis: ['🔥', '👍', '❤️', '😂', '✨', '👀', '💯', '🎉', '⚡', '🚀', '✅', '❌', '⭐', '👇', '👆', '🤔'],
  },
  {
    label: 'Эмоции',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐'],
  },
  {
    label: 'Жесты',
    emojis: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '👐', '🤲', '🙏', '✍️', '💪', '🦵', '🦶', '👂', '👃', '🧠', '🦷', '🦴', '👀', '👁️', '👅', '👄'],
  },
  {
    label: 'Объекты',
    emojis: ['💼', '📱', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '💾', '💿', '📀', '📷', '📸', '📹', '🎥', '📞', '☎️', '📟', '📠', '📺', '📻', '⏰', '⏲️', '⏱️', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🧯', '🛒', '🎁', '🎈', '🎀', '🎊', '🎉', '🎂', '🎄'],
  },
  {
    label: 'Символы',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸'],
  },
  {
    label: 'Стрелки и навигация',
    emojis: ['👆', '👇', '👈', '👉', '☝️', '⬆️', '⬇️', '⬅️', '➡️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↩️', '↪️', '⤴️', '⤵️', '🔃', '🔄', '🔙', '🔚', '🔛', '🔜', '🔝', '▶️', '◀️', '🔼', '🔽', '⏩', '⏪', '⏫', '⏬', '➕', '➖', '➗', '✖️', '♾️', '💲', '💱', '™️', '©️', '®️'],
  },
];

interface EmojiPickerProps {
  /** Ref to the textarea/input where the emoji should be inserted. */
  targetRef: RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  /** Called after insertion so parent state can update. */
  onInsert?: (newValue: string) => void;
}

export function EmojiPicker({ targetRef, onInsert }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  function insertEmoji(emoji: string) {
    const el = targetRef.current;
    if (!el) {
      // Fall back to clipboard if no bound input
      navigator.clipboard.writeText(emoji);
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    const newValue = before + emoji + after;

    // Use the native setter so React's controlled-input picks up the change.
    const setter = Object.getOwnPropertyDescriptor(
      el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      'value'
    )?.set;
    setter?.call(el, newValue);
    el.dispatchEvent(new Event('input', { bubbles: true }));

    // Restore caret after the inserted emoji
    requestAnimationFrame(() => {
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
      el.focus();
    });

    onInsert?.(newValue);
  }

  return (
    <div className="relative inline-block">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="h-8 px-2"
        title="Эмодзи"
      >
        <Smile className="h-4 w-4" />
      </Button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute right-0 z-50 mt-1 w-80 rounded-md border bg-popover p-2 shadow-lg"
          role="dialog"
          aria-label="Выбор эмодзи"
        >
          {/* Category tabs */}
          <div className="mb-2 flex gap-1 overflow-x-auto border-b pb-2">
            {CATEGORIES.map((cat, i) => (
              <button
                key={cat.label}
                type="button"
                onClick={() => setActiveCategory(i)}
                className={`shrink-0 rounded px-2 py-1 text-xs ${
                  i === activeCategory
                    ? 'bg-accent font-medium'
                    : 'hover:bg-accent/50'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Emoji grid */}
          <div className="grid max-h-60 grid-cols-8 gap-1 overflow-y-auto">
            {CATEGORIES[activeCategory].emojis.map((emoji, i) => (
              <button
                key={`${emoji}-${i}`}
                type="button"
                onClick={() => insertEmoji(emoji)}
                className="flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-accent"
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>

          <p className="mt-2 border-t pt-2 text-[10px] text-muted-foreground">
            Клик вставит эмодзи в позицию курсора
          </p>
        </div>
      )}
    </div>
  );
}
