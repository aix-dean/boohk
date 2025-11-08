"use client"

import React, { useState, useEffect } from 'react'
import { SquarePen } from 'lucide-react'
import SignatureEditDialog from '../../../components/SignatureEditDialog'
import { useAuth } from '../../../contexts/auth-context'
import { uploadSignature } from '../../../lib/signature-service'
import { serverTimestamp, Timestamp } from 'firebase/firestore'

export default function SignaturePage() {
  const { userData, updateUserData } = useAuth()
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentSignature, setCurrentSignature] = useState<string | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(false);

  useEffect(() => {
    if (userData?.signature?.url) {
      setCurrentSignature(userData.signature.url);
      setIsImageLoading(true);
      // Set a timeout to prevent infinite loading
      const timeout = setTimeout(() => {
        setIsImageLoading(false);
      }, 5000); // 5 second timeout

      return () => clearTimeout(timeout);
    } else {
      setCurrentSignature(null);
      setIsImageLoading(false);
    }
  }, [userData]);

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50 pt-16">
      <div className="flex justify-start mb-4">
        <h1 className="text-LIGHTER-BLACK text-base font-bold font-['Inter'] leading-none">Signature</h1>
      </div>
      <div className="flex justify-start">
        <div className="bg-white rounded-[20px] p-8 flex flex-col items-start gap-6 max-w-[1200px] w-full">
          <div className="flex justify-between items-start w-full">
            <div className="relative w-64 h-32 bg-white border border-dashed border-DARK-GRAY flex-shrink-0">
              {isImageLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              )}
              <img
                className={`w-full h-full object-contain ${isImageLoading ? 'hidden' : ''}`}
                src={currentSignature || "https://placehold.co/256x256"}
                onLoad={() => setIsImageLoading(false)}
                onError={() => setIsImageLoading(false)}
              />
            </div>
            <button
              className="mt-2 p-1 hover:bg-gray-100 rounded"
              onClick={() => setIsDialogOpen(true)}
              aria-label="Edit signature"
            >
              <SquarePen size={16} className="text-black" />
            </button>
          </div>
          {userData?.signature?.updated && (
             <div className="text-left">
               <span className="text-LIGHTER-BLACK text-xs font-bold font-['Inter'] leading-3">Last Updated:</span>
               <span className="text-LIGHTER-BLACK text-xs font-light font-['Inter'] leading-3">
                 {userData.signature.updated instanceof Timestamp
                   ? userData.signature.updated.toDate().toLocaleString()
                   : userData.signature.updated instanceof Date
                   ? userData.signature.updated.toLocaleString()
                   : new Date(userData.signature.updated).toLocaleString()}
               </span>
             </div>
           )}
        </div>
      </div>
      {isDialogOpen && (
        <SignatureEditDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          onSave={async (signatureData) => {
            try {
              // All signatures are now PNG, so always upload to storage
              const downloadURL = await uploadSignature(signatureData.data, userData!.uid);
              const signatureValue = downloadURL;

              setCurrentSignature(signatureValue);
              setIsDialogOpen(false);
              await updateUserData({
                signature: {
                  url: signatureValue,
                  updated: new Date(),
                  type: "png",
                },
              });
            } catch (error) {
              console.error('Error saving signature:', error);
              // Handle error appropriately, e.g., show a toast notification
            }
          }}
        />
      )}
    </div>
  )
}
