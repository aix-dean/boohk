"use client"

import { useState } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { X } from "lucide-react"

export default function IntegrationPage() {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Integration</h1>
          <button onClick={() => setIsOpen(true)} style={{ color: 'var(--Color, #FFF)', textAlign: 'center', fontFamily: 'Inter', fontSize: '12px', fontStyle: 'normal', fontWeight: '700', lineHeight: '100%', width: '90px', height: '24px', flexShrink: '0', borderRadius: '6.024px', background: 'var(--DARK-BLUEEE, #1D0BEB)', marginLeft: '16px' }}>
            Contact Us
          </button>
        </div>
        <p>Connect your system with the tools and platforms you already use.</p>
        <div className="flex justify-start mt-12">
          <img src="/integration-1.png" className="h-[93px]" alt="Integration 1" />
          <img src="/integration-2.png" className="h-[94px] pl-[45px]" alt="Integration 2" />
          <img src="/integration-3.png" className="h-[55px] pl-[45px]" alt="Integration 3" />
        </div>
        <div className="flex justify-start mt-12">
          <div style={{ color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '16px', fontStyle: 'normal', fontWeight: '700', lineHeight: '100%' }}>Ongoing</div>
        </div>
        <div className="flex justify-start items-center mt-3">
           <img src="/integration-4.png" className="h-[69px] ps-10 pl-[15px]" alt="Integration 4" />
           <img src="/integration-5.png" className="h-[105px] pl-[45px]" alt="Integration 5" />
        </div>
      </div>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent style={{ width: '338px', height: '250px', flexShrink: 0, borderRadius: '10px', background: '#FFF' }}>
          <button onClick={() => setIsOpen(false)} className="absolute top-2 right-2">
            <X className="w-4 h-4" />
          </button>
          <div style={{ color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '22px', fontStyle: 'normal', fontWeight: '700', lineHeight: '100%' /* 22px */ }}>
            Contact us!
          </div>
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