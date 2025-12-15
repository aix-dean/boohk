"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { X } from "lucide-react"

export default function IntegrationPage() {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900 mb-4 sm:mb-0">Integration</h1>
          <button onClick={() => setIsOpen(true)} style={{ color: 'var(--Color, #FFF)', textAlign: 'center', fontFamily: 'Inter', fontSize: '12px', fontStyle: 'normal', fontWeight: '700', lineHeight: '100%', width: '90px', height: '24px', flexShrink: '0', borderRadius: '6.024px', background: 'var(--DARK-BLUEEE, #1D0BEB)', marginLeft: '16px' }}>
            Contact Us
          </button>
        </div>
        <p className="text-base sm:text-lg mb-8">Connect your system with the tools and platforms you already use.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-6 mt-8 sm:mt-12">
          <img src="/integration-1.png" className="h-[60px] sm:h-[93px] w-auto object-contain justify-self-center sm:justify-self-start" alt="Integration 1" />
          <img src="/integration-2.png" className="h-[60px] sm:h-[94px] w-auto object-contain justify-self-center sm:justify-self-start" alt="Integration 2" />
          <img src="/integration-3.png" className="h-[40px] sm:h-[55px] w-auto object-contain justify-self-center sm:justify-self-start" alt="Integration 3" />
        </div>
        <div className="mt-12 sm:mt-16">
          <h2 style={{ color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '16px', fontStyle: 'normal', fontWeight: '700', lineHeight: '100%', marginBottom: '16px' }}>Ongoing</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-6">
            <img src="/integration-4.png" className="h-[50px] sm:h-[69px] w-auto object-contain justify-self-center sm:justify-self-start" alt="Integration 4" />
            <img src="/integration-5.png" className="h-[70px] sm:h-[105px] w-auto object-contain justify-self-center sm:justify-self-start" alt="Integration 5" />
          </div>
        </div>
      </div>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent style={{ width: '338px', height: '250px', flexShrink: 0, borderRadius: '10px', background: '#FFF' }}>
          <button onClick={() => setIsOpen(false)} className="absolute top-2 right-2">
            <X className="w-4 h-4" />
          </button>
          <DialogTitle style={{ color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '22px', fontStyle: 'normal', fontWeight: '700', lineHeight: '100%' /* 22px */ }}>
            Contact us!
          </DialogTitle>
          <div className="flex items-center mt-4">
            <img src="/contact-viber.png" alt="Viber" className="w-6 h-6 mr-2" />
            <div style={{ color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '12px', fontStyle: 'normal', fontWeight: '600', lineHeight: '250%' }}>+639171086403</div>
          </div>
          <div className="flex items-center mt-2">
            <img src="/contact-email.png" alt="Email" className="w-6 h-6 mr-2" />
            <div style={{ color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '12px', fontStyle: 'normal', fontWeight: '600', lineHeight: '250%' }}>boohk.oohpartners@aix.ph</div>
          </div>
          <div className="flex items-center mt-2">
            <img src="/contact-fb.png" alt="Facebook" className="w-6 h-6 mr-2" />
            <a href="https://www.facebook.com/people/Boohk/61583288166661/" target="_blank" className="underline" style={{ color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '12px', fontStyle: 'normal', fontWeight: '600', lineHeight: '250%' }}>Facebook</a>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}