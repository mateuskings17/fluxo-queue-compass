import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { issue, error } = vi.hoisted(() => ({ issue: vi.fn(), error: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  Link: () => null,
}));
vi.mock("@tanstack/react-query", () => ({
  useSuspenseQuery: () => ({ data: {
    settings: { unit_name: "Unidade de teste", totem_title: "Retire sua senha" },
    ticketTypes: [{ id: "normal", active: true, name: "Normal", prefix: "A" }],
  } }),
}));
vi.mock("@/lib/queue", () => ({ configQuery: {}, issueTicket: issue }));
vi.mock("@/hooks/use-realtime", () => ({ useConfigRealtime: () => {} }));
vi.mock("@/components/queue/Brand", () => ({ UnitLogo: () => null }));
vi.mock("@/components/queue/Clock", () => ({ Clock: () => null }));
vi.mock("sonner", () => ({ toast: { error } }));

import { Route } from "@/routes/totem";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });

function openTotem() {
  const Component = Route.options.component;
  if (!Component) throw new Error("Totem component missing");
  render(<Component />);
}

describe("Automatic receipt printing", () => {
  it("prints once immediately after issuance with the issued receipt already mounted", async () => {
    issue.mockResolvedValue({ id: "test-ticket", code: "A027", type_name: "Normal", created_at: "2026-11-16T10:25:00Z" });
    const print = vi.spyOn(window, "print").mockImplementation(() => {
      expect(document.querySelector("body > .print-ticket")?.textContent).toContain("A027");
    });
    openTotem();
    fireEvent.click(screen.getByRole("button", { name: /Normal/ }));
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    expect(issue).toHaveBeenCalledWith("normal");
    fireEvent.click(screen.getByRole("button", { name: "Imprimir novamente" }));
    expect(print).toHaveBeenCalledTimes(2);
    expect(issue).toHaveBeenCalledTimes(1);
  });

  it("does not print when ticket issuance fails", async () => {
    issue.mockRejectedValue(new Error("Falha de emissão"));
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    openTotem();
    fireEvent.click(screen.getByRole("button", { name: /Normal/ }));
    await waitFor(() => expect(error).toHaveBeenCalled());
    expect(print).not.toHaveBeenCalled();
  });
});