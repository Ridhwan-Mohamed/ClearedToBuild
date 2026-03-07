// UI/TeamNameInput.js
//
// Mobile + PC friendly team-name entry using Phaser DOM Element.
// Works in desktop and brings up soft keyboard on mobile.

export class TeamNameInput {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} opts { x, y, width, placeholder, initialValue, onChange }
   */
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.onChange = opts.onChange ?? (() => {});

    const width = opts.width ?? 220;

    const html = `
      <div style="display:flex; flex-direction:column; gap:6px; align-items:stretch;">
        <input
          type="text"
          maxlength="24"
          autocapitalize="words"
          autocomplete="off"
          spellcheck="false"
          placeholder="${(opts.placeholder ?? "Team name").replaceAll('"', '&quot;')}"
          value="${(opts.initialValue ?? "").replaceAll('"', '&quot;')}"
          style="
            width:${width}px;
            padding:6px 10px;
            font-size:14px;
            font-family:monospace;
            border-radius:8px;
            border:none;
            box-shadow:none;
            -webkit-appearance:none;
            appearance:none;
            background:rgba(20,20,20,0.9);
            color:white;
            outline:none;
            caret-color:white;
          "
        />
      </div>
    `;

    this.dom = scene.add.dom(opts.x ?? 0, opts.y ?? 0).createFromHTML(html);
    this.dom.setScrollFactor(0).setDepth(100000);

    const input = this.dom.node.querySelector("input");
    input.addEventListener("input", () => {
      const v = input.value ?? "";
      this.onChange(v);
    });

    // Enter to blur (desktop)
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") input.blur();
    });

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

  setValue(v) {
    const input = this.dom.node.querySelector("input");
    input.value = v ?? "";
  }

  destroy() {
    if (this._outsidePointerHandler) {
      this.scene?.input?.off?.("pointerdown", this._outsidePointerHandler);
      this._outsidePointerHandler = null;
    }
    this.dom?.destroy();
  }
}
