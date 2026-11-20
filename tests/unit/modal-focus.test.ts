/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import {
  focusFirstElement,
  getFocusableElements,
  trapTabKey,
} from "@/lib/modal-focus";

describe("modal-focus", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("lists visible focusable controls and skips display-none ones", () => {
    document.body.innerHTML = `
      <div id="root">
        <button type="button" id="a">A</button>
        <input type="file" class="hidden" id="file" style="display:none" />
        <button type="button" id="b" disabled>B</button>
        <button type="button" id="c">C</button>
      </div>
    `;
    const root = document.getElementById("root")!;
    const ids = getFocusableElements(root).map((el) => el.id);
    expect(ids).toEqual(["a", "c"]);
  });

  it("focuses the first focusable control", () => {
    document.body.innerHTML = `
      <div id="root">
        <button type="button" id="a">A</button>
        <button type="button" id="b">B</button>
      </div>
    `;
    const root = document.getElementById("root")!;
    focusFirstElement(root);
    expect(document.activeElement?.id).toBe("a");
  });

  it("cycles Tab from last to first and Shift+Tab from first to last", () => {
    document.body.innerHTML = `
      <div id="root">
        <button type="button" id="a">A</button>
        <button type="button" id="b">B</button>
      </div>
    `;
    const root = document.getElementById("root")!;
    const a = document.getElementById("a")!;
    const b = document.getElementById("b")!;
    b.focus();

    const tab = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    expect(trapTabKey(tab, root)).toBe(true);
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(a);

    a.focus();
    const shiftTab = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    expect(trapTabKey(shiftTab, root)).toBe(true);
    expect(shiftTab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(b);
  });
});
