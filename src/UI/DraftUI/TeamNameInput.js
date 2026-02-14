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

    const width = opts.width ?? 260;

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
            padding:10px 12px;
            font-size:16px;
            border-radius:10px;
            border:1px solid rgba(255,255,255,0.25);
            background:rgba(20,20,20,0.8);
            color:white;
            outline:none;
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
    scene.input.on("pointerdown", (pointer) => {
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
    });
  }

  setValue(v) {
    const input = this.dom.node.querySelector("input");
    input.value = v ?? "";
  }

  destroy() {
    this.dom?.destroy();
  }
}
