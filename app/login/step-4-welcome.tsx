import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { useState, useEffect } from "react"

interface Step4WelcomeProps {
  onNext: (permissions: string[], roles: string[]) => void
}

export default function Step4Welcome({ onNext }: Step4WelcomeProps) {
  const [uploadInventory, setUploadInventory] = useState(false)
  const [setupCompany, setSetupCompany] = useState(false)
  const [teammatesWillHandle, setTeammatesWillHandle] = useState(false)

  // Validation logic: Next button is enabled if at least one option is selected
  const isNextEnabled = uploadInventory || setupCompany || teammatesWillHandle

  // Update validation state whenever switches or checkbox change
  useEffect(() => {
    console.log('Step 4 validation state:', {
      uploadInventory,
      setupCompany,
      teammatesWillHandle,
      isNextEnabled
    })
  }, [uploadInventory, setupCompany, teammatesWillHandle, isNextEnabled])

  // Generate permissions and roles arrays based on selections
  const getPermissions = () => {
    const permissions: string[] = ['it']  // Always include IT permission
    if (uploadInventory) permissions.push('business_dev')
    if (setupCompany) permissions.push('admin')
    return permissions
  }

  const getRoles = () => {
    const roles: string[] = ['it']  // Always include IT role
    if (uploadInventory) roles.push('business')
    if (setupCompany) roles.push('admin')
    return roles
  }

  // Handle next button click
  const handleNext = () => {
    const permissions = getPermissions()
    const roles = getRoles()
    console.log('Step 4 permissions:', permissions)
    console.log('Step 4 roles:', roles)
    onNext(permissions, roles)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="max-w-7xl w-full flex items-center gap-20">
        {/* Left side - Illustration */}
        <div className="flex-1 flex justify-center">
          <div className="relative w-[500px] h-[500px] rounded-full overflow-hidden">
            <img
              src="/login-image-6.png"
              alt="Welcome illustration"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Right side - Content */}
        <div className="flex-1 max-w-lg space-y-8">
          {/* User icon image */}
          <div className="flex justify-start">
            <img
              src="/login-image-7.png"
              alt="User icon"
              className="w-16 h-16 rounded-full"
            />
          </div>

          {/* Main heading */}
          <h1 className="text-5xl font-bold text-foreground leading-tight">
            Welcome aboard!
          </h1>

          {/* Description text */}
          <div className="space-y-5 text-muted-foreground leading-relaxed text-lg">
            <p>
              Since you're the first one here, your mission is to{" "}
              <span className="font-semibold text-foreground">bring your teammates on board</span> this adventure.
            </p>
            <p>But before that, do you have other tasks that you wish to accomplish?</p>
          </div>

          {/* Switch buttons */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Switch
                  checked={uploadInventory}
                  onCheckedChange={setUploadInventory}
                />
                <img
                  src="/login-setup-company.png"
                  alt="Upload Inventory"
                  className="w-8 h-8 mx-3"
                />
                <span className="text-foreground font-medium">Upload Inventory</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Switch
                  checked={setupCompany}
                  onCheckedChange={setSetupCompany}
                />
                <img
                  src="/login-upload-inventory.png"
                  alt="Setup Company"
                  className="w-8 h-8 mx-3"
                />
                <span className="text-foreground font-medium">Setup Company</span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-300 my-6"></div>

          {/* Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="teammates-handle"
              checked={teammatesWillHandle}
              onCheckedChange={(checked) => setTeammatesWillHandle(checked === true)}
            />
            <label
              htmlFor="teammates-handle"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              My teammates will take care of this.
            </label>
          </div>

          {/* Next button */}
          <div className="pt-6 flex justify-end">
            <Button
              className={`px-8 py-4 rounded-lg font-medium text-lg flex items-center gap-3 ${
                isNextEnabled
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
              onClick={isNextEnabled ? handleNext : undefined}
              disabled={!isNextEnabled}
            >
              Next
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          </div>


        </div>
      </div>
    </div>
  )
}