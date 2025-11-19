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
  const [handlePayments, setHandlePayments] = useState(false)
  const [animateIn, setAnimateIn] = useState(false)

  // Validation logic: Next button is enabled if at least one option is selected
  const isNextEnabled = uploadInventory || setupCompany || handlePayments

  // Update validation state whenever switches or checkbox change
  useEffect(() => {
    console.log('Step 4 validation state:', {
      uploadInventory,
      setupCompany,
      handlePayments,
      isNextEnabled
    })
  }, [uploadInventory, setupCompany, handlePayments, isNextEnabled])

  // Trigger slide-in animation on mount
  useEffect(() => {
    setAnimateIn(true)
  }, [])

  // Generate permissions and roles arrays based on selections
  const getPermissions = () => {
    const permissions: string[] = ['it']  // Always include IT permission
    if (uploadInventory) permissions.push('business_dev')
    if (setupCompany) permissions.push('admin')
    if (handlePayments) permissions.push('accounting')
    return permissions
  }

  const getRoles = () => {
    const roles: string[] = ['it']  // Always include IT role
    if (uploadInventory) roles.push('business')
    if (setupCompany) roles.push('admin')
    if (handlePayments) roles.push('accounting')
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
    <div className={`min-h-screen bg-background flex items-center justify-center p-8 transition-transform duration-500 ease-in-out ${animateIn ? '' : 'translate-x-full'}`}>
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
        <div className="flex-1 max-w-lg ">
          {/* User icon image */}
          <div className="flex justify-start">
            <img
              src="/owen-face.png"
              alt="User icon"
              style={{  height: '51px', }}
            />
          </div>

          {/* Main heading */}
          <h1 style={{ color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '30px', fontStyle: 'normal', fontWeight: 700, lineHeight: '100%', paddingBottom: '10px', }}>
            Welcome aboard!
          </h1>

          {/* Description text */}
          <div className="space-y-5">
            <p style={{ color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '16px', fontStyle: 'normal', fontWeight: 300, lineHeight: '100%' }}>
              Since you're the first one here, your mission is to{" "}
              <span style={{ color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '16px', fontStyle: 'normal', fontWeight: 700, lineHeight: '100%' }}>setup the environment and bring your teammates on board</span>{" "}
              this adventure. 
              <br />
              <br />
              But before that, do you have other tasks that you wish to accomplish?
              <br />
              <br />
            </p>
          </div>

          {/* Switch buttons */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Switch

                  checked={uploadInventory}
                  onCheckedChange={setUploadInventory}
                />
                <img

                  src="/login-setup-company.png"
                  alt="Upload Inventory"
                  style={{ width: '14.463px', height: '14.463px', flexShrink: 0, aspectRatio: '14.46/14.46' }}
                />
                <span style={{ color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '16px', fontStyle: 'normal', fontWeight: 700, lineHeight: '100%' }}>Upload Inventory </span><span style={{ color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '16px', fontStyle: 'normal', fontWeight: 300, lineHeight: '100%' }}>(Business Dev.)</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Switch
                  checked={setupCompany}
                  onCheckedChange={setSetupCompany}
                />
                <img
                  src="/login-upload-inventory.png"
                  alt="Handle retail orders"
                  style={{ width: '14.463px', height: '14.463px', flexShrink: 0, aspectRatio: '14.46/14.46' }}
                />
                <span style={{ color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '16px', fontStyle: 'normal', fontWeight: 700, lineHeight: '100%' }}>Handle retail orders </span><span style={{ color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '16px', fontStyle: 'normal', fontWeight: 300, lineHeight: '100%' }}>(Sales)</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Switch
                  checked={handlePayments}
                  onCheckedChange={setHandlePayments}
                />
                <img
                  src="/login-upload-payments.svg"
                  alt="Handle payments"
                  style={{ width: '14.463px', height: '14.463px', flexShrink: 0, aspectRatio: '14.46/14.46' }}
                />
                <span style={{ color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '16px', fontStyle: 'normal', fontWeight: 700, lineHeight: '100%' }}>Handle payments </span><span style={{ color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '16px', fontStyle: 'normal', fontWeight: 300, lineHeight: '100%' }}>(Accounting)</span>
              </div>
            </div>
          </div>

          {/* Divider */}
          
          {/* Next button */}
          <div className="pt-6 flex justify-end">
            <Button
              className={`px-8 py-4 rounded-lg font-medium text-lg flex items-center gap-3 ${
                isNextEnabled
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
              style={{ width: '93.971px', height: '23.493px', flexShrink: 0, borderRadius: '6.024px', border: '1.205px solid var(--GREY, #C4C4C4)', background: '#FFF', color: 'var(--LIGHTER-BLACK, #333)', textAlign: 'center', fontFamily: 'Inter', fontSize: '12px', fontStyle: 'normal', fontWeight: 500, lineHeight: '100%' }}
              onClick={isNextEnabled ? handleNext : undefined}
              disabled={!isNextEnabled}
            >
              Skip
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