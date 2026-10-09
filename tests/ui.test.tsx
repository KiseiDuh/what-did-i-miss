import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "../src/App";

describe("UI State & Input Synchronization Tests", () => {
  it("renders sample template and runs analysis with source excerpts", async () => {
    render(<App />);

    // Click "Explore with a sample" in empty prompt
    const exploreButton = screen.getByRole("button", { name: /explore with a sample/i });
    fireEvent.click(exploreButton);

    // Verify textarea populated
    const textarea = screen.getByRole("textbox", { name: /conversation text/i }) as HTMLTextAreaElement;
    expect(textarea.value).toContain("Maya: We agreed to use React");

    // Click "Find what matters"
    const analyzeButton = screen.getByRole("button", { name: /find what matters/i });
    fireEvent.click(analyzeButton);

    // Wait for analysis results
    await waitFor(() => {
      expect(screen.getByText("Your briefing")).toBeDefined();
    });

    expect(screen.getByText("Signals worth your attention")).toBeDefined();

    // Verify verifiable source excerpts are rendered
    const sourceLabels = screen.getAllByText(/source message/i);
    expect(sourceLabels.length).toBeGreaterThan(0);
  });

  it("updates character counter and parsed message counter in real time", () => {
    render(<App />);

    const textarea = screen.getByRole("textbox", { name: /conversation text/i }) as HTMLTextAreaElement;

    // Type 2 messages
    const inputText = "Alice: Hello there.\nBob: I will review this tonight.";
    fireEvent.change(textarea, { target: { value: inputText } });

    // Verify exact character count matches textarea value length
    expect(screen.getByText(new RegExp(`${inputText.length.toLocaleString()}\\s+characters`, "i"))).toBeDefined();

    // Verify parsed message count matches parser output (2 messages)
    expect(screen.getByText(/2 messages/i)).toBeDefined();
  });

  it("clears stale results and stale success banner immediately when textarea is edited", async () => {
    render(<App />);

    // Load sample and run analysis
    fireEvent.click(screen.getByRole("button", { name: /explore with a sample/i }));
    fireEvent.click(screen.getByRole("button", { name: /find what matters/i }));

    await waitFor(() => {
      expect(screen.getByText("Your briefing")).toBeDefined();
    });

    // Verify success banner is present
    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.getByText(/analysis complete/i)).toBeDefined();

    // User edits the textarea
    const textarea = screen.getByRole("textbox", { name: /conversation text/i }) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Charlie: A new conversation started." } });

    // Verify stale results and stale success banner are cleared immediately
    expect(screen.queryByText("Your briefing")).toBeNull();
    expect(screen.queryByText(/analysis complete/i)).toBeNull();
  });

  it("persists completion state across filter changes", async () => {
    render(<App />);

    // Load sample and analyze
    fireEvent.click(screen.getByRole("button", { name: /explore with a sample/i }));
    fireEvent.click(screen.getByRole("button", { name: /find what matters/i }));

    await waitFor(() => {
      expect(screen.getByText("Your briefing")).toBeDefined();
    });

    // Find all check buttons
    const checkButtons = screen.getAllByRole("button", { name: /mark complete/i });
    expect(checkButtons.length).toBeGreaterThan(0);

    // Mark the first item complete
    fireEvent.click(checkButtons[0]);

    // Verify it is marked incomplete now (toggled)
    expect(screen.getByRole("button", { name: /mark incomplete/i })).toBeDefined();

    // Switch filter to "Decisions"
    const decisionsFilter = screen.getByRole("button", { name: /^decisions$/i });
    fireEvent.click(decisionsFilter);

    // Switch filter back to "All signals"
    const allSignalsFilter = screen.getByRole("button", { name: /^all signals$/i });
    fireEvent.click(allSignalsFilter);

    // Verify completion state persisted across filter switching
    const incompleteButton = screen.getByRole("button", { name: /mark incomplete/i });
    expect(incompleteButton).toBeDefined();
    expect(incompleteButton.classList.contains("checked")).toBe(true);
  });

  it("dismisses finding cards using React state without re-appearing on filter switch", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /explore with a sample/i }));
    fireEvent.click(screen.getByRole("button", { name: /find what matters/i }));

    await waitFor(() => {
      expect(screen.getByText("Your briefing")).toBeDefined();
    });

    const initialDismissButtons = screen.getAllByRole("button", { name: /dismiss signal/i });
    const initialCount = initialDismissButtons.length;
    expect(initialCount).toBeGreaterThan(0);

    // Dismiss the first finding card
    fireEvent.click(initialDismissButtons[0]);

    // Verify count decreased by 1
    const afterDismissButtons = screen.getAllByRole("button", { name: /dismiss signal/i });
    expect(afterDismissButtons.length).toBe(initialCount - 1);

    // Switch filters back and forth
    fireEvent.click(screen.getByRole("button", { name: /^action items$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^all signals$/i }));

    // Verify dismissed card did not reappear
    const persistedButtons = screen.getAllByRole("button", { name: /dismiss signal/i });
    expect(persistedButtons.length).toBe(initialCount - 1);
  });

  it("clears conversation and resets state when Clear is clicked", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /explore with a sample/i }));
    fireEvent.click(screen.getByRole("button", { name: /find what matters/i }));

    await waitFor(() => {
      expect(screen.getByText("Your briefing")).toBeDefined();
    });

    // Click "Clear"
    const clearButton = screen.getByRole("button", { name: /^clear$/i });
    fireEvent.click(clearButton);

    // Verify textarea is empty and briefing is cleared
    const textarea = screen.getByRole("textbox", { name: /conversation text/i }) as HTMLTextAreaElement;
    expect(textarea.value).toBe("");
    expect(screen.queryByText("Your briefing")).toBeNull();
  });

  it("displays validation error when analyzing empty or whitespace input", () => {
    render(<App />);

    // Click "Find what matters" with empty textarea
    const analyzeButton = screen.getByRole("button", { name: /find what matters/i });
    fireEvent.click(analyzeButton);

    // Verify error alert
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText(/please paste a conversation or upload a file first/i)).toBeDefined();
    expect(screen.queryByText("Your briefing")).toBeNull();

    // Type only whitespace
    const textarea = screen.getByRole("textbox", { name: /conversation text/i }) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "    \n\n   " } });
    fireEvent.click(analyzeButton);

    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.queryByText("Your briefing")).toBeNull();
  });
});
