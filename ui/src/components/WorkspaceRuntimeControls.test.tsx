// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceRuntimeControls } from "./WorkspaceRuntimeControls";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("WorkspaceRuntimeControls", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("only shows start when services are not running", () => {
    const root = createRoot(container);

    act(() => {
      root.render(<WorkspaceRuntimeControls isRunning={false} canStart onAction={vi.fn()} />);
    });

    const buttons = Array.from(container.querySelectorAll("button")).map((button) => button.textContent?.trim());
    expect(buttons).toEqual(["Start"]);
  });

  it("shows stop and restart when services are already running", () => {
    const root = createRoot(container);

    act(() => {
      root.render(<WorkspaceRuntimeControls isRunning canStart onAction={vi.fn()} />);
    });

    const buttons = Array.from(container.querySelectorAll("button")).map((button) => button.textContent?.trim());
    expect(buttons).toEqual(["Stop", "Restart"]);
  });

  it("keeps start visible but disabled when runtime prerequisites are missing", () => {
    const root = createRoot(container);

    act(() => {
      root.render(
        <WorkspaceRuntimeControls
          isRunning={false}
          canStart={false}
          disabledHint="Add runtime settings first."
          onAction={vi.fn()}
        />,
      );
    });

    const startButton = container.querySelector("button");
    expect(startButton?.textContent?.trim()).toBe("Start");
    expect(startButton?.hasAttribute("disabled")).toBe(true);
    expect(container.textContent).toContain("Add runtime settings first.");
  });
});
