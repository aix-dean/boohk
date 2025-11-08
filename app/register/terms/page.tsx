"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"

export default function TermsPage() {
  const [hasReadTerms, setHasReadTerms] = useState(false)
  const [scrollAreaRef, setScrollAreaRef] = useState<HTMLDivElement | null>(null)
  const router = useRouter()

  // Scroll detection for terms agreement
  useEffect(() => {
    const handleScroll = () => {
      if (scrollAreaRef) {
        const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10 // 10px tolerance
        if (isAtBottom && !hasReadTerms) {
          setHasReadTerms(true)
        }
      }
    }

    if (scrollAreaRef) {
      scrollAreaRef.addEventListener('scroll', handleScroll)
      return () => scrollAreaRef.removeEventListener('scroll', handleScroll)
    }
  }, [scrollAreaRef, hasReadTerms])

  const handleAgree = () => {
    // Store agreement in localStorage or sessionStorage
    sessionStorage.setItem('termsAgreed', 'true')
    router.push('/register')
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Left Panel - Image */}
      <div className="relative hidden w-full items-center justify-center bg-gray-900 sm:flex lg:w-[40%]">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-purple-700 opacity-90"></div>
        <div className="relative z-10 text-center text-white p-8">
          <h1 className="text-4xl font-bold mb-4">Terms & Conditions</h1>
          <p className="text-lg">Please read carefully before proceeding</p>
        </div>
      </div>

      {/* Right Panel - Terms Content */}
      <div className="flex w-full items-center justify-center bg-white p-4 dark:bg-gray-950 sm:p-6 lg:w-[60%] lg:p-8">
        <Card className="w-full max-w-4xl border-none shadow-none">
          <CardHeader className="space-y-1">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/register')}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Registration</span>
              </Button>
            </div>
            <CardTitle className="text-2xl font-bold text-center">
              Terms and Conditions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Terms Content */}
              <div className="border rounded-md p-6 max-h-96 overflow-hidden">
                <ScrollArea
                  className="h-80 w-full"
                  ref={(el) => {
                    if (el && !scrollAreaRef) {
                      setScrollAreaRef(el.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement)
                    }
                  }}
                >
                  <div className="pr-4">
                    <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
                      {`# Terms and Conditions

Last updated: May 24, 2021

Please read these terms and conditions carefully before using Our Service.

## Interpretation and Definitions

### Interpretation
The words of which the initial letter is capitalized have meanings defined under the following conditions. The following definitions shall have the same meaning regardless of whether they appear in singular or in plural.

### Definitions
For the purposes of these Terms and Conditions:

- **Application** means the software program provided by the Company downloaded by You on any electronic device, named OH!Plus
- **Application Store** means the digital distribution service operated and developed by Apple Inc. (Apple App Store) or Google Inc. (Google Play Store) in which the Application has been downloaded.
- **Affiliate** means an entity that controls, is controlled by or is under common control with a party, where "control" means ownership of 50% or more of the shares, equity interest or other securities entitled to vote for election of directors or other managing authority.
- **Company** (referred to as either "the Company", "We", "Us" or "Our" in this Agreement) refers to AI Xyndicate, 727 Gawad Tulay Holdings Inc., Gen. Solano St., San Miguel, Manila.
- **Country** refers to: Philippines
- **Device** means any device that can access the Service such as a computer, a cellphone or a digital tablet.
- **Service** refers to the Application.
- **Terms and Conditions** (also referred as "Terms") mean these Terms and Conditions that form the entire agreement between You and the Company regarding the use of the Service.
- **Third-party Social Media Service** means any services or content (including data, information, products or services) provided by a third-party that may be displayed, included or made available by the Service.
- **You** means the individual accessing or using the Service, or the company, or other legal entity on behalf of which such individual is accessing or using the Service, as applicable.

## Acknowledgment

These are the Terms and Conditions governing the use of this Service and the agreement that operates between You and the Company. These Terms and Conditions set out the rights and obligations of all users regarding the use of the Service.

Your access to and use of the Service is conditioned on Your acceptance of and compliance with these Terms and Conditions. These Terms and Conditions apply to all visitors, users and others who access or use the Service.

By accessing or using the Service You agree to be bound by these Terms and Conditions. If You disagree with any part of these Terms and Conditions then You may not access the Service.

You represent that you are over the age of 18. The Company does not permit those under 18 to use the Service.

Your access to and use of the Service is also conditioned on Your acceptance of and compliance with the Privacy Policy of the Company. Our Privacy Policy describes Our policies and procedures on the collection, use and disclosure of Your personal information when You use the Application or the Website and tells You about Your privacy rights and how the law protects You. Please read Our Privacy Policy carefully before using Our Service.

## User Accounts

When You create an account with Us, You must provide information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of Your account on Our Service.

You are responsible for safeguarding the password that You use to access the Service and for any activities or actions under Your password, whether Your password is with Our Service or a Third-Party Social Media Service.

You agree not to disclose Your password to any third party. You must notify Us immediately upon becoming aware of any breach of security or unauthorized use of Your account.

You may not use as a username the name of another person or entity or that is not lawfully available for use, a name or trademark that is subject to any rights of another person or entity other than You without appropriate authorization, or a name that is otherwise offensive, vulgar or obscene.

## Content

### Your Right to Post Content
Our Service allows You to post Content. You are responsible for the Content that You post to the Service, including its legality, reliability, and appropriateness.

By posting Content to the Service, You grant Us the right and license to use, modify, publicly perform, publicly display, reproduce, and distribute such Content on and through the Service. You retain any and all of Your rights to any Content You submit, post or display on or through the Service and You are responsible for protecting those rights.

You represent and warrant that: (i) the Content is Yours (You own it) or You have the right to use it and grant Us the rights and license as provided in these Terms, and (ii) the posting of Your Content on or through the Service does not violate the privacy rights, publicity rights, copyrights, contract rights or any other rights of any person.

### Content Restrictions
The Company is not responsible for the content of the Service's users. You expressly understand and agree that You are solely responsible for the Content and for all activity that occurs under your account, whether done so by You or any third person using Your account.

You may not transmit any Content that is unlawful, offensive, upsetting, intended to disgust, threatening, libelous, defamatory, obscene or otherwise objectionable. Examples of such objectionable Content include, but are not limited to, the following:

- Unlawful or promoting unlawful activity.
- Defamatory, discriminatory, or mean-spirited content, including references or commentary about religion, race, sexual orientation, gender, national/ethnic origin, or other targeted groups.
- Spam, machine – or randomly – generated, constituting unauthorized or unsolicited advertising, chain letters, any other form of unauthorized solicitation, or any form of lottery or gambling.
- Containing or installing any viruses, worms, malware, trojan horses, or other content that is designed or intended to disrupt, damage, or limit the functioning of any software, hardware or telecommunications equipment or to damage or obtain unauthorized access to any data or other information of a third person.
- Infringing on any proprietary rights of any party, including patent, trademark, trade secret, copyright, right of publicity or other rights.

The Company reserves the right, but not the obligation, to, in its sole discretion, determine whether or not any Content is appropriate and complies with this Terms, refuse or remove this Content. The Company further reserves the right to make formatting and edits and change the manner any Content. The Company can also limit or revoke the use of the Service if You post such objectionable Content.

## Termination

We may terminate or suspend Your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if You breach these Terms and Conditions.

Upon termination, Your right to use the Service will cease immediately. If You wish to terminate Your account, You may simply discontinue using the Service.

## Limitation of Liability

Notwithstanding any damages that You might incur, the entire liability of the Company and any of its suppliers under any provision of this Terms and Your exclusive remedy for all of the foregoing shall be limited to the amount actually paid by You through the Service or 100 USD if You haven't purchased anything through the Service.

To the maximum extent permitted by applicable law, in no event shall the Company or its suppliers be liable for any special, incidental, indirect, or consequential damages whatsoever (including, but not limited to, damages for loss of profits, loss of data or other information, for business interruption, for personal injury, loss of privacy arising out of or in any way related to the use of or inability to use the Service, third-party software and/or third-party hardware used with the Service, or otherwise in connection with any provision of this Terms), even if the Company or any supplier has been advised of the possibility of such damages and even if the remedy fails of its essential purpose.

Some states do not allow the exclusion of implied warranties or limitation of liability for incidental or consequential damages, which means that some of the above limitations may not apply. In these states, each party's liability will be limited to the greatest extent permitted by law.

## "AS IS" and "AS AVAILABLE" Disclaimer

The Service is provided to You "AS IS" and "AS AVAILABLE" and with all faults and defects without warranty of any kind. To the maximum extent permitted under applicable law, the Company, on its own behalf and on behalf of its Affiliates and its and their respective licensors and service providers, expressly disclaims all warranties, whether express, implied, statutory or otherwise, with respect to the Service, including all implied warranties of merchantability, fitness for a particular purpose, title and non-infringement, and warranties that may arise out of course of dealing, course of performance, usage or trade practice. Without limitation to the foregoing, the Company provides no warranty or undertaking, and makes no representation of any kind that the Service will meet Your requirements, achieve any intended results, be compatible or work with any other software, applications, systems or services, operate without interruption, meet any performance or reliability standards or be error free or that any errors or defects can or will be corrected.

Without limiting the foregoing, neither the Company nor any of the company's provider makes any representation or warranty of any kind, express or implied: (i) as to the operation or availability of the Service, or the information, content, and materials or products included thereon; (ii) that the Service will be uninterrupted or error-free; (iii) as to the accuracy, reliability, or currency of any information or content provided through the Service; or (iv) that the Service, its servers, the content, or e-mails sent from or on behalf of the Company are free of viruses, scripts, trojan horses, worms, malware, timebombs or other harmful components.

Some jurisdictions do not allow the exclusion of certain types of warranties or limitations on applicable statutory rights of a consumer, so some or all of the above exclusions and limitations may not apply to You. But in such a case the exclusions and limitations set forth in this section shall be applied to the greatest extent enforceable under applicable law.

## Governing Law

The laws of the Country, excluding its conflicts of law rules, shall govern this Terms and Your use of the Service. Your use of the Application may also be subject to other local, state, national, or international laws.

## Disputes Resolution

If You have any concern or dispute about the Service, You agree to first try to resolve the dispute informally by contacting the Company.

## Changes to These Terms and Conditions

We reserve the right, at Our sole discretion, to modify or replace these Terms at any time. If a revision is material We will make reasonable efforts to provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at Our sole discretion.

By continuing to access or use Our Service after those revisions become effective, You agree to be bound by the revised terms. If You do not agree to the new terms, in whole or in part, please stop using the website and the Service.

## Contact Us

If you have any questions about these Terms and Conditions, You can contact us:

By email: support@ohplus.com`}
                    </div>
                  </div>
                </ScrollArea>
              </div>

              {/* Agreement Section */}
              <div className="flex items-center space-x-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
                <Checkbox
                  id="terms-agreement"
                  checked={hasReadTerms}
                  onCheckedChange={() => {}} // Read-only, auto-checked by scroll
                  disabled={!hasReadTerms}
                />
                <label htmlFor="terms-agreement" className="text-sm font-medium">
                  I have read and agree to the Terms and Conditions
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4">
                <Button
                  variant="outline"
                  onClick={() => router.push('/register')}
                >
                  Cancel
                </Button>
                <Button
                  className={`${
                    hasReadTerms
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "bg-gray-400 cursor-not-allowed"
                  } text-white`}
                  onClick={handleAgree}
                  disabled={!hasReadTerms}
                >
                  I Agree
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}