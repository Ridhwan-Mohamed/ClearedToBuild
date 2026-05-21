// UI/TeamNameInput.js
//
// Mobile + PC friendly team-name entry using Phaser DOM Element.
// Works in desktop and brings up soft keyboard on mobile.
import { BODY_FONT_FAMILY } from "../Typography.js";

export class TeamNameInput {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} opts { x, y, width, placeholder, initialValue, onChange }
   */
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.onChange = opts.onChange ?? (() => {});
    this.onType = opts.onType ?? (() => {});

    const width = opts.width ?? 220;
    const wrapperStyle = opts.wrapperStyle ?? "display:flex; flex-direction:column; gap:6px; align-items:stretch;";
    const inputClassName = String(opts.inputClassName ?? "").trim();
    const inputStyle = opts.inputStyle ?? `
            width:${width}px;
            padding:6px 10px;
            font-size:14px;
            font-family:${BODY_FONT_FAMILY};
            font-weight:600;
            border-radius:8px;
            border:none;
            box-shadow:none;
            -webkit-appearance:none;
            appearance:none;
            background:rgba(20,20,20,0.9);
            color:white;
            outline:none;
            caret-color:white;
          `;

    const html = `
      <div style="${wrapperStyle}">
        <input
          class="${inputClassName.replaceAll('"', '&quot;')}"
          type="text"
          maxlength="24"
          autocapitalize="words"
          autocomplete="off"
          spellcheck="false"
          placeholder="${(opts.placeholder ?? "Team name").replaceAll('"', '&quot;')}"
          value="${(opts.initialValue ?? "").replaceAll('"', '&quot;')}"
          style="${inputStyle}"
        />
      </div>
    `;

    this.dom = scene.add.dom(opts.x ?? 0, opts.y ?? 0).createFromHTML(html);
    this.dom.setScrollFactor(0).setDepth(100000);

    const input = this.dom.node.querySelector("input");
    this.input = input;
    if (inputClassName && input) {
      input.className = inputClassName;
    }
    if (input && typeof inputStyle === "string" && inputStyle.trim()) {
      input.style.cssText = inputStyle;
    }
    if (input && typeof opts.extraCss === "string" && opts.extraCss.trim()) {
      TeamNameInput._ensureStyleTag(
        opts.styleTagId ?? "draft-start-team-name-input-style",
        opts.extraCss,
      );
    }
    if (input) {
      const enforceRuntimeTextStyle = () => {
        input.style.fontFamily = '"Bungee", cursive';
        input.style.fontWeight = "400";
        input.style.setProperty("-webkit-text-fill-color", input.style.color || "#050b10");
      };
      enforceRuntimeTextStyle();
      if (typeof document !== "undefined" && document.fonts?.load) {
        document.fonts.load(`${Math.max(14, Number(opts.fontLoadSizePx) || 16)}px Bungee`).then(() => {
          enforceRuntimeTextStyle();
        }).catch(() => {});
      }
    }
    this._lastValue = String(input?.value ?? opts.initialValue ?? "");
    input.addEventListener("input", () => {
      const v = input.value ?? "";
      const previousValue = this._lastValue ?? "";
      const nextLength = Array.from(v).length;
      const previousLength = Array.from(previousValue).length;
      const addedCount = Math.max(0, nextLength - previousLength);
      const removedCount = Math.max(0, previousLength - nextLength);
      if (addedCount > 0 || removedCount > 0) {
        this.onType({
          value: v,
          previousValue,
          addedCount,
          removedCount,
          changedCount: addedCount + removedCount,
        });
      }
      this._lastValue = v;
      this.onChange(v);
    });

    // Enter to blur (desktop)
    input.addEventListener("keydown", (e) => {
      // Prevent Phaser/global hotkeys from firing while typing.
      e.stopPropagation();
      if (e.key === "Enter") input.blur();
    });
    input.addEventListener("keyup", (e) => e.stopPropagation());
    input.addEventListener("keypress", (e) => e.stopPropagation());

    // Clicking outside should blur (better on mobile)
    // Use DOM bounding rect (DOMElement doesn't always have getBounds())
    this._outsidePointerHandler = (pointer) => {
      const e = pointer?.event;
      if (!e) return;

      const rect = this.dom?.node?.getBoundingClientRect?.();
      if (!rect) return;

      const x = e.clientX;
      const y = e.clientY;

      const inside =
        x >= rect.left && x <= rect.right &&
        y >= rect.top && y <= rect.bottom;

      if (!inside) input.blur();
    };
    scene.input.on("pointerdown", this._outsidePointerHandler);
  }

  getInputElement() {
    return this.input ?? this.dom?.node?.querySelector?.("input") ?? null;
  }

  setValue(v) {
    const input = this.getInputElement();
    const nextValue = v ?? "";
    if (input) input.value = nextValue;
    this._lastValue = String(nextValue);
  }

  focus() {
    this.getInputElement()?.focus?.();
  }

  static _ensureStyleTag(id, cssText) {
    if (typeof document === "undefined" || !id || !cssText) return;
    let styleTag = document.getElementById(id);
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = id;
      document.head?.appendChild(styleTag);
    }
    styleTag.textContent = cssText;
  }

  destroy() {
    if (this._outsidePointerHandler) {
      this.scene?.input?.off?.("pointerdown", this._outsidePointerHandler);
      this._outsidePointerHandler = null;
    }
    this.input = null;
    this._lastValue = "";
    this.dom?.destroy();
  }
}
