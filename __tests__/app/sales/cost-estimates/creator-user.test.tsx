import React from "react"
import { render, screen, waitFor, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { getUserById } from "@/lib/access-management-service"

// 🧩 Mock the module that the component’s useEffect calls
vi.mock("@/lib/access-management-service", () => ({
  getUserById: vi.fn(),
}))

// 🧰 Utility: flush pending Promises (microtasks)
const flushPromises = () => new Promise(res => setTimeout(res, 0))

// 🧱 Component under test (simulates your useEffect logic)
function TestCreatorComponent({ costEstimate }) {
  const [creatorUser, setCreatorUser] = React.useState(null)
  const [userSignatureUrl, setUserSignatureUrl] = React.useState(null)

  React.useEffect(() => {
    const fetchCreatorUser = async () => {
      if (!costEstimate?.created_by) return

      try {
        const creator = await getUserById(costEstimate.created_by)
        setCreatorUser(creator)
        setUserSignatureUrl(creator?.signature?.url || null)
      } catch (error) {
        console.error("Error fetching creator user:", error)
      }
    }

    fetchCreatorUser()
  }, [costEstimate?.created_by])

  return (
    <div>
      <p data-testid="creatorName">{creatorUser?.displayName || "No creator"}</p>
      <p data-testid="signatureUrl">{userSignatureUrl || "No signature"}</p>
    </div>
  )
}

// 🧪 Test suite
describe("useEffect - Creator User Fetch Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetches and sets creator user when quotation.created_by exists", async () => {
    getUserById.mockResolvedValueOnce({
      displayName: "John Doe",
      signature: { url: "https://example.com/signature.png" },
    })

    await act(async () => {
      render(<TestCreatorComponent costEstimate={{ created_by: "user123" }} />)
      await flushPromises()
    })

    await waitFor(() => {
      expect(screen.getByTestId("creatorName").textContent).toBe("John Doe")
      expect(screen.getByTestId("signatureUrl").textContent).toBe(
        "https://example.com/signature.png"
      )
    })

    expect(getUserById).toHaveBeenCalledWith("user123")
    expect(getUserById).toHaveBeenCalledTimes(1)
  })

  it("does not call getUserById when quotation.created_by is missing", async () => {
    await act(async () => {
      render(<TestCreatorComponent costEstimate={{}} />)
      await flushPromises()
    })

    expect(getUserById).not.toHaveBeenCalled()
    expect(screen.getByTestId("creatorName").textContent).toBe("No creator")
    expect(screen.getByTestId("signatureUrl").textContent).toBe("No signature")
  })

  it("handles fetch error gracefully", async () => {
    const error = new Error("Network error")
    getUserById.mockRejectedValueOnce(error)

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    await act(async () => {
      render(<TestCreatorComponent costEstimate={{ created_by: "user999" }} />)
      await flushPromises()
    })

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error fetching creator user:",
        error
      )
      expect(screen.getByTestId("creatorName").textContent).toBe("No creator")
      expect(screen.getByTestId("signatureUrl").textContent).toBe("No signature")
    })

    consoleSpy.mockRestore()
  })
})
