"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FirebaseError } from "firebase/app"
import { query, collection, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"

// Terms and Conditions content
const TERMS_AND_CONDITIONS = `
TERMS OF SERVICE

Last updated: March 01, 2025

AGREEMENT TO OUR LEGAL TERMS

We are AI Xymbiosis Corp, doing business as AI Xynergy ("Company," "we," "us," "our"), a company registered in the Philippines at 27th Floor PET Plans Building, 444 EDSA, Guadalupe Viejo, Makati City, Metro Manila 1211.

We operate the website boohk.ph (the "Site"), as well as any other related products and services that refer or link to these legal terms (the "Legal Terms") (collectively, the "Services").

You can contact us by email at ooh.partners@aix.ph or by mail to 27th Floor PET Plans Building, 444 EDSA, Guadalupe Viejo, Makati City, Metro Manila 1211, Philippines.

These Legal Terms constitute a legally binding agreement made between you, whether personally or on behalf of an entity ("you"), and AI Xymbiosis Corp, concerning your access to and use of the Services. You agree that by accessing the Services, you have read, understood, and agreed to be bound by all of these Legal Terms. IF YOU DO NOT AGREE WITH ALL OF THESE LEGAL TERMS, THEN YOU ARE EXPRESSLY PROHIBITED FROM USING THE SERVICES AND YOU MUST DISCONTINUE USE IMMEDIATELY.

Supplemental terms and conditions or documents that may be posted on the Services from time to time are hereby expressly incorporated herein by reference. We reserve the right, in our sole discretion, to make changes or modifications to these Legal Terms at any time and for any reason. We will alert you about any changes by updating the "Last updated" date of these Legal Terms, and you waive any right to receive specific notice of each such change.

The Services are intended for users who are at least 18 years old. Persons under the age of 18 are not permitted to use or register for the Services.

We recommend that you print a copy of these Legal Terms for your records.

TABLE OF CONTENTS

1. OUR SERVICES
2. INTELLECTUAL PROPERTY RIGHTS
3. USER REPRESENTATIONS
4. USER REGISTRATION
5. PURCHASES AND PAYMENT
6. PROHIBITED ACTIVITIES
7. USER GENERATED CONTRIBUTIONS
8. CONTRIBUTION LICENSE
9. SERVICES MANAGEMENT
10. PRIVACY POLICY
11. TERM AND TERMINATION
12. MODIFICATIONS AND INTERRUPTIONS
13. GOVERNING LAW
14. DISPUTE RESOLUTION
15. CORRECTIONS
16. DISCLAIMER
17. LIMITATIONS OF LIABILITY
18. INDEMNIFICATION
19. USER DATA
20. ELECTRONIC COMMUNICATIONS, TRANSACTIONS, AND SIGNATURES
21. MISCELLANEOUS
22. CONTACT US

1. OUR SERVICES

The information provided when using the Services is not intended for distribution to or use by any person or entity in any jurisdiction or country where such distribution or use would be contrary to law or regulation or which would subject us to any registration requirement within such jurisdiction or country. Accordingly, those persons who choose to access the Services from other locations do so on their own initiative and are solely responsible for compliance with local laws, if and to the extent local laws are applicable.

2. INTELLECTUAL PROPERTY RIGHTS

Our intellectual property

We are the owner or the licensee of all intellectual property rights in our Services, including all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics in the Services (collectively, the "Content"), as well as the trademarks, service marks, and logos contained therein (the "Marks").

Our Content and Marks are protected by copyright and trademark laws (and various other intellectual property rights and unfair competition laws) and treaties around the world.

The Content and Marks are provided in or through the Services "AS IS" for your internal business purpose only.

Your use of our Services

Subject to your compliance with these Legal Terms, including the "PROHIBITED ACTIVITIES" section below, we grant you a non-exclusive, non-transferable, revocable license to:
• access the Services; and
• download or print a copy of any portion of the Content to which you have properly gained access,
solely for your internal business purpose.

Except as set out in this section or elsewhere in our Legal Terms, no part of the Services and no Content or Marks may be copied, reproduced, aggregated, republished, uploaded, posted, publicly displayed, encoded, translated, transmitted, distributed, sold, licensed, or otherwise exploited for any commercial purpose whatsoever, without our express prior written permission.

If you wish to make any use of the Services, Content, or Marks other than as set out in this section or elsewhere in our Legal Terms, please address your request to: ooh.partners@aix.ph. If we ever grant you the permission to post, reproduce, or publicly display any part of our Services or Content, you must identify us as the owners or licensors of the Services, Content, or Marks and ensure that any copyright or proprietary notice appears or is visible on posting, reproducing, or displaying our Content.

We reserve all rights not expressly granted to you in and to the Services, Content, and Marks.

Any breach of these Intellectual Property Rights will constitute a material breach of our Legal Terms and your right to use our Services will terminate immediately.

Your submissions

Please review this section and the "PROHIBITED ACTIVITIES" section carefully prior to using our Services to understand the (a) rights you give us and (b) obligations you have when you post or upload any content through the Services.

Submissions: By directly sending us any question, comment, suggestion, idea, feedback, or other information about the Services ("Submissions"), you agree to assign to us all intellectual property rights in such Submission. You agree that we shall own this Submission and be entitled to its unrestricted use and dissemination for any lawful purpose, commercial or otherwise, without acknowledgment or compensation to you.

You are responsible for what you post or upload: By sending us Submissions through any part of the Services you:
• confirm that you have read and agree with our "PROHIBITED ACTIVITIES" and will not post, send, publish, upload, or transmit through the Services any Submission that is illegal, harassing, hateful, harmful, defamatory, obscene, bullying, abusive, discriminatory, threatening to any person or group, sexually explicit, false, inaccurate, deceitful, or misleading;
• to the extent permissible by applicable law, waive any and all moral rights to any such Submission;
• warrant that any such Submission are original to you or that you have the necessary rights and licenses to submit such Submissions and that you have full authority to grant us the above-mentioned rights in relation to your Submissions; and
• warrant and represent that your Submissions do not constitute confidential information.

You are solely responsible for your Submissions and you expressly agree to reimburse us for any and all losses that we may suffer because of your breach of (a) this section, (b) any third party's intellectual property rights, or (c) applicable law.

3. USER REPRESENTATIONS

By using the Services, you represent and warrant that:
(1) all registration information you submit will be true, accurate, current, and complete; (2) you will maintain the accuracy of such information and promptly update such registration information as necessary;
(3) you have the legal capacity and you agree to comply with these Legal Terms;
(4) you are not a minor in the jurisdiction in which you reside; (5) you will not access the Services through automated or non-human means, whether through a bot, script or otherwise; (6) you will not use the Services for any illegal or unauthorized purpose; and (7) your use of the Services will not violate any applicable law or regulation.

If you provide any information that is untrue, inaccurate, not current, or incomplete, we have the right to suspend or terminate your account and refuse any and all current or future use of the Services (or any portion thereof).

4. USER REGISTRATION

You may be required to register to use the Services. You agree to keep your password confidential and will be responsible for all use of your account and password. We reserve the right to remove, reclaim, or change a username you select if we determine, in our sole discretion, that such username is inappropriate, obscene, or otherwise objectionable.

5. PURCHASES AND PAYMENT

All purchases are non-refundable.

We accept the following forms of payment:

You agree to provide current, complete, and accurate purchase and account information for all purchases made via the Services. You further agree to promptly update account and payment information, including email address, payment method, and payment card expiration date, so that we can complete your transactions and contact you as needed. Sales tax will be added to the price of purchases as deemed required by us. We may change prices at any time. All payments shall be in __________.

You agree to pay all charges at the prices then in effect for your purchases and any applicable shipping fees, and you authorize us to charge your chosen payment provider for any such amounts upon placing your order. We reserve the right to correct any errors or mistakes in pricing, even if we have already requested or received payment.

We reserve the right to refuse any order placed through the Services. We may, in our sole discretion, limit or cancel quantities purchased per person, per household, or per order. These restrictions may include orders placed by or under the same customer account, the same payment method, and/or orders that use the same billing or shipping address. We reserve the right to limit or prohibit orders that, in our sole judgment, appear to be placed by dealers, resellers, or distributors.

6. PROHIBITED ACTIVITIES

You may not access or use the Services for any purpose other than that for which we make the Services available. The Services may not be used in connection with any commercial endeavors except those that are specifically endorsed or approved by us.

As a user of the Services, you agree not to:
• Systematically retrieve data or other content from the Services to create or compile, directly or indirectly, a collection, compilation, database, or directory without written permission from us.
• Trick, defraud, or mislead us and other users, especially in any attempt to learn sensitive account information such as user passwords.
• Circumvent, disable, or otherwise interfere with security-related features of the Services, including features that prevent or restrict the use or copying of any Content or enforce limitations on the use of the Services and/or the Content contained therein.
• Disparage, tarnish, or otherwise harm, in our opinion, us and/or the Services.
• Use any information obtained from the Services in order to harass, abuse, or harm another person.
• Make improper use of our support services or submit false reports of abuse or misconduct.
• Use the Services in a manner inconsistent with any applicable laws or regulations.
• Engage in unauthorized framing of or linking to the Services.
• Upload or transmit (or attempt to upload or to transmit) viruses, Trojan horses, or other material, including excessive use of capital letters and spamming (continuous posting of repetitive text), that interferes with any party's uninterrupted use and enjoyment of the Services or modifies, impairs, disrupts, alters, or interferes with the use, features, functions, operation, or maintenance of the Services.
• Engage in any automated use of the system, such as using scripts to send comments or messages, or using any data mining, robots, or similar data gathering and extraction tools.
• Delete the copyright or other proprietary rights notice from any Content.
• Attempt to impersonate another user or person or use the username of another user.
• Upload or transmit (or attempt to upload or to transmit) any material that acts as a passive or active information collection or transmission mechanism, including without limitation, clear graphics interchange formats ("gifs"), 1×1 pixels, web bugs, cookies, or other similar devices (sometimes referred to as "spyware" or "passive collection mechanisms" or "pcms").
• Interfere with, disrupt, or create an undue burden on the Services or the networks or services connected to the Services.
• Harass, annoy, intimidate, or threaten any of our employees or agents engaged in providing any portion of the Services to you.
• Attempt to bypass any measures of the Services designed to prevent or restrict access to the Services, or any portion of the Services.
• Copy or adapt the Services' software, including but not limited to Flash, PHP, HTML, JavaScript, or other code.
• Except as permitted by applicable law, decipher, decompile, disassemble, or reverse engineer any of the software comprising or in any way making up a part of the Services.
• Except as may be the result of standard search engine or Internet browser usage, use, launch, develop, or distribute any automated system, including without limitation, any spider, robot, cheat utility, scraper, or offline reader that accesses the Services, or use or launch any unauthorized script or other software.
• Use a buying agent or purchasing agent to make purchases on the Services.
• Make any unauthorized use of the Services, including collecting usernames and/or email addresses of users by electronic or other means for the purpose of sending unsolicited email, or creating user accounts by automated means or under false pretenses.
• Use the Services as part of any effort to compete with us or otherwise use the Services and/or the Content for any revenue-generating endeavor or commercial enterprise.
• Sell or otherwise transfer your profile.

7. USER GENERATED CONTRIBUTIONS

The Services does not offer users to submit or post content. We may provide you with the opportunity to create, submit, post, display, transmit, perform, publish, distribute, or broadcast content and materials to us or on the Services, including but not limited to text, writings, video, audio, photographs, graphics, comments, suggestions, or personal information or other material (collectively, "Contributions"). Contributions may be viewable by other users of the Services and through third-party websites. When you create or make available any Contributions, you thereby represent and warrant that:
• The creation, distribution, transmission, public display, or performance, and the accessing, downloading, or copying of your Contributions do not and will not infringe the proprietary rights, including but not limited to the copyright, patent, trademark, trade secret, or moral rights of any third party.
• You are the creator and owner of or have the necessary licenses, rights, consents, releases, and permissions to use and to authorize us, the Services, and other users of the Services to use your Contributions in any manner contemplated by the Services and these Legal Terms.
• You have the written consent, release, and/or permission of each and every identifiable individual person in your Contributions to use the name or likeness of each and every such identifiable individual person to enable inclusion and use of your Contributions in any manner contemplated by the Services and these Legal Terms.
• Your Contributions are not false, inaccurate, or misleading.
• Your Contributions are not unsolicited or unauthorized advertising, promotional materials, pyramid schemes, chain letters, spam, mass mailings, or other forms of solicitation.
• Your Contributions are not obscene, lewd, lascivious, filthy, violent, harassing, libelous, slanderous, or otherwise objectionable (as determined by us).
• Your Contributions do not ridicule, mock, disparage, intimidate, or abuse anyone.
• Your Contributions are not used to harass or threaten (in the legal sense of those terms) any other person and to promote violence against a specific person or class of people.
• Your Contributions do not violate any applicable law, regulation, or rule.
• Your Contributions do not violate the privacy or publicity rights of any third party.
• Your Contributions do not violate any applicable law concerning child pornography, or otherwise intended to protect the health or well-being of minors.
• Your Contributions do not include any offensive comments that are connected to race, national origin, gender, sexual preference, or physical handicap.
• Your Contributions do not otherwise violate, or link to material that violates, any provision of these Legal Terms, or any applicable law or regulation.

Any use of the Services in violation of the foregoing violates these Legal Terms and may result in, among other things, termination or suspension of your rights to use the Services.

8. CONTRIBUTION LICENSE

You and Services agree that we may access, store, process, and use any information and personal data that you provide and your choices (including settings).

By submitting suggestions or other feedback regarding the Services, you agree that we can use and share such feedback for any purpose without compensation to you.

We do not assert any ownership over your Contributions. You retain full ownership of all of your Contributions and any intellectual property rights or other proprietary rights associated with your Contributions. We are not liable for any statements or representations in your Contributions provided by you in any area on the Services. You are solely responsible for your Contributions to the Services and you expressly agree to exonerate us from any and all responsibility and to refrain from any legal action against us regarding your Contributions.

9. SERVICES MANAGEMENT

We reserve the right, but not the obligation, to: (1) monitor the Services for violations of these Legal Terms; (2) take appropriate legal action against anyone who, in our sole discretion, violates the law or these Legal Terms, including without limitation, reporting such user to law enforcement authorities; (3) in our sole discretion and without limitation, refuse, restrict access to, limit the availability of, or disable (to the extent technologically feasible) any of your Contributions or any portion thereof; (4) in our sole discretion and without limitation, notice, or liability, to remove from the Services or otherwise disable all files and content that are excessive in size or are in any way burdensome to our systems; and (5) otherwise manage the Services in a manner designed to protect our rights and property and to facilitate the proper functioning of the Services.

10. PRIVACY POLICY

We care about data privacy and security. By using the Services, you agree to be bound by our Privacy Policy posted on the Services, which is incorporated into these Legal Terms. Please be advised the Services are hosted in the Philippines. If you access the Services from any other region of the world with laws or other requirements governing personal data collection, use, or disclosure that differ from applicable laws in the Philippines, then through your continued use of the Services, you are transferring your data to the Philippines, and you expressly consent to have your data transferred to and processed in the Philippines.

11. TERM AND TERMINATION

These Legal Terms shall remain in full force and effect while you use the Services. WITHOUT LIMITING ANY OTHER PROVISION OF THESE LEGAL TERMS, WE RESERVE THE RIGHT TO, IN OUR SOLE DISCRETION AND WITHOUT NOTICE OR LIABILITY, DENY ACCESS TO AND USE OF THE SERVICES (INCLUDING BLOCKING CERTAIN IP ADDRESSES), TO ANY PERSON FOR ANY REASON OR FOR NO REASON, INCLUDING WITHOUT LIMITATION FOR BREACH OF ANY REPRESENTATION, WARRANTY, OR COVENANT CONTAINED IN THESE LEGAL TERMS OR OF ANY APPLICABLE LAW OR REGULATION. WE MAY TERMINATE YOUR USE OR PARTICIPATION IN THE SERVICES OR DELETE YOUR ACCOUNT AND ANY CONTENT OR INFORMATION THAT YOU POSTED AT ANY TIME, WITHOUT WARNING, IN OUR SOLE DISCRETION.

If we terminate or suspend your account for any reason, you are prohibited from registering and creating a new account under your name, a fake or borrowed name, or the name of any third party, even if you may be acting on behalf of the third party. In addition to terminating or suspending your account, we reserve the right to take appropriate legal action, including without limitation pursuing civil, criminal, and injunctive redress.

12. MODIFICATIONS AND INTERRUPTIONS

We reserve the right to change, modify, or remove the contents of the Services at any time or for any reason at our sole discretion without notice. However, we have no obligation to update any information on our Services. We will not be liable to you or any third party for any modification, price change, suspension, or discontinuance of the Services.

We cannot guarantee the Services will be available at all times. We may experience hardware, software, or other problems or need to perform maintenance related to the Services, resulting in interruptions, delays, or errors. We reserve the right to change, revise, update, suspend, discontinue, or otherwise modify the Services at any time or for any reason without notice to you. You agree that we have no liability whatsoever for any loss, damage, or inconvenience caused by your inability to access or use the Services during any downtime or discontinuance of the Services. Nothing in these Legal Terms will be construed to obligate us to maintain and support the Services or to supply any corrections, updates, or releases in connection therewith.

13. GOVERNING LAW

These Legal Terms shall be governed by and defined following the laws of the Philippines. AI Xymbiosis Corp and yourself irrevocably consent that the courts of the Philippines shall have exclusive jurisdiction to resolve any dispute which may arise in connection with these Legal Terms.

14. DISPUTE RESOLUTION

Informal Negotiations

To expedite resolution and control the cost of any dispute, controversy, or claim related to these Legal Terms (each a "Dispute" and collectively, the "Disputes") brought by either you or us (individually, a "Party" and collectively, the "Parties"), the Parties agree to first attempt to negotiate any Dispute (except those Disputes expressly provided below) informally for at least thirty (30) days before initiating arbitration. Such informal negotiations commence upon written notice from one Party to the other Party.

Binding Arbitration

Any dispute arising out of or in connection with these Legal Terms, including any question regarding its existence, validity, or termination, shall be referred to and finally resolved by the International Commercial Arbitration Court under the European Arbitration Chamber (Belgium, Brussels, Avenue Louise, 146) according to the Rules of this ICAC, which, as a result of referring to it, is considered as the part of this clause. The number of arbitrators shall be three (3). The seat, or legal place, or arbitration shall be Makati, Philippines. The language of the proceedings shall be English. The governing law of these Legal Terms shall be substantive law of the Philippines.

Restrictions

The Parties agree that any arbitration shall be limited to the Dispute between the Parties individually. To the full extent permitted by law, (a) no arbitration shall be joined with any other proceeding; (b) there is no right or authority for any Dispute to be arbitrated on a class-action basis or to utilize class action procedures; and (c) there is no right or authority for any Dispute to be brought in a purported representative capacity on behalf of the general public or any other persons.

Exceptions to Informal Negotiations and Arbitration

The Parties agree that the following Disputes are not subject to the above provisions concerning informal negotiations binding arbitration: (a) any Disputes seeking to enforce or protect, or concerning the validity of, any of the intellectual property rights of a Party; (b) any Dispute related to, or arising from, allegations of theft, piracy, invasion of privacy, or unauthorized use; and (c) any claim for injunctive relief. If this provision is found to be illegal or unenforceable, then neither Party will elect to arbitrate any Dispute falling within that portion of this provision found to be illegal or unenforceable and such Dispute shall be decided by a court of competent jurisdiction within the courts listed for jurisdiction above, and the Parties agree to submit to the personal jurisdiction of that court.

15. CORRECTIONS

There may be information on the Services that contains typographical errors, inaccuracies, or omissions, including descriptions, pricing, availability, and various other information. We reserve the right to correct any errors, inaccuracies, or omissions and to change or update the information on the Services at any time, without prior notice.

16. DISCLAIMER

THE SERVICES ARE PROVIDED ON AN AS-IS AND AS-AVAILABLE BASIS. YOU AGREE THAT YOUR USE OF THE SERVICES WILL BE AT YOUR SOLE RISK. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, IN CONNECTION WITH THE SERVICES AND YOUR USE THEREOF, INCLUDING, WITHOUT LIMITATION, THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE MAKE NO WARRANTIES OR REPRESENTATIONS ABOUT THE ACCURACY OR COMPLETENESS OF THE SERVICES' CONTENT OR THE CONTENT OF ANY WEBSITES OR MOBILE APPLICATIONS LINKED TO THE SERVICES AND WE WILL ASSUME NO LIABILITY OR RESPONSIBILITY FOR ANY (1) ERRORS, MISTAKES, OR INACCURACIES OF CONTENT AND MATERIALS, (2) PERSONAL INJURY OR PROPERTY DAMAGE, OF ANY NATURE WHATSOEVER, RESULTING FROM YOUR ACCESS TO AND USE OF THE SERVICES, (3) ANY UNAUTHORIZED ACCESS TO OR USE OF OUR SECURE SERVERS AND/OR ANY AND ALL PERSONAL INFORMATION AND/OR FINANCIAL INFORMATION STORED THEREIN, (4) ANY INTERRUPTION OR CESSATION OF TRANSMISSION TO OR FROM THE SERVICES, (5) ANY BUGS, VIRUSES, TROJAN HORSES, OR THE LIKE WHICH MAY BE TRANSMITTED TO OR THROUGH THE SERVICES BY ANY THIRD PARTY, AND/OR (6) ANY ERRORS OR OMISSIONS IN ANY CONTENT AND MATERIALS OR FOR ANY LOSS OR DAMAGE OF ANY KIND INCURRED AS A RESULT OF THE USE OF ANY CONTENT POSTED, TRANSMITTED, OR OTHERWISE MADE AVAILABLE VIA THE SERVICES. WE DO NOT WARRANT, ENDORSE, GUARANTEE, OR ASSUME RESPONSIBILITY FOR ANY PRODUCT OR SERVICE ADVERTISED OR OFFERED BY A THIRD PARTY THROUGH THE SERVICES, ANY HYPERLINKED WEBSITE, OR ANY WEBSITE OR MOBILE APPLICATION FEATURED IN ANY BANNER OR OTHER ADVERTISING, AND WE WILL NOT BE A PARTY TO OR IN ANY WAY BE RESPONSIBLE FOR MONITORING ANY TRANSACTION BETWEEN YOU AND ANY THIRD-PARTY PROVIDERS OF PRODUCTS OR SERVICES. AS WITH THE PURCHASE OF A PRODUCT OR SERVICE THROUGH ANY MEDIUM OR IN ANY ENVIRONMENT, YOU SHOULD USE YOUR BEST JUDGMENT AND EXERCISE CAUTION WHERE APPROPRIATE.

17. LIMITATIONS OF LIABILITY

IN NO EVENT WILL WE OR OUR DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE TO YOU OR ANY THIRD PARTY FOR ANY DIRECT, INDIRECT, CONSEQUENTIAL, EXEMPLARY, INCIDENTAL, SPECIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFIT, LOST REVENUE, LOSS OF DATA, OR OTHER DAMAGES ARISING FROM YOUR USE OF THE SERVICES, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. NOTWITHSTANDING ANYTHING TO THE CONTRARY CONTAINED HEREIN, OUR LIABILITY TO YOU FOR ANY CAUSE WHATSOEVER AND REGARDLESS OF THE FORM OF THE ACTION, WILL AT ALL TIMES BE LIMITED TO THE AMOUNT PAID, IF ANY, BY YOU TO US. CERTAIN US STATE LAWS AND INTERNATIONAL LAWS DO NOT ALLOW LIMITATIONS ON IMPLIED WARRANTIES OR THE EXCLUSION OR LIMITATION OF CERTAIN DAMAGES. IF THESE LAWS APPLY TO YOU, SOME OR ALL OF THE ABOVE DISCLAIMERS OR LIMITATIONS MAY NOT APPLY TO YOU, AND YOU MAY HAVE ADDITIONAL RIGHTS.

18. INDEMNIFICATION

You agree to defend, indemnify, and hold us harmless, including our subsidiaries, affiliates, and all of our respective officers, agents, partners, and employees, from and against any loss, damage, liability, claim, or demand, including reasonable attorneys' fees and expenses, made by any third party due to or arising out of: (1) use of the Services; (2) breach of these Legal Terms; (3) any breach of your representations and warranties set forth in these Legal Terms; (4) your violation of the rights of a third party, including but not limited to intellectual property rights; or (5) any overt harmful act toward any other user of the Services with whom you connected via the Services. Notwithstanding the foregoing, we reserve the right, at your expense, to assume the exclusive defense and control of any matter for which you are required to indemnify us, and you agree to cooperate, at your expense, with our defense of such claims. We will use reasonable efforts to notify you of any such claim, action, or proceeding which is subject to this indemnification upon becoming aware of it.

19. USER DATA

We will maintain certain data that you transmit to the Services for the purpose of managing the performance of the Services, as well as data relating to your use of the Services. Although we perform regular routine backups of data, you are solely responsible for all data that you transmit or that relates to any activity you have undertaken using the Services. You agree that we shall have no liability to you for any loss or corruption of any such data, and you hereby waive any right of action against us arising from any such loss or corruption of such data.

20. ELECTRONIC COMMUNICATIONS, TRANSACTIONS, AND SIGNATURES

Visiting the Services, sending us emails, and completing online forms constitute electronic communications. You consent to receive electronic communications, and you agree that all agreements, notices, disclosures, and other communications we provide to you electronically, via email and on the Services, satisfy any legal requirement that such communication be in writing. YOU HEREBY AGREE TO THE USE OF ELECTRONIC SIGNATURES, CONTRACTS, ORDERS, AND OTHER RECORDS, AND TO ELECTRONIC DELIVERY OF NOTICES, POLICIES, AND RECORDS OF TRANSACTIONS INITIATED OR COMPLETED BY US OR VIA THE SERVICES. You hereby waive any rights or requirements under any statutes, regulations, rules, ordinances, or other laws in any jurisdiction which require an original signature or delivery or retention of non-electronic records, or to payments or the granting of credits by any means other than electronic means.

21. MISCELLANEOUS

These Legal Terms and any policies or operating rules posted by us on the Services or in respect to the Services constitute the entire agreement and understanding between you and us. Our failure to exercise or enforce any right or provision of these Legal Terms shall not operate as a waiver of such right or provision. These Legal Terms operate to the fullest extent permissible by law. We may assign any or all of our rights and obligations to others at any time. We shall not be responsible or liable for any loss, damage, delay, or failure to act caused by any cause beyond our reasonable control. If any provision or part of a provision of these Legal Terms is determined to be unlawful, void, or unenforceable, that provision or part of the provision is deemed severable from these Legal Terms and does not affect the validity and enforceability of any remaining provisions. There is no joint venture, partnership, employment or agency relationship created between you and us as a result of these Legal Terms or use of the Services. You agree that these Legal Terms will not be construed against us by virtue of having drafted them. You hereby waive any and all defenses you may have based on the electronic form of these Legal Terms and the lack of signing by the parties hereto to execute these Legal Terms.

22. CONTACT US

In order to resolve a complaint regarding the Services or to receive further information regarding use of the Services, please contact us at:

AI Xymbiosis Corp
27th Floor PET Plans Building, 444 EDSA, Guadalupe Viejo
Makati City, Metro Manila 1211
Philippines
ooh.partners@aix.ph
`

// Rules and Regulations content
const RULES_AND_REGULATIONS = `
# Rules and Regulations

Last updated: May 24, 2021

These Rules and Regulations ("Rules") govern your use of the OH!Plus platform. By accessing or using our Service, you agree to comply with these Rules.

## General Conduct

### Acceptable Use
You agree to use the OH!Plus platform only for lawful purposes and in accordance with these Rules. You are prohibited from using the platform:

- In any way that violates any applicable federal, state, local, or international law or regulation
- To transmit, or procure the sending of, any advertising or promotional material, including any "junk mail," "chain letter," "spam," or any other similar solicitation
- To impersonate or attempt to impersonate the Company, a Company employee, another user, or any other person or entity
- To engage in any other conduct that restricts or inhibits anyone's use or enjoyment of the Service, or which, as determined by us, may harm the Company or users of the Service or expose them to liability

### User Responsibilities
As a user of OH!Plus, you are responsible for:

- Maintaining the confidentiality of your account and password
- All activities that occur under your account
- Ensuring that all information you provide is accurate and up-to-date
- Complying with all applicable laws and regulations
- Respecting the rights of other users and third parties

## Content Guidelines

### Prohibited Content
You may not post, upload, or share content that:

- Is illegal, harmful, threatening, abusive, harassing, defamatory, vulgar, obscene, or invasive of another's privacy
- Contains software viruses or any other computer code, files, or programs designed to interrupt, destroy, or limit the functionality of any computer software or hardware
- Constitutes unauthorized or unsolicited advertising
- Contains false or misleading information

### Content Ownership
You retain ownership of content you submit to OH!Plus, but you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, adapt, publish, translate, distribute, and display such content in connection with the Service.

## Business Operations

### Service Availability
While we strive to provide continuous service, OH!Plus may be temporarily unavailable due to maintenance, updates, or other reasons. We are not liable for any damages resulting from service interruptions.

### Data Security
We implement reasonable security measures to protect your data, but we cannot guarantee absolute security. You are responsible for maintaining the security of your account credentials.

### Billing and Payments
If you use paid features:

- All fees are non-refundable unless otherwise specified
- You agree to pay all charges associated with your account
- We may change pricing with 30 days' notice
- Failed payments may result in service suspension

## User Interactions

### Communication Standards
When communicating with other users or our team:

- Be respectful and professional
- Do not share personal information without consent
- Report any suspicious or inappropriate behavior
- Use appropriate language and tone

### Dispute Resolution
In case of disputes with other users:

- Attempt to resolve issues directly first
- Contact our support team if direct resolution fails
- We may mediate disputes at our discretion
- We reserve the right to suspend accounts involved in disputes

## Platform Integrity

### System Integrity
You agree not to:

- Attempt to gain unauthorized access to our systems
- Interfere with or disrupt the Service
- Use automated tools to access the Service without permission
- Circumvent any security measures

### Reporting Violations
If you encounter violations of these Rules:

- Report the issue to our support team immediately
- Provide as much detail as possible
- Cooperate with any investigations
- Do not take matters into your own hands

## Account Management

### Account Creation
To create an account:

- You must be at least 18 years old
- Provide accurate and complete information
- Choose a strong, unique password
- Verify your email address

### Account Termination
We may terminate or suspend your account if you:

- Violate these Rules
- Provide false information
- Engage in fraudulent activity
- Fail to pay for services
- Remain inactive for an extended period

## Intellectual Property

### OH!Plus IP
All OH!Plus trademarks, service marks, logos, and content are owned by us and may not be used without permission.

### User-Generated Content
By posting content on OH!Plus:

- You confirm you have the right to share it
- You grant us license to use it as described above
- You agree not to post copyrighted material without permission
- You are responsible for any IP infringement claims

## Legal Compliance

### Applicable Laws
Your use of OH!Plus must comply with:

- All applicable local, state, and federal laws
- International laws if accessing from outside the Philippines
- Industry-specific regulations relevant to your business

### Export Controls
You agree not to use OH!Plus in violation of export control laws or regulations.

## Amendments

We reserve the right to modify these Rules at any time. Changes will be effective immediately upon posting. Your continued use of the Service constitutes acceptance of the modified Rules.

## Contact Information

For questions about these Rules and Regulations, contact us at:
- Email: support@ohplus.com
- Phone: +63 (2) 123-4567
`

// Privacy Policy content (provided by user)
const PRIVACY_POLICY = `Privacy Policy
Last updated: May 24, 2021

This Privacy Policy describes Our policies and procedures on the collection, use and disclosure of Your information when You use the Service and tells You about Your privacy rights and how the law protects You.

We use Your Personal data to provide and improve the Service. By using the Service, You agree to the collection and use of information in accordance with this Privacy Policy. This Privacy Policy has been created with the help of the Privacy Policy Generator.

Interpretation and Definitions
Interpretation
The words of which the initial letter is capitalized have meanings defined under the following conditions. The following definitions shall have the same meaning regardless of whether they appear in singular or in plural.

Definitions
For the purposes of this Privacy Policy:

Account means a unique account created for You to access our Service or parts of our Service.

Affiliate means an entity that controls, is controlled by or is under common control with a party, where "control" means ownership of 50% or more of the shares, equity interest or other securities entitled to vote for election of directors or other managing authority.

Application means the software program provided by the Company downloaded by You on any electronic device, named Wabler

Company (referred to as either "the Company", "We", "Us" or "Our" in this Agreement) refers to AI Xyndicate, 727 Gawad Tulay Holdings Inc., Gen. Solano St., San Miguel, Manila.

Country refers to: Philippines

Device means any device that can access the Service such as a computer, a cellphone or a digital tablet.

Personal Data is any information that relates to an identified or identifiable individual.

Service refers to the Application.

Service Provider means any natural or legal person who processes the data on behalf of the Company. It refers to third-party companies or individuals employed by the Company to facilitate the Service, to provide the Service on behalf of the Company, to perform services related to the Service or to assist the Company in analyzing how the Service is used.

Usage Data refers to data collected automatically, either generated by the use of the Service or from the Service infrastructure itself (for example, the duration of a page visit).

You means the individual accessing or using the Service, or the company, or other legal entity on behalf of which such individual is accessing or using the Service, as applicable.

Collecting and Using Your Personal Data
Types of Data Collected
Personal Data
While using Our Service, We may ask You to provide Us with certain personally identifiable information that can be used to contact or identify You. Personally identifiable information may include, but is not limited to:

Email address

First name and last name

Phone number

Address, State, Province, ZIP/Postal code, City

Usage Data

Usage Data
Usage Data is collected automatically when using the Service.

Usage Data may include information such as Your Device's Internet Protocol address (e.g. IP address), browser type, browser version, the pages of our Service that You visit, the time and date of Your visit, the time spent on those pages, unique device identifiers and other diagnostic data.

When You access the Service by or through a mobile device, We may collect certain information automatically, including, but not limited to, the type of mobile device You use, Your mobile device unique ID, the IP address of Your mobile device, Your mobile operating system, the type of mobile Internet browser You use, unique device identifiers and other diagnostic data.

We may also collect information that Your browser sends whenever You visit our Service or when You access the Service by or through a mobile device.

Information Collected while Using the Application
While using Our Application, in order to provide features of Our Application, We may collect, with Your prior permission:

Information regarding your location
We use this information to provide features of Our Service, to improve and customize Our Service. The information may be uploaded to the Company's servers and/or a Service Provider's server or it may be simply stored on Your device.

You can enable or disable access to this information at any time, through Your Device settings.

Use of Your Personal Data
The Company may use Personal Data for the following purposes:

To provide and maintain our Service, including to monitor the usage of our Service.

To manage Your Account: to manage Your registration as a user of the Service. The Personal Data You provide can give You access to different functionalities of the Service that are available to You as a registered user.

For the performance of a contract: the development, compliance and undertaking of the purchase contract for the products, items or services You have purchased or of any other contract with Us through the Service.

To contact You: To contact You by email, telephone calls, SMS, or other equivalent forms of electronic communication, such as a mobile application's push notifications regarding updates or informative communications related to the functionalities, products or contracted services, including the security updates, when necessary or reasonable for their implementation.

To provide You with news, special offers and general information about other goods, services and events which we offer that are similar to those that you have already purchased or enquired about unless You have opted not to receive such information.

To manage Your requests: To attend and manage Your requests to Us.

For business transfers: We may use Your information to evaluate or conduct a merger, divestiture, restructuring, reorganization, dissolution, or similar proceeding, in which Personal Data held by Us about our Service users is among the assets transferred.

For other purposes: We may use Your information for other purposes, such as data analysis, identifying usage trends, determining the effectiveness of our promotional campaigns and to evaluate and improve our Service, products, services, marketing and your experience.

We may share Your personal information in the following situations:

With Service Providers: We may share Your personal information with Service Providers to monitor and analyze the use of our Service, to contact You.
For business transfers: We may share or transfer Your personal information in connection with, or during negotiations of, any merger, sale of Company assets, financing, or acquisition of all or a portion of Our business to another company.
With Affiliates: We may share Your information with Our affiliates, in which case we will require those affiliates to honor this Privacy Policy. Affiliates include Our parent company and any other subsidiaries, joint venture partners or other companies that We control or that are under common control with Us.
With business partners: We may share Your information with Our business partners to offer You certain products, services or promotions.
With other users: when You share personal information or otherwise interact in the public areas with other users, such information may be viewed by all users and may be publicly distributed outside.
With Your consent: We may disclose Your personal information for any other purpose with Your consent.
Retention of Your Personal Data
The Company will retain Your Personal Data only for as long as is necessary for the purposes set out in this Privacy Policy. We will retain and use Your Personal Data to the extent necessary to comply with our legal obligations (for example, if we are required to retain your data to comply with applicable laws), resolve disputes, and enforce our legal agreements and policies.

The Company will also retain Usage Data for internal analysis purposes. Usage Data is generally retained for a shorter period of time, except when this data is used to strengthen the security or to improve the functionality of Our Service, or We are legally obligated to retain this data for longer time periods.

Transfer of Your Personal Data
Your information, including Personal Data, is processed at the Company's operating offices and in any other places where the parties involved in the processing are located. It means that this information may be transferred to — and maintained on — computers located outside of Your state, province, country or other governmental jurisdiction where the data protection laws may differ than those from Your jurisdiction.

Your consent to this Privacy Policy followed by Your submission of such information represents Your agreement to that transfer.

The Company will take all steps reasonably necessary to ensure that Your data is treated securely and in accordance with this Privacy Policy and no transfer of Your Personal Data will take place to an organization or a country unless there are adequate controls in place including the security of Your data and other personal information.

Disclosure of Your Personal Data
Business Transactions
If the Company is involved in a merger, acquisition or asset sale, Your Personal Data may be transferred. We will provide notice before Your Personal Data is transferred and becomes subject to a different Privacy Policy.

Law enforcement
Under certain circumstances, the Company may be required to disclose Your Personal Data if required to do so by law or in response to valid requests by public authorities (e.g. a court or a government agency).

Other legal requirements
The Company may disclose Your Personal Data in the good faith belief that such action is necessary to:

Comply with a legal obligation
Protect and defend the rights or property of the Company
Prevent or investigate possible wrongdoing in connection with the Service
Protect the personal safety of Users of the Service or the public
Protect against legal liability
Security of Your Personal Data
The security of Your Personal Data is important to Us, but remember that no method of transmission over the Internet, or method of electronic storage is 100% secure. While We strive to use commercially acceptable means to protect Your Personal Data, We cannot guarantee its absolute security.

Children's Privacy
Our Service does not address anyone under the age of 13. We do not knowingly collect personally identifiable information from anyone under the age of 13. If You are a parent or guardian and You are aware that Your child has provided Us with Personal Data, please contact Us. If We become aware that We have collected Personal Data from anyone under the age of 13 without verification of parental consent, We take steps to remove that information from Our servers.

If We need to rely on consent as a legal basis for processing Your information and Your country requires consent from a parent, We may require Your parent's consent before We collect and use that information.

Links to Other Websites
Our Service may contain links to other websites that are not operated by Us. If You click on a third party link, You will be directed to that third party's site. We strongly advise You to review the Privacy Policy of every site You visit.

We have no control over and assume no responsibility for the content, privacy policies or practices of any third party sites or services.

Changes to this Privacy Policy
We may update Our Privacy Policy from time to time. We will notify You of any changes by posting the new Privacy Policy on this page.

We will let You know via email and/or a prominent notice on Our Service, prior to the change becoming effective and update the "Last updated" date at the top of this Privacy Policy.

You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.

Contact Us
If you have any questions about this Privacy Policy, You can contact us:

By email: support@ohplus.com`

export default function AccountCreationPage() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    countryCode: "+63",
    cellphone: "",
    email: "",
    password: "",
    confirmPassword: "",
    agreeToTerms: false,
  })
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [invitationRole, setInvitationRole] = useState<string | null>(null)
  const [loadingInvitation, setLoadingInvitation] = useState(false)
  const [invitationEmail, setInvitationEmail] = useState<string>("")
  const [isInvitationValid, setIsInvitationValid] = useState<boolean>(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [termsDialogOpen, setTermsDialogOpen] = useState(false)
  const [isStartingTour, setIsStartingTour] = useState(false)


  const { register, user, userData, getRoleDashboardPath } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Get organization code from URL parameters
  const orgCode = searchParams.get("orgCode")

  // Debug: Log when invitation email changes
  useEffect(() => {
    if (invitationEmail) {
      console.log("Invitation email set:", invitationEmail)
    }
  }, [invitationEmail])

  // Debug: Log when form data email changes
  useEffect(() => {
    if (formData.email) {
      console.log("Form data email set:", formData.email)
    }
  }, [formData.email])

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))

  }


  // Redirect if user is already logged in
  useEffect(() => {
    if (user && userData && !showWelcome && !isRegistering) {
      const dashboardPath = getRoleDashboardPath(userData.roles || [])
      if (dashboardPath) {
        router.push(dashboardPath)
      } else {
        router.push("/unauthorized")
      }
    }
  }, [user, userData, router, getRoleDashboardPath, showWelcome, isRegistering])


  // Fetch invitation details when code is present
  useEffect(() => {
    const fetchInvitationDetails = async () => {
      if (!orgCode) return

      setLoadingInvitation(true)
      try {
        const invitationQuery = query(collection(db, "invitation_codes"), where("code", "==", orgCode))
        const invitationSnapshot = await getDocs(invitationQuery)

        if (!invitationSnapshot.empty) {
          const invitationDoc = invitationSnapshot.docs[0]
          const invitationData = invitationDoc.data()

          // Check if max_usage is still greater than used_by.length
          const maxUsage = invitationData.max_usage || 1 // Default to 1 if not set
          const currentUsage = invitationData.used_by ? invitationData.used_by.length : 0

          if (currentUsage >= maxUsage) {
            setErrorMessage("This invitation code has reached its maximum usage limit.")
            setIsInvitationValid(false)
            return
          }

          // Set invitation data
          if (invitationData.role) {
            setInvitationRole(invitationData.role)
          }

          if (invitationData.invited_email || invitationData.email) {
            const emailToUse = invitationData.invited_email || invitationData.email
            console.log("Auto-filling email:", emailToUse)
            console.log("Available email fields:", {
              invited_email: invitationData.invited_email,
              email: invitationData.email
            })
            setInvitationEmail(emailToUse)
            // Auto-fill the email in form data
            setFormData(prev => {
              const newFormData = { ...prev, email: emailToUse }
              console.log("Updated form data with email:", newFormData)
              return newFormData
            })
          } else {
            console.log("No email found in invitation data:", invitationData)
          }

          setIsInvitationValid(true)
        } else {
          setErrorMessage("Invalid invitation code.")
        }
      } catch (error) {
        console.error("Error fetching invitation details:", error)
        setErrorMessage("Error loading invitation details.")
      } finally {
        setLoadingInvitation(false)
      }
    }

    fetchInvitationDetails()
  }, [orgCode])


  const getFriendlyErrorMessage = (error: unknown): string => {
    if (error instanceof FirebaseError) {
      switch (error.code) {
        case "auth/email-already-in-use":
          return "This email address is already in use. Please use a different email or log in."
        case "auth/invalid-email":
          return "The email address is not valid. Please check the format."
        case "auth/weak-password":
          return "The password is too weak. Please choose a stronger password (at least 6 characters)."
        case "auth/operation-not-allowed":
          return "Email/password accounts are not enabled. Please contact support."
        case "auth/network-request-failed":
          return "Network error. Please check your internet connection and try again."
        default:
          return "An unexpected error occurred during registration. Please try again."
      }
    }
    return "An unknown error occurred. Please try again."
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleRegister()
  }

  const handleRegister = async () => {
    setErrorMessage(null)

    if (!formData.firstName || !formData.lastName || !formData.cellphone || !formData.password || !formData.confirmPassword) {
      setErrorMessage("Please fill in all required fields.")
      return
    }

    // If there's an invitation code, email should be auto-filled, but check if it's valid
    if (orgCode && !formData.email) {
      setErrorMessage("Email address is required for invitation code registration.")
      return
    }

    if (!formData.agreeToTerms) {
      setErrorMessage("Please agree to the terms and conditions.")
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorMessage("Passwords do not match.")
      return
    }

    setLoading(true)
    setIsRegistering(true)

    try {
      await register(
        {
          email: formData.email,
          first_name: formData.firstName,
          last_name: formData.lastName,
          middle_name: formData.middleName,
          phone_number: formData.countryCode + formData.cellphone,
          gender: "",
        },
        {
          company_name: "",
          company_location: "",
        },
        formData.password,
        orgCode || undefined,
      )

      // Registration successful - show welcome UI
      setShowWelcome(false)
      setIsRegistering(false)
    } catch (error: unknown) {
      console.error("Registration failed:", error)
      setErrorMessage(getFriendlyErrorMessage(error))
      setIsRegistering(false)
    } finally {
      setLoading(false)
    }
  }


  if (showWelcome) {
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
                src="/owen-face.png"
                alt="User icon"
                className="w-16 h-16 rounded-full"
              />
            </div>

            {/* Main heading */}
            <h1 className="text-5xl font-bold text-foreground leading-tight">
              Welcome aboard,
              <br />
              {formData.firstName}!
            </h1>

            {/* Description text */}
            <div className="space-y-5 text-muted-foreground leading-relaxed text-lg">
              <p>
                Since you're the first one here, your mission is to{" "}
                <span className="font-semibold text-foreground">bring your teammates on board</span> this adventure.
              </p>
              <p>But before that, let me give you a quick little tour so you can get comfy. It'll only take a minute!</p>
            </div>

            {/* Start Tour button */}
            <div className="pt-6 flex justify-end">
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg font-medium text-lg flex items-center gap-3"
                onClick={async () => {
                  setIsStartingTour(true)
                  // Add a small delay for loading animation
                  await new Promise(resolve => setTimeout(resolve, 1000))
                  router.push("/it/onboarding")
                }}
                disabled={isStartingTour}
              >
                {isStartingTour ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Starting Tour...
                  </>
                ) : (
                  <>
                    Start Tour
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Illustration */}
      <div className="hidden md:flex flex-1 relative">
        <div className="w-full h-full rounded-[50px]">
          <Image
            src="/register-image-1.png"
            alt="Registration illustration"
            fill
            className=""
            priority
          />
        </div>
        <img src="/boohk-logo.png" style={{width: '62px', height: '77.5px', flexShrink: 0, position: 'absolute', bottom: '40px', left: '40px'}} />
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 bg-white flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <h1 style={{color: '#333', fontFamily: 'Inter', fontSize: '30px', fontWeight: 700, lineHeight: '100%'}}>Let's create your account</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-1">
            {/* First Name and Last Name Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" style={{color: '#333', fontFamily: 'Inter', fontSize: '12.004px', fontWeight: 500, lineHeight: '100%'}}>
                  First Name
                </Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="First Name"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange("firstName", e.target.value)}
                  style={{height: '24px', borderRadius: '10px', border: '1.2px solid #C4C4C4', background: '#FFF'}}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" style={{color: '#333', fontFamily: 'Inter', fontSize: '12.004px', fontWeight: 500, lineHeight: '100%'}}>
                  Last Name
                </Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Last Name"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
                  style={{height: '24px', borderRadius: '10px', border: '1.2px solid #C4C4C4', background: '#FFF'}}
                />
              </div>
            </div>

            {/* Middle Name */}
            <div className="space-y-2">
              <Label htmlFor="middleName" style={{color: '#333', fontFamily: 'Inter', fontSize: '12.004px', fontWeight: 500, lineHeight: '100%'}}>
                Middle Name (Optional)
              </Label>
              <Input
                id="middleName"
                type="text"
                placeholder="Middle Name"
                value={formData.middleName}
                onChange={(e) => handleInputChange("middleName", e.target.value)}
                style={{height: '24px', borderRadius: '10px', border: '1.2px solid #C4C4C4', background: '#FFF'}}
              />
            </div>

            {/* Cellphone Number */}
            <div className="space-y-2">
              <Label htmlFor="cellphone" style={{color: '#333', fontFamily: 'Inter', fontSize: '12.004px', fontWeight: 500, lineHeight: '100%'}}>
                Cellphone Number
              </Label>
              <div className="flex gap-2">
                <Select value={formData.countryCode} onValueChange={(value) => handleInputChange("countryCode", value)}>
                  <SelectTrigger className="w-20" style={{height: '24px', border: 'none', background: 'transparent'}}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="+63">+63</SelectItem>
                    <SelectItem value="+1">+1</SelectItem>
                    <SelectItem value="+44">+44</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  id="cellphone"
                  type="tel"
                  placeholder="Cellphone No."
                  value={formData.cellphone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 10)
                    handleInputChange("cellphone", value)
                  }}
                  style={{height: '24px', borderRadius: '10px', border: '1.2px solid #C4C4C4', background: '#FFF'}}
                />
              </div>
            </div>

            {/* Email Address */}
            <div className="space-y-2">
              <Label htmlFor="email" style={{color: '#333', fontFamily: 'Inter', fontSize: '12.004px', fontWeight: 500, lineHeight: '100%'}}>
                Email Address {invitationEmail && ""}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                disabled={!!invitationEmail}
                style={{height: '24px', borderRadius: '10px', border: '1.2px solid #C4C4C4', background: '#FFF'}}
              />
              {invitationEmail && (
                <p className="text-sm text-gray-500">
                  Email is locked to the invitation code email address
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" style={{color: '#333', fontFamily: 'Inter', fontSize: '12.004px', fontWeight: 500, lineHeight: '100%'}}>
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Password"
                value={formData.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
                style={{height: '24px', borderRadius: '10px', border: '1.2px solid #C4C4C4', background: '#FFF'}}
              />
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" style={{color: '#333', fontFamily: 'Inter', fontSize: '12.004px', fontWeight: 500, lineHeight: '100%'}}>
                Confirm Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm password"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                style={{height: '24px', borderRadius: '10px', border: '1.2px solid #C4C4C4', background: '#FFF'}}
              />
            </div>

            {/* Terms and Conditions */}
            <div className="flex items-start space-x-2 py-5">
              <Checkbox
                id="terms"
                checked={formData.agreeToTerms}
                onCheckedChange={(checked) => handleInputChange("agreeToTerms", checked as boolean)}
                className="mt-1"
              />
              <Label htmlFor="terms" style={{color: '#333', fontFamily: 'Inter', fontSize: '10px', fontWeight: 400, lineHeight: '100%'}}>
                By signing up, I hereby acknowledge that I have read, understood, and agree to abide by the{" "}
                <Dialog open={termsDialogOpen} onOpenChange={setTermsDialogOpen}>
                  <DialogTrigger asChild>
                    <span style={{color: '#2D3FFF', fontFamily: 'Inter', fontSize: '10px', fontWeight: 500, lineHeight: '100%', textDecorationLine: 'underline'}}>Terms and Conditions</span>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
                    <DialogHeader>
                      <DialogTitle>Terms and Conditions</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="h-96 w-full">
                      <div className="pr-4">
                        <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
                          {TERMS_AND_CONDITIONS}
                        </div>
                      </div>
                    </ScrollArea>
                    <div className="flex justify-end space-x-4 mt-4">
                      <Button
                        variant="outline"
                        onClick={() => setTermsDialogOpen(false)}
                      >
                        Close
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>{" set by Boohk."}
              </Label>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <Button
                type="submit"
                style={{width: '140px', height: '23.493px', borderRadius: '6.024px', background: '#1D0BEB'}}
                disabled={!formData.agreeToTerms}
              >
                {loading ? "Creating Account..." : "Confirm"}
              </Button>
            </div>
          </form>

          {errorMessage && (
            <div className="text-red-500 text-sm mt-4 text-center" role="alert">
              {errorMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
