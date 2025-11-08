"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Upload, Download, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Progress } from "@/components/ui/progress"

export default function MigrationPage() {
  const { user, userData } = useAuth()
  const [uploadingStates, setUploadingStates] = useState<Record<string, boolean>>({})
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [uploadResults, setUploadResults] = useState<Record<string, { success: boolean; message: string; errors?: string[] }>>({})
  const [uploadErrors, setUploadErrors] = useState<Record<string, string[]>>({})
  // Removed showResultDialog and currentResult as they're no longer needed

  const handleDownloadTemplate = async (type: string) => {
    try {
      const response = await fetch(`/api/migration/generate-template?type=${type}`)
      if (!response.ok) {
        throw new Error('Failed to download template')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}-template.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading template:', error)
      alert('Failed to download template. Please try again.')
    }
  }

  const handleFileUpload = async (type: string, file: File) => {
    if (!user?.uid || !userData?.company_id) {
      alert('User information not available. Please log in again.')
      return
    }

    setUploadingStates(prev => ({ ...prev, [type]: true }))
    setUploadProgress(prev => ({ ...prev, [type]: 0 }))

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)
      formData.append('userId', user.uid)
      formData.append('companyId', userData.company_id)

      // Simulate progress (in a real app, you'd use XMLHttpRequest for actual progress tracking)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => ({
          ...prev,
          [type]: Math.min((prev[type] || 0) + 10, 90)
        }))
      }, 200)

      const response = await fetch('/api/migration/upload', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(prev => ({ ...prev, [type]: 100 }))

      const result = await response.json()

      if (response.ok) {
        // Check if there were any processing errors
        const hasErrors = result.errors && result.errors.length > 0
        setUploadResults(prev => ({
          ...prev,
          [type]: {
            success: !hasErrors, // Only consider successful if no errors
            message: hasErrors
              ? `Processed ${result.processedCount} records with ${result.errors.length} errors`
              : result.message,
            errors: result.errors
          }
        }))

        if (hasErrors) {
          setUploadErrors(prev => ({
            ...prev,
            [type]: getUserFriendlyRowErrors(result.errors)
          }))
        }
      } else {
        const userFriendlyMessage = getUserFriendlyErrorMessage(result.error || 'Upload failed')
        const userFriendlyErrors = result.errors ? getUserFriendlyRowErrors(result.errors) : []

        setUploadResults(prev => ({
          ...prev,
          [type]: {
            success: false,
            message: userFriendlyMessage,
            errors: userFriendlyErrors
          }
        }))

        setUploadErrors(prev => ({
          ...prev,
          [type]: userFriendlyErrors
        }))
      }
    } catch (error) {
      const userFriendlyMessage = getUserFriendlyErrorMessage(
        error instanceof Error ? error.message : 'Upload failed'
      )

      setUploadResults(prev => ({
        ...prev,
        [type]: {
          success: false,
          message: userFriendlyMessage
        }
      }))

      setUploadErrors(prev => ({
        ...prev,
        [type]: [userFriendlyMessage]
      }))
    } finally {
      setUploadingStates(prev => ({ ...prev, [type]: false }))
      setTimeout(() => {
        setUploadProgress(prev => ({ ...prev, [type]: 0 }))
      }, 1000)
    }
  }


  const handleFileInputChange = (type: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      handleFileUpload(type, file)
    }
    // Reset the input
    event.target.value = ''
  }

  const getUserFriendlyErrorMessage = (error: string): string => {
    // Convert technical errors to user-friendly messages
    if (error.includes('Failed to process the uploaded file')) {
      return 'The uploaded file could not be processed. Please check the file format and try again.'
    }
    if (error.includes('Invalid file type')) {
      return 'Please upload only Excel files (.xlsx or .xls).'
    }
    if (error.includes('empty')) {
      return 'The uploaded file appears to be empty. Please check your data and try again.'
    }
    if (error.includes('Missing required fields')) {
      return 'Some required information is missing from your file. Please check all columns are filled.'
    }
    if (error.includes('Row')) {
      return 'Some data in your file has issues. Please review and correct the highlighted rows.'
    }
    if (error.includes('auth') || error.includes('permission')) {
      return 'You don\'t have permission to perform this action. Please contact your administrator.'
    }
    if (error.includes('network') || error.includes('fetch')) {
      return 'Connection problem. Please check your internet connection and try again.'
    }

    // Default fallback
    return 'Something went wrong while processing your file. Please try again or contact support.'
  }

  const getUserFriendlyRowErrors = (errors: string[]): string[] => {
    return errors.map(error => {
      // If it's a specific validation error with data types, return it as-is
      if (error.match(/^Row \d+: .+ must be (text|number|email|JSON|valid JSON|comma-separated text)/)) {
        return error
      }

      // If it's a database save error, make it more user-friendly
      if (error.includes('Failed to save') && error.includes('data')) {
        const match = error.match(/Row \d+: Failed to save .+ data - (.+)/)
        if (match) {
          return `Row ${match[1]}: Database error - ${match[2]}`
        }
        return error.replace(/Failed to save .+ data/, 'Database error')
      }

      // If it's any row-specific error, return it as-is if it looks like a proper error message
      if (error.includes('Row') && (
        error.includes('must be') ||
        error.includes('Database error') ||
        error.includes('Invalid') ||
        error.includes('Required') ||
        error.includes('Missing')
      )) {
        return error
      }

      // For any other row-specific errors, try to extract and make user-friendly
      if (error.includes('Row')) {
        const match = error.match(/Row (\d+): (.+)/)
        if (match) {
          const rowNum = match[1]
          const errorMsg = match[2]
          // If the error message is already descriptive, keep it
          if (errorMsg.length > 10 && !errorMsg.includes('Unknown error')) {
            return `Row ${rowNum}: ${errorMsg}`
          }
          // Otherwise, make it user-friendly
          return `Row ${rowNum}: ${getUserFriendlyErrorMessage(errorMsg)}`
        }
      }

      // Fallback for non-row-specific errors
      return getUserFriendlyErrorMessage(error)
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Migration</h1>
        </div>

        {/* Header Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Company Details */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center relative">
                <div className="absolute inset-2 bg-blue-700 rounded">
                  <div className="grid grid-cols-3 gap-0.5 p-1">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="w-1 h-1 bg-white rounded-full" />
                    ))}
                  </div>
                </div>
                <div className="absolute bottom-1 left-2 right-2 h-1 bg-orange-400 rounded" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Company Details</h1>
              <p className="text-gray-600 text-sm">
                Quickly set up your company profile by filling out a few easy templates
              </p>
            </div>
          </div>

          {/* Transactions */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-16 h-16 rounded-full relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500">
                  <div className="absolute top-2 left-2 w-3 h-3 bg-white rounded opacity-80" />
                  <div className="absolute top-2 right-2 w-3 h-3 bg-green-400 rounded" />
                  <div className="absolute bottom-2 left-2 w-3 h-3 bg-yellow-400 rounded" />
                  <div className="absolute bottom-2 right-2 w-3 h-3 bg-orange-400 rounded" />
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded flex items-center justify-center">
                    <div className="w-2 h-2 bg-pink-500 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Transactions</h1>
              <p className="text-gray-600 text-sm">
                Quickly set up your company profile by filling out a few easy templates
              </p>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Company Data */}
            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <div className="flex gap-6">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Company Data</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Migrate your company's basic information needed for system setup.
                    </p>
                    <div className="flex gap-2 mb-4">
                      <Button
                        variant="outline"
                        className="bg-transparent"
                        onClick={() => handleDownloadTemplate('company-data')}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Template
                      </Button>
                      {uploadResults['company-data'] && (
                        uploadResults['company-data'].success ? (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm font-medium">Upload Successful</span>
                          </div>
                        ) : uploadResults['company-data'].errors && uploadResults['company-data'].errors.length > 0 ? (
                          <div className="flex items-center gap-2 text-yellow-600">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm font-medium">Partial Success</span>
                          </div>
                        ) : null
                      )}
                    </div>
                    {uploadingStates['company-data'] && (
                      <div className="space-y-2">
                        <Progress value={uploadProgress['company-data']} className="w-full" />
                        <p className="text-xs text-gray-500">Uploading...</p>
                      </div>
                    )}

                    {uploadErrors['company-data'] && uploadErrors['company-data'].length > 0 && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                        <div className="flex items-center gap-2 mb-2">
                          <XCircle className="w-4 h-4 text-red-600" />
                          <span className="text-sm font-medium text-red-800">Upload Failed</span>
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {uploadErrors['company-data'].map((error, index) => (
                            <p key={index} className="text-xs text-red-700">{error}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileInputChange('company-data')}
                      className="hidden"
                      id="company-data-upload"
                      disabled={uploadingStates['company-data']}
                    />
                    <label htmlFor="company-data-upload">
                      <div className="h-24 w-24 bg-gray-100 hover:bg-gray-200 text-gray-600 flex flex-col items-center justify-center gap-1 rounded-lg cursor-pointer disabled:opacity-50 transition-colors">
                        {uploadingStates['company-data'] ? (
                          <Loader2 className="w-7 h-7 animate-spin" />
                        ) : (
                          <Upload className="w-7 h-7" />
                        )}
                        <span className="text-xs text-center">
                          {uploadingStates['company-data'] ? 'Uploading' : 'Upload'}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Users */}
            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <div className="flex gap-6">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Users</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Migrate user information such as employee details, roles, access levels, and login credentials.
                    </p>
                    <div className="flex gap-2 mb-4">
                      <Button
                        variant="outline"
                        className="bg-transparent"
                        onClick={() => handleDownloadTemplate('users')}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Template
                      </Button>
                      {uploadResults['users'] && (
                        uploadResults['users'].success ? (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm font-medium">Upload Successful</span>
                          </div>
                        ) : uploadResults['users'].errors && uploadResults['users'].errors.length > 0 ? (
                          <div className="flex items-center gap-2 text-yellow-600">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm font-medium">Partial Success</span>
                          </div>
                        ) : null
                      )}
                    </div>
                    {uploadingStates['users'] && (
                      <div className="space-y-2">
                        <Progress value={uploadProgress['users']} className="w-full" />
                        <p className="text-xs text-gray-500">Uploading...</p>
                      </div>
                    )}

                    {uploadErrors['users'] && uploadErrors['users'].length > 0 && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                        <div className="flex items-center gap-2 mb-2">
                          <XCircle className="w-4 h-4 text-red-600" />
                          <span className="text-sm font-medium text-red-800">Upload Failed</span>
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {uploadErrors['users'].map((error, index) => (
                            <p key={index} className="text-xs text-red-700">{error}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileInputChange('users')}
                      className="hidden"
                      id="users-upload"
                      disabled={uploadingStates['users']}
                    />
                    <label htmlFor="users-upload">
                      <div className="h-24 w-24 bg-gray-100 hover:bg-gray-200 text-gray-600 flex flex-col items-center justify-center gap-1 rounded-lg cursor-pointer disabled:opacity-50 transition-colors">
                        {uploadingStates['users'] ? (
                          <Loader2 className="w-7 h-7 animate-spin" />
                        ) : (
                          <Upload className="w-7 h-7" />
                        )}
                        <span className="text-xs text-center">
                          {uploadingStates['users'] ? 'Uploading' : 'Upload'}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Inventory */}
            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <div className="flex gap-6">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Inventory</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Migrate your inventory to ensures accurate tracking, reporting, and smooth management.
                    </p>
                    <div className="flex gap-2 mb-4">
                      <Button
                        variant="outline"
                        className="bg-transparent"
                        onClick={() => handleDownloadTemplate('inventory')}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Template
                      </Button>
                      {uploadResults['inventory'] && (
                        uploadResults['inventory'].success ? (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm font-medium">Upload Successful</span>
                          </div>
                        ) : uploadResults['inventory'].errors && uploadResults['inventory'].errors.length > 0 ? (
                          <div className="flex items-center gap-2 text-yellow-600">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm font-medium">Partial Success</span>
                          </div>
                        ) : null
                      )}
                    </div>
                    {uploadingStates['inventory'] && (
                      <div className="space-y-2">
                        <Progress value={uploadProgress['inventory']} className="w-full" />
                        <p className="text-xs text-gray-500">Uploading...</p>
                      </div>
                    )}

                    {uploadErrors['inventory'] && uploadErrors['inventory'].length > 0 && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                        <div className="flex items-center gap-2 mb-2">
                          <XCircle className="w-4 h-4 text-red-600" />
                          <span className="text-sm font-medium text-red-800">Upload Failed</span>
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {uploadErrors['inventory'].map((error, index) => (
                            <p key={index} className="text-xs text-red-700">{error}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileInputChange('inventory')}
                      className="hidden"
                      id="inventory-upload"
                      disabled={uploadingStates['inventory']}
                    />
                    <label htmlFor="inventory-upload">
                      <div className="h-24 w-24 bg-gray-100 hover:bg-gray-200 text-gray-600 flex flex-col items-center justify-center gap-1 rounded-lg cursor-pointer disabled:opacity-50 transition-colors">
                        {uploadingStates['inventory'] ? (
                          <Loader2 className="w-7 h-7 animate-spin" />
                        ) : (
                          <Upload className="w-7 h-7" />
                        )}
                        <span className="text-xs text-center">
                          {uploadingStates['inventory'] ? 'Uploading' : 'Upload'}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Proposals */}
            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <div className="flex gap-6">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Proposals</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Migrate proposals shared with clients, outlining your company's offerings and scope.
                    </p>
                    <div className="flex gap-2 mb-4">
                      <Button
                        variant="outline"
                        className="bg-transparent"
                        onClick={() => handleDownloadTemplate('proposals')}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Template
                      </Button>
                      {uploadResults['proposals'] && (
                        uploadResults['proposals'].success ? (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm font-medium">Upload Successful</span>
                          </div>
                        ) : uploadResults['proposals'].errors && uploadResults['proposals'].errors.length > 0 ? (
                          <div className="flex items-center gap-2 text-yellow-600">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm font-medium">Partial Success</span>
                          </div>
                        ) : null
                      )}
                    </div>
                    {uploadingStates['proposals'] && (
                      <div className="space-y-2">
                        <Progress value={uploadProgress['proposals']} className="w-full" />
                        <p className="text-xs text-gray-500">Uploading...</p>
                      </div>
                    )}

                    {uploadErrors['proposals'] && uploadErrors['proposals'].length > 0 && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                        <div className="flex items-center gap-2 mb-2">
                          <XCircle className="w-4 h-4 text-red-600" />
                          <span className="text-sm font-medium text-red-800">Upload Failed</span>
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {uploadErrors['proposals'].map((error, index) => (
                            <p key={index} className="text-xs text-red-700">{error}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileInputChange('proposals')}
                      className="hidden"
                      id="proposals-upload"
                      disabled={uploadingStates['proposals']}
                    />
                    <label htmlFor="proposals-upload">
                      <div className="h-24 w-24 bg-gray-100 hover:bg-gray-200 text-gray-600 flex flex-col items-center justify-center gap-1 rounded-lg cursor-pointer disabled:opacity-50 transition-colors">
                        {uploadingStates['proposals'] ? (
                          <Loader2 className="w-7 h-7 animate-spin" />
                        ) : (
                          <Upload className="w-7 h-7" />
                        )}
                        <span className="text-xs text-center">
                          {uploadingStates['proposals'] ? 'Uploading' : 'Upload'}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cost Estimates */}
            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <div className="flex gap-6">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Cost Estimates</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Migrate cost estimates for projects or services, shared with clients.
                    </p>
                    <div className="flex gap-2 mb-4">
                      <Button
                        variant="outline"
                        className="bg-transparent"
                        onClick={() => handleDownloadTemplate('cost-estimates')}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Template
                      </Button>
                      {uploadResults['cost-estimates'] && (
                        uploadResults['cost-estimates'].success ? (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm font-medium">Upload Successful</span>
                          </div>
                        ) : uploadResults['cost-estimates'].errors && uploadResults['cost-estimates'].errors.length > 0 ? (
                          <div className="flex items-center gap-2 text-yellow-600">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm font-medium">Partial Success</span>
                          </div>
                        ) : null
                      )}
                    </div>
                    {uploadingStates['cost-estimates'] && (
                      <div className="space-y-2">
                        <Progress value={uploadProgress['cost-estimates']} className="w-full" />
                        <p className="text-xs text-gray-500">Uploading...</p>
                      </div>
                    )}

                    {uploadErrors['cost-estimates'] && uploadErrors['cost-estimates'].length > 0 && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                        <div className="flex items-center gap-2 mb-2">
                          <XCircle className="w-4 h-4 text-red-600" />
                          <span className="text-sm font-medium text-red-800">Upload Failed</span>
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {uploadErrors['cost-estimates'].map((error, index) => (
                            <p key={index} className="text-xs text-red-700">{error}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileInputChange('cost-estimates')}
                      className="hidden"
                      id="cost-estimates-upload"
                      disabled={uploadingStates['cost-estimates']}
                    />
                    <label htmlFor="cost-estimates-upload">
                      <div className="h-24 w-24 bg-gray-100 hover:bg-gray-200 text-gray-600 flex flex-col items-center justify-center gap-1 rounded-lg cursor-pointer disabled:opacity-50 transition-colors">
                        {uploadingStates['cost-estimates'] ? (
                          <Loader2 className="w-7 h-7 animate-spin" />
                        ) : (
                          <Upload className="w-7 h-7" />
                        )}
                        <span className="text-xs text-center">
                          {uploadingStates['cost-estimates'] ? 'Uploading' : 'Upload'}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quotations */}
            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <div className="flex gap-6">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Quotations</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Migrate quotations for projects or services, shared with clients.
                    </p>
                    <div className="flex gap-2 mb-4">
                      <Button
                        variant="outline"
                        className="bg-transparent"
                        onClick={() => handleDownloadTemplate('quotations')}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Template
                      </Button>
                      {uploadResults['quotations'] && (
                        uploadResults['quotations'].success ? (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm font-medium">Upload Successful</span>
                          </div>
                        ) : uploadResults['quotations'].errors && uploadResults['quotations'].errors.length > 0 ? (
                          <div className="flex items-center gap-2 text-yellow-600">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm font-medium">Partial Success</span>
                          </div>
                        ) : null
                      )}
                    </div>
                    {uploadingStates['quotations'] && (
                      <div className="space-y-2">
                        <Progress value={uploadProgress['quotations']} className="w-full" />
                        <p className="text-xs text-gray-500">Uploading...</p>
                      </div>
                    )}

                    {uploadErrors['quotations'] && uploadErrors['quotations'].length > 0 && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                        <div className="flex items-center gap-2 mb-2">
                          <XCircle className="w-4 h-4 text-red-600" />
                          <span className="text-sm font-medium text-red-800">Upload Failed</span>
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {uploadErrors['quotations'].map((error, index) => (
                            <p key={index} className="text-xs text-red-700">{error}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileInputChange('quotations')}
                      className="hidden"
                      id="quotations-upload"
                      disabled={uploadingStates['quotations']}
                    />
                    <label htmlFor="quotations-upload">
                      <div className="h-24 w-24 bg-gray-100 hover:bg-gray-200 text-gray-600 flex flex-col items-center justify-center gap-1 rounded-lg cursor-pointer disabled:opacity-50 transition-colors">
                        {uploadingStates['quotations'] ? (
                          <Loader2 className="w-7 h-7 animate-spin" />
                        ) : (
                          <Upload className="w-7 h-7" />
                        )}
                        <span className="text-xs text-center">
                          {uploadingStates['quotations'] ? 'Uploading' : 'Upload'}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contracts */}
            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <div className="flex gap-6">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Contracts</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Migrate contracts to ensure proper documentation and compliance.
                    </p>
                    <Button variant="outline" className="bg-transparent">
                      Download Template
                    </Button>
                  </div>
                  <div className="flex-shrink-0">
                    <Button className="h-24 w-24 bg-gray-100 hover:bg-gray-200 text-gray-600 flex flex-col items-center justify-center gap-1 rounded-lg">
                      <Upload className="w-7 h-7" />
                      <span className="text-xs">Upload</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Job Orders */}
            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <div className="flex gap-6">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Job Orders</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Migrate Job Orders to track history of approved work orders.
                    </p>
                    <div className="flex gap-2 mb-4">
                      <Button
                        variant="outline"
                        className="bg-transparent"
                        onClick={() => handleDownloadTemplate('job-orders')}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Template
                      </Button>
                      {uploadResults['job-orders'] && (
                        uploadResults['job-orders'].success ? (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm font-medium">Upload Successful</span>
                          </div>
                        ) : uploadResults['job-orders'].errors && uploadResults['job-orders'].errors.length > 0 ? (
                          <div className="flex items-center gap-2 text-yellow-600">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm font-medium">Partial Success</span>
                          </div>
                        ) : null
                      )}
                    </div>
                    {uploadingStates['job-orders'] && (
                      <div className="space-y-2">
                        <Progress value={uploadProgress['job-orders']} className="w-full" />
                        <p className="text-xs text-gray-500">Uploading...</p>
                      </div>
                    )}

                    {uploadErrors['job-orders'] && uploadErrors['job-orders'].length > 0 && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                        <div className="flex items-center gap-2 mb-2">
                          <XCircle className="w-4 h-4 text-red-600" />
                          <span className="text-sm font-medium text-red-800">Upload Failed</span>
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {uploadErrors['job-orders'].map((error, index) => (
                            <p key={index} className="text-xs text-red-700">{error}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileInputChange('job-orders')}
                      className="hidden"
                      id="job-orders-upload"
                      disabled={uploadingStates['job-orders']}
                    />
                    <label htmlFor="job-orders-upload">
                      <div className="h-24 w-24 bg-gray-100 hover:bg-gray-200 text-gray-600 flex flex-col items-center justify-center gap-1 rounded-lg cursor-pointer disabled:opacity-50 transition-colors">
                        {uploadingStates['job-orders'] ? (
                          <Loader2 className="w-7 h-7 animate-spin" />
                        ) : (
                          <Upload className="w-7 h-7" />
                        )}
                        <span className="text-xs text-center">
                          {uploadingStates['job-orders'] ? 'Uploading' : 'Upload'}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Service Assignments */}
            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <div className="flex gap-6">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Service Assignments</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Migrate Service Assignments to track history of approved operation orders.
                    </p>
                    <div className="flex gap-2 mb-4">
                      <Button
                        variant="outline"
                        className="bg-transparent"
                        onClick={() => handleDownloadTemplate('service-assignments')}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Template
                      </Button>
                      {uploadResults['service-assignments'] && (
                        uploadResults['service-assignments'].success ? (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm font-medium">Upload Successful</span>
                          </div>
                        ) : uploadResults['service-assignments'].errors && uploadResults['service-assignments'].errors.length > 0 ? (
                          <div className="flex items-center gap-2 text-yellow-600">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm font-medium">Partial Success</span>
                          </div>
                        ) : null
                      )}
                    </div>
                    {uploadingStates['service-assignments'] && (
                      <div className="space-y-2">
                        <Progress value={uploadProgress['service-assignments']} className="w-full" />
                        <p className="text-xs text-gray-500">Uploading...</p>
                      </div>
                    )}

                    {uploadErrors['service-assignments'] && uploadErrors['service-assignments'].length > 0 && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                        <div className="flex items-center gap-2 mb-2">
                          <XCircle className="w-4 h-4 text-red-600" />
                          <span className="text-sm font-medium text-red-800">Upload Failed</span>
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {uploadErrors['service-assignments'].map((error, index) => (
                            <p key={index} className="text-xs text-red-700">{error}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileInputChange('service-assignments')}
                      className="hidden"
                      id="service-assignments-upload"
                      disabled={uploadingStates['service-assignments']}
                    />
                    <label htmlFor="service-assignments-upload">
                      <div className="h-24 w-24 bg-gray-100 hover:bg-gray-200 text-gray-600 flex flex-col items-center justify-center gap-1 rounded-lg cursor-pointer disabled:opacity-50 transition-colors">
                        {uploadingStates['service-assignments'] ? (
                          <Loader2 className="w-7 h-7 animate-spin" />
                        ) : (
                          <Upload className="w-7 h-7" />
                        )}
                        <span className="text-xs text-center">
                          {uploadingStates['service-assignments'] ? 'Uploading' : 'Upload'}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Invoice */}
            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <div className="flex gap-6">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Invoice</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Migrate billing records to ensure proper financial tracking.
                    </p>
                    <Button variant="outline" className="bg-transparent">
                      Download Template
                    </Button>
                  </div>
                  <div className="flex-shrink-0">
                    <Button className="h-24 w-24 bg-gray-100 hover:bg-gray-200 text-gray-600 flex flex-col items-center justify-center gap-1 rounded-lg">
                      <Upload className="w-7 h-7" />
                      <span className="text-xs">Upload</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* OR's */}
            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <div className="flex gap-6">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">OR's</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Migrate official receipts to ensure accurate financial documentation for your clients and your
                      company.
                    </p>
                    <Button variant="outline" className="bg-transparent">
                      Download Template
                    </Button>
                  </div>
                  <div className="flex-shrink-0">
                    <Button className="h-24 w-24 bg-gray-100 hover:bg-gray-200 text-gray-600 flex flex-col items-center justify-center gap-1 rounded-lg">
                      <Upload className="w-7 h-7" />
                      <span className="text-xs">Upload</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

    </div>
  )
}