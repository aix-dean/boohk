"use client"

import { useParams, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, Check, ArrowLeft } from "lucide-react";
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { addDoc, collection, serverTimestamp, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { storage } from "@/lib/firebase"
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { GenericSuccessDialog } from "@/components/generic-success-dialog";
import { getTeamById } from "@/lib/teams-service";
import { CompanyService } from "@/lib/company-service";
import { generateServiceAssignmentPDF } from "@/lib/pdf-service";
import { getJobOrderById } from "@/lib/job-order-service";

interface CompanyData {
  id: string
  name?: string
  company_location?: any
  address?: any
  company_website?: string
  website?: string
  logo?: string
  contact_person?: string
  email?: string
  phone?: string
  social_media?: any
  created_by?: string
  created?: Date
  updated?: Date
}

interface UserData {
  id: string
  first_name?: string
  last_name?: string
  email?: string
  signature?: {
    url?: string
  }
  company_id?: string
}

// Chunked base64 conversion to handle large PDFs efficiently
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 8192 // Process in 8KB chunks to avoid stack overflow
  let result = ''

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize)
    result += String.fromCharCode.apply(null, Array.from(chunk))
  }

  return btoa(result)
}

const fetchCompanyData = async (user: any, userData: any): Promise<CompanyData | null> => {
  if (!user?.uid || !userData) return null

  try {
    let companyDoc = null
    let companyDataResult = null

    // First, try to find company by company_id if it exists in userData
    if (userData?.company_id) {
      try {
        const companyDocRef = doc(db, "companies", userData.company_id)
        const companyDocSnap = await getDoc(companyDocRef)

        if (companyDocSnap.exists()) {
          companyDoc = companyDocSnap
          companyDataResult = companyDocSnap.data()
        }
      } catch (error) {
        console.error("Error fetching company by company_id:", error)
      }
    }

    // If no company found by company_id, try other methods
    if (!companyDoc) {
      // Try to find company by created_by field
      let companiesQuery = query(collection(db, "companies"), where("created_by", "==", user.uid))
      let companiesSnapshot = await getDocs(companiesQuery)

      // If no company found by created_by, try to find by email or other identifiers
      if (companiesSnapshot.empty && user.email) {
        companiesQuery = query(collection(db, "companies"), where("email", "==", user.email))
        companiesSnapshot = await getDocs(companiesQuery)
      }

      // If still no company found, try to find by contact_person email
      if (companiesSnapshot.empty && user.email) {
        companiesQuery = query(collection(db, "companies"), where("contact_person", "==", user.email))
        companiesSnapshot = await getDocs(companiesQuery)
      }

      if (!companiesSnapshot.empty) {
        companyDoc = companiesSnapshot.docs[0]
        companyDataResult = companyDoc.data()
      }
    }

    if (companyDoc && companyDataResult) {
      const company: CompanyData = {
        id: companyDoc.id,
        name: companyDataResult.name,
        company_location: companyDataResult.company_location || companyDataResult.address,
        address: companyDataResult.address,
        company_website: companyDataResult.company_website || companyDataResult.website,
        logo: companyDataResult.logo,
        contact_person: companyDataResult.contact_person,
        email: companyDataResult.email,
        phone: companyDataResult.phone,
        social_media: companyDataResult.social_media || {},
        created_by: companyDataResult.created_by,
        created: companyDataResult.created?.toDate
          ? companyDataResult.created.toDate()
          : companyDataResult.created_at?.toDate(),
        updated: companyDataResult.updated?.toDate
          ? companyDataResult.updated.toDate()
          : companyDataResult.updated_at?.toDate(),
      }

      return company
    } else {
      return null
    }
  } catch (error) {
    console.error("Error fetching company data:", error)
    return null
  }
}

export default function ViewPDFPage() {
   const { id } = useParams();
   const searchParams = useSearchParams();
   const router = useRouter();
   const { user, userData } = useAuth();
   const { toast } = useToast();
   const [creatingAssignment, setCreatingAssignment] = useState(false);
   const [pdfData, setPdfData] = useState<string | null>(null);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   const [iframeError, setIframeError] = useState(false);
   const [showSuccessDialog, setShowSuccessDialog] = useState(false);
   const [successDialogProps, setSuccessDialogProps] = useState({
     title: "Success!",
     message: "Service Assignment has been sent successfully.",
     confirmButtonText: "OK"
   });
   const [companyData, setCompanyData] = useState<CompanyData | null>(null);
   const [jobOrderData, setJobOrderData] = useState<any>(null);
   const isPreview = id === 'preview';
   const jobOrderId = searchParams.get('jobOrderId') || 'Df4wxbfrO5EnAbml0r2I';

  useEffect(() => {
    const loadPDF = async () => {
      console.log('[PDF Loading] Starting PDF generation process');
      console.log('[PDF Loading] Current URL params - id:', id, 'isPreview:', isPreview);
      console.log('[PDF Loading] Local storage keys:', Object.keys(localStorage));
      setLoading(true);
      setError(null);

      // Fetch job order data if jobOrderId is provided
      if (jobOrderId) {
        try {
          console.log('[PDF Loading] Fetching job order data for jobOrderId:', jobOrderId);
          const jobOrder = await getJobOrderById(jobOrderId);
          if (jobOrder) {
            setJobOrderData(jobOrder);
            console.log('[PDF Loading] Job order data fetched:', jobOrder);
          } else {
            console.warn('[PDF Loading] Job order not found for ID:', jobOrderId);
          }
        } catch (error) {
          console.error('[PDF Loading] Error fetching job order data:', error);
        }
      }

      try {
        // Enhanced localStorage validation
        const assignmentDataString = localStorage.getItem('serviceAssignmentData');
        console.log('[PDF Loading] Retrieved localStorage data:', assignmentDataString ? 'Found' : 'Not found');
        console.log('[PDF Loading] Data length:', assignmentDataString?.length || 0);

        if (!assignmentDataString) {
          const errorMsg = 'Assignment data not found in local storage. Please create a service assignment first.';
          console.error('[PDF Loading] Error:', errorMsg);
          console.error('[PDF Loading] Available localStorage keys:', Object.keys(localStorage));
          setError(errorMsg);
          setLoading(false);
          return;
        }

        let assignmentData;
        try {
          assignmentData = JSON.parse(assignmentDataString);
          console.log('[PDF Loading] Successfully parsed assignment data');
          console.log('[PDF Loading] Parsed data keys:', Object.keys(assignmentData));
          console.log('[PDF Loading] SA Number:', assignmentData.saNumber);
          console.log('[PDF Loading] Project Site:', assignmentData.projectSiteName);
        } catch (parseError) {
          const errorMsg = 'Invalid assignment data format in session storage.';
          console.error('[PDF Loading] JSON parse error:', parseError);
          console.error('[PDF Loading] Raw data preview:', assignmentDataString?.substring(0, 200));
          setError(errorMsg);
          setLoading(false);
          return;
        }

        // Data validation with fallback defaults for required fields
        console.log('[PDF Loading] Validating and setting defaults for required fields');

        // Provide default values for required fields if missing
        if (!assignmentData.saNumber) {
          assignmentData.saNumber = `SA-${Date.now()}`;
          console.log('[PDF Loading] Set default saNumber:', assignmentData.saNumber);
        }

        if (!assignmentData.projectSiteName) {
          assignmentData.projectSiteName = 'Project Site Name';
          console.log('[PDF Loading] Set default projectSiteName:', assignmentData.projectSiteName);
        }

        if (!assignmentData.serviceType) {
          assignmentData.serviceType = 'General Service';
          console.log('[PDF Loading] Set default serviceType:', assignmentData.serviceType);
        }

        if (!assignmentData.assignedTo) {
          assignmentData.assignedTo = 'Unassigned';
          console.log('[PDF Loading] Set default assignedTo:', assignmentData.assignedTo);
        }

        // Ensure optional fields have proper defaults
        assignmentData.projectSiteLocation = assignmentData.projectSiteLocation || '';
        assignmentData.assignedToName = assignmentData.assignedToName || '';
        assignmentData.serviceDuration = assignmentData.serviceDuration || '';
        assignmentData.priority = assignmentData.priority || 'Normal';
        assignmentData.equipmentRequired = assignmentData.equipmentRequired || '';
        assignmentData.materialSpecs = assignmentData.materialSpecs || '';
        assignmentData.crew = assignmentData.crew || '';
        assignmentData.gondola = assignmentData.gondola || '';
        assignmentData.technology = assignmentData.technology || '';
        assignmentData.sales = assignmentData.sales || '';
        assignmentData.remarks = assignmentData.remarks || '';
        assignmentData.alarmTime = assignmentData.alarmTime || '';
        assignmentData.attachments = assignmentData.attachments || [];
        assignmentData.serviceExpenses = assignmentData.serviceExpenses || [];

        console.log('[PDF Loading] Data validation and defaults completed');
        console.log('[PDF Loading] Attachments data:', assignmentData.attachments);

        // Validate and set default date fields
        if (!assignmentData.startDate || isNaN(new Date(assignmentData.startDate).getTime())) {
          console.warn('[PDF Loading] Invalid or missing startDate, setting to current date');
          assignmentData.startDate = new Date().toISOString();
        }
        if (!assignmentData.endDate || isNaN(new Date(assignmentData.endDate).getTime())) {
          console.warn('[PDF Loading] Invalid or missing endDate, setting to 7 days from start');
          const startDate = new Date(assignmentData.startDate);
          const endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 7);
          assignmentData.endDate = endDate.toISOString();
        }
        if (!assignmentData.alarmDate || isNaN(new Date(assignmentData.alarmDate).getTime())) {
          console.warn('[PDF Loading] Invalid or missing alarmDate, setting to start date');
          assignmentData.alarmDate = assignmentData.startDate;
        }

        console.log('[PDF Loading] Data validation passed, proceeding to PDF generation');

        // Generate PDF using server-side API
         try {
           console.log('[PDF Loading] Calling server-side PDF generation API');

           // Fetch company data for PDF generation
           let fetchedCompanyData = null;
           let logoDataUrl = null;
           let signatureDataUrl = null;
           try {
             fetchedCompanyData = await fetchCompanyData(user, userData);
             console.log('[PDF Loading] Company data fetched:', fetchedCompanyData?.name);

             // Get logo URL (simplified - using company logo if available)
             if (fetchedCompanyData?.logo) {
               try {
                 const logoResponse = await fetch(fetchedCompanyData.logo)
                 if (logoResponse.ok) {
                   const logoBlob = await logoResponse.blob()
                   logoDataUrl = await new Promise<string>((resolve) => {
                     const reader = new FileReader()
                     reader.onload = () => resolve(reader.result as string)
                     reader.readAsDataURL(logoBlob)
                   })
                 }
               } catch (error) {
                 console.error('Error fetching company logo:', error)
                 // Continue without logo if fetch fails
               }
             }

             // Get signature URL from user data
             console.log('[DEBUG] Fetching user signature data for user:', user?.uid)
             try {
               if (!user?.uid) {
                 console.log('[DEBUG] User not available for signature fetch')
                 return
               }
               const userDocRef = doc(db, "boohk_users", user.uid)
               const userDocSnap = await getDoc(userDocRef)

               if (userDocSnap.exists()) {
                 const userData = userDocSnap.data()
                 console.log('[DEBUG] User document exists, signature data:', userData.signature)
                 console.log('[DEBUG] Full user data keys:', Object.keys(userData))
                 console.log('[DEBUG] Signature object:', userData.signature)
                 console.log('[DEBUG] Signature URL:', userData.signature?.url)

                 if (userData.signature?.url) {
                   console.log('[DEBUG] Signature URL found, attempting to fetch:', userData.signature.url)
                   try {
                     const signatureResponse = await fetch(userData.signature.url)
                     console.log('[DEBUG] Signature fetch response status:', signatureResponse.status)
                     if (signatureResponse.ok) {
                       const signatureBlob = await signatureResponse.blob()
                       console.log('[DEBUG] Signature blob size:', signatureBlob.size, 'type:', signatureBlob.type)
                       signatureDataUrl = await new Promise<string>((resolve) => {
                         const reader = new FileReader()
                         reader.onload = () => {
                           console.log('[DEBUG] Signature data URL generated, length:', reader.result?.toString().length)
                           resolve(reader.result as string)
                         }
                         reader.onerror = () => {
                           console.error('[DEBUG] FileReader error for signature')
                           resolve('')
                         }
                         reader.readAsDataURL(signatureBlob)
                       })
                       console.log('[DEBUG] Final signatureDataUrl set:', !!signatureDataUrl)
                     } else {
                       console.error('[DEBUG] Signature fetch failed with status:', signatureResponse.status)
                     }
                   } catch (error) {
                     console.error('[DEBUG] Error fetching user signature:', error)
                     // Continue without signature if fetch fails
                   }
                 } else {
                   console.log('[DEBUG] No signature URL available in user data')
                 }
               } else {
                 console.log('[DEBUG] User document does not exist in boohk_users collection')
               }
             } catch (error) {
               console.error("[DEBUG] Error fetching user signature data:", error)
             }
           } catch (companyError) {
             console.warn('[PDF Loading] Failed to fetch company data:', companyError);
           }

          // Prepare assignment data for API
          const apiAssignmentData = {
            saNumber: assignmentData.saNumber,
            projectSiteName: assignmentData.projectSiteName,
            projectSiteLocation: assignmentData.projectSiteLocation || '',
            serviceType: assignmentData.serviceType,
            assignedTo: assignmentData.assignedTo,
            assignedToName: assignmentData.assignedToName || '',
            serviceDuration: assignmentData.serviceDuration,
            priority: assignmentData.priority || '',
            equipmentRequired: assignmentData.equipmentRequired || '',
            materialSpecs: assignmentData.materialSpecs || '',
            crew: assignmentData.crew,
            gondola: assignmentData.gondola || '',
            technology: assignmentData.technology || '',
            sales: assignmentData.sales || '',
            campaignName: assignmentData.campaignName || '',
            remarks: assignmentData.remarks || '',
            startDate: assignmentData.startDate ? new Date(assignmentData.startDate) : null,
            endDate: assignmentData.endDate ? new Date(assignmentData.endDate) : null,
            alarmDate: assignmentData.alarmDate ? new Date(assignmentData.alarmDate) : null,
            alarmTime: assignmentData.alarmTime || '',
            attachments: assignmentData.attachments && assignmentData.attachments.length > 0
              ? assignmentData.attachments
              : [
                  ...(jobOrderData?.attachments ? [{
                    name: 'Job Order Attachment',
                    type: 'image',
                    url: jobOrderData.attachments.url,
                    fileUrl: jobOrderData.attachments.url
                  }] : []),
                  ...(jobOrderData?.siteImageUrl ? [{
                    name: 'Site Image',
                    type: 'image',
                    url: jobOrderData.siteImageUrl,
                    fileUrl: jobOrderData.siteImageUrl
                  }] : [])
                ],
            serviceExpenses: assignmentData.serviceExpenses || [],
            status: "Sent",
            created: new Date(),
            requestBy: user?.uid || '',
          };

          console.log('[PDF Loading] Sending request to /api/generate-service-assignment-pdf');

          const response = await fetch('/api/generate-service-assignment-pdf', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              assignment: apiAssignmentData,
              companyData: fetchedCompanyData,
              logoDataUrl,
              signatureDataUrl,
              format: 'pdf',
              userData: userData,
              jobOrderId: jobOrderId,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
          }

          // Get PDF as ArrayBuffer and convert to base64
          const pdfBuffer = await response.arrayBuffer();
          const pdfBase64 = arrayBufferToBase64(pdfBuffer);

          console.log('[PDF Loading] PDF generation completed, base64 length:', pdfBase64.length);

          if (pdfBase64 && pdfBase64.length > 0) {
            console.log('[PDF Loading] Setting PDF data, first 50 chars:', pdfBase64.substring(0, 50));

            // Validate PDF data format
            if (!pdfBase64.startsWith('JVBERi0xLj') && !pdfBase64.startsWith('JVBERi0xLj')) {
              console.warn('[PDF Loading] PDF data does not start with PDF header, but proceeding...');
            }

            setPdfData(pdfBase64);
            setIframeError(false); // Reset iframe error state
          } else {
            const errorMsg = 'PDF generation returned empty result. Please check assignment data and try again.';
            console.error('[PDF Loading] Error:', errorMsg);
            setError(errorMsg);
          }
        } catch (pdfError) {
          console.error('[PDF Loading] Server-side PDF generation failed, attempting client-side fallback:', pdfError);

          // Fallback to client-side PDF generation using jsPDF
          try {
            console.log('[PDF Loading] Attempting client-side PDF generation fallback');

            // Prepare assignment data for client-side generation
            const clientAssignmentData = {
              saNumber: assignmentData.saNumber,
              projectSiteName: assignmentData.projectSiteName,
              projectSiteLocation: assignmentData.projectSiteLocation || '',
              serviceType: assignmentData.serviceType,
              assignedTo: assignmentData.assignedTo,
              assignedToName: assignmentData.assignedToName || '',
              serviceDuration: assignmentData.serviceDuration,
              priority: assignmentData.priority || '',
              equipmentRequired: assignmentData.equipmentRequired || '',
              materialSpecs: assignmentData.materialSpecs || '',
              crew: assignmentData.crew,
              gondola: assignmentData.gondola || '',
              technology: assignmentData.technology || '',
              sales: assignmentData.sales || '',
              campaignName: assignmentData.campaignName || '',
              remarks: assignmentData.remarks || '',
              startDate: assignmentData.startDate ? new Date(assignmentData.startDate) : null,
              endDate: assignmentData.endDate ? new Date(assignmentData.endDate) : null,
              alarmDate: assignmentData.alarmDate ? new Date(assignmentData.alarmDate) : null,
              alarmTime: assignmentData.alarmTime || '',
              attachments: assignmentData.attachments && assignmentData.attachments.length > 0
                ? assignmentData.attachments
                : [
                    ...(jobOrderData?.attachments ? [{
                      name: 'Job Order Attachment',
                      type: 'image',
                      url: jobOrderData.attachments.url,
                      fileUrl: jobOrderData.attachments.url
                    }] : []),
                    ...(jobOrderData?.siteImageUrl ? [{
                      name: 'Site Image',
                      type: 'image',
                      url: jobOrderData.siteImageUrl,
                      fileUrl: jobOrderData.siteImageUrl
                    }] : [])
                  ],
              serviceExpenses: assignmentData.serviceExpenses || [],
              status: "Sent",
              created: new Date(),
              requestBy: user?.uid || '',
            };

            // Generate PDF using client-side jsPDF
            const pdfBase64 = await generateServiceAssignmentPDF(clientAssignmentData, true);

            if (pdfBase64 && pdfBase64.length > 0) {
              console.log('[PDF Loading] Client-side PDF generation successful, base64 length:', pdfBase64.length);

              // Validate PDF data format
              if (!pdfBase64.startsWith('JVBERi0xLj') && !pdfBase64.startsWith('JVBERi0xLj')) {
                console.warn('[PDF Loading] PDF data does not start with PDF header, but proceeding...');
              }

              setPdfData(pdfBase64);
              setIframeError(false); // Reset iframe error state
            } else {
              throw new Error('Client-side PDF generation returned empty result');
            }
          } catch (fallbackError) {
            console.error('[PDF Loading] Client-side fallback also failed:', fallbackError);
            let errorMsg = 'Failed to generate PDF. ';

            if (pdfError instanceof Error) {
              if (pdfError.message.includes('Failed to fetch')) {
                errorMsg += 'Network error. Please check your connection and try again.';
              } else if (pdfError.message.includes('HTTP')) {
                errorMsg += pdfError.message;
              } else {
                errorMsg += pdfError.message;
              }
            } else {
              errorMsg += 'An unexpected error occurred during PDF generation.';
            }

            setError(errorMsg);
          }
        }
      } catch (err) {
        console.error('[PDF Loading] Unexpected error:', err);
        const errorMsg = err instanceof Error
          ? `An error occurred: ${err.message}`
          : 'An unexpected error occurred while loading the PDF.';
        setError(errorMsg);
      } finally {
        console.log('[PDF Loading] Setting loading to false');
        setLoading(false);
      }
    };

    loadPDF();
  }, []);


  const handleConfirmAndCreate = async () => {
      if (!user) return;

      setCreatingAssignment(true);
      try {
        // Retrieve assignment data from local storage
        const assignmentDataString = localStorage.getItem('serviceAssignmentData');
        if (!assignmentDataString) {
          throw new Error('Assignment data not found in local storage');
        }

        const assignmentData = JSON.parse(assignmentDataString);

       // Keep assignedTo as team ID for Firestore storage
       let assignedToValue = assignmentData.assignedTo || assignmentData.crew || 'Unassigned';

        // Extract booking_id from URL parameters
        const bookingId = searchParams.get("booking_id");

        // Upload PDF to Firebase Storage with validation
        if (!pdfData || pdfData.length === 0) {
          throw new Error('PDF data is empty or invalid');
        }

        let pdfUrl: string;
        try {
          const pdfBlob = new Blob([Uint8Array.from(atob(pdfData), c => c.charCodeAt(0))], { type: 'application/pdf' });
          const pdfFileName = `service-assignments/${assignmentData.saNumber}-${Date.now()}.pdf`;
          const pdfRef = ref(storage, pdfFileName);
          await uploadBytes(pdfRef, pdfBlob);
          pdfUrl = await getDownloadURL(pdfRef);
        } catch (blobError) {
          console.error('Error creating PDF blob:', blobError);
          throw new Error('Failed to create PDF blob from data');
        }

        // Create service assignment data with defaults
        const firestoreAssignmentData = {
          saNumber: assignmentData.saNumber,
          projectSiteId: assignmentData.projectSiteId || '',
          projectSiteName: assignmentData.projectSiteName || 'Project Site Name',
          projectSiteLocation: assignmentData.projectSiteLocation || '',
          serviceType: assignmentData.serviceType,
          assignedTo: assignedToValue,
          assignedToName: assignmentData.assignedToName || '',
          serviceDuration: assignmentData.serviceDuration || '',
          priority: assignmentData.priority || 'Normal',
          equipmentRequired: assignmentData.equipmentRequired || '',
          materialSpecs: assignmentData.materialSpecs || '',
          crew: assignmentData.crew || '',
          gondola: assignmentData.gondola || '',
          technology: assignmentData.technology || '',
          sales: assignmentData.sales || '',
          remarks: assignmentData.remarks || '',
          message: assignmentData.message || '',
          campaignName: assignmentData.campaignName || '',
          coveredDateStart: Timestamp.fromDate(new Date(assignmentData.startDate)),
          coveredDateEnd: Timestamp.fromDate(new Date(assignmentData.endDate)),
          alarmDate: assignmentData.alarmDate ? Timestamp.fromDate(new Date(assignmentData.alarmDate)) : null,
          alarmTime: assignmentData.alarmTime || '',
          attachments: assignmentData.attachments || [],
          serviceExpenses: assignmentData.serviceExpenses || [],
          pdf: pdfUrl,
          status: "Sent",
          updated: serverTimestamp(),
          project_key: userData?.license_key || '',
          company_id: userData?.company_id || null,
          jobOrderId: jobOrderId,
          booking_id: bookingId,
          requestedBy: jobOrderData?.requestedBy ? {
            id: user.uid,
            name: jobOrderData.requestedBy,
            department: "LOGISTICS",
          } : {
            id: user.uid,
            name: userData?.first_name && userData?.last_name
              ? `${userData.first_name} ${userData.last_name}`
              : user?.displayName || "Unknown User",
            department: "LOGISTICS",
          },
        };

       // Create the service assignment in Firestore
       await addDoc(collection(db, "service_assignments"), {
         ...firestoreAssignmentData,
         created: serverTimestamp(),
       });

       setSuccessDialogProps({
         title: "Success!",
         message: "Service Assignment has been sent successfully.",
         confirmButtonText: "OK"
       });
       setShowSuccessDialog(true);
     } catch (error) {
       console.error("Error creating service assignment:", error);
       toast({
         title: "Creation Failed",
         description: "Failed to create service assignment. Please try again.",
         variant: "destructive",
       });
     } finally {
       setCreatingAssignment(false);
     }
   };

  const handleSaveAsDraft = async () => {
     if (!user) return;

     setCreatingAssignment(true);
     try {
       // Retrieve assignment data from local storage
       const assignmentDataString = localStorage.getItem('serviceAssignmentData');
       if (!assignmentDataString) {
         throw new Error('Assignment data not found in local storage');
       }

       const assignmentData = JSON.parse(assignmentDataString);

       // Keep assignedTo as team ID for Firestore storage
       let assignedToValue = assignmentData.assignedTo || assignmentData.crew || 'Unassigned';

       // Extract booking_id from URL parameters
       const bookingId = searchParams.get("booking_id");

       // Upload PDF to Firebase Storage with validation
       if (!pdfData || pdfData.length === 0) {
         throw new Error('PDF data is empty or invalid');
       }

       let pdfUrl: string;
       try {
         const pdfBlob = new Blob([Uint8Array.from(atob(pdfData), c => c.charCodeAt(0))], { type: 'application/pdf' });
         const pdfFileName = `service-assignments/${assignmentData.saNumber}-${Date.now()}.pdf`;
         const pdfRef = ref(storage, pdfFileName);
         await uploadBytes(pdfRef, pdfBlob);
         pdfUrl = await getDownloadURL(pdfRef);
       } catch (blobError) {
         console.error('Error creating PDF blob:', blobError);
         throw new Error('Failed to create PDF blob from data');
       }

       // Create service assignment data with draft status
       const draftAssignmentData = {
         saNumber: assignmentData.saNumber,
         projectSiteId: assignmentData.projectSiteId || '',
         projectSiteName: assignmentData.projectSiteName || 'Project Site Name',
         projectSiteLocation: assignmentData.projectSiteLocation || '',
         serviceType: assignmentData.serviceType,
         assignedTo: assignedToValue,
         assignedToName: assignmentData.assignedToName || '',
         serviceDuration: assignmentData.serviceDuration || '',
         priority: assignmentData.priority || 'Normal',
         equipmentRequired: assignmentData.equipmentRequired || '',
         materialSpecs: assignmentData.materialSpecs || '',
         crew: assignmentData.crew || '',
         gondola: assignmentData.gondola || '',
         technology: assignmentData.technology || '',
         sales: assignmentData.sales || '',
         remarks: assignmentData.remarks || '',
         message: assignmentData.message || '',
         campaignName: assignmentData.campaignName || '',
         coveredDateStart: Timestamp.fromDate(new Date(assignmentData.startDate)),
         coveredDateEnd: Timestamp.fromDate(new Date(assignmentData.endDate)),
         alarmDate: assignmentData.alarmDate ? Timestamp.fromDate(new Date(assignmentData.alarmDate)) : null,
         alarmTime: assignmentData.alarmTime || '',
         attachments: assignmentData.attachments || [],
         serviceExpenses: assignmentData.serviceExpenses || [],
         pdf: pdfUrl,
         status: "Draft",
         updated: serverTimestamp(),
         project_key: userData?.license_key || '',
         company_id: userData?.company_id || null,
         jobOrderId: jobOrderId,
         booking_id: bookingId,
         requestedBy: jobOrderData?.requestedBy ? {
           id: user.uid,
           name: jobOrderData.requestedBy,
           department: "LOGISTICS",
         } : {
           id: user.uid,
           name: userData?.first_name && userData?.last_name
             ? `${userData.first_name} ${userData.last_name}`
             : user?.displayName || "Unknown User",
           department: "LOGISTICS",
         },
       };

       // Create the service assignment in Firestore
       await addDoc(collection(db, "service_assignments"), {
         ...draftAssignmentData,
         created: serverTimestamp(),
       });

       setSuccessDialogProps({
         title: "Success!",
         message: "Service Assignment has been saved as draft.",
         confirmButtonText: "OK"
       });
       setShowSuccessDialog(true);
     } catch (error) {
       console.error("Error saving draft:", error);
       toast({
         title: "Save Failed",
         description: "Failed to save draft. Please try again.",
         variant: "destructive",
       });
     } finally {
       setCreatingAssignment(false);
     }
   };

   const handleSuccessDialogClose = () => {
     setShowSuccessDialog(false);
   };

   const handleSuccessDialogConfirm = () => {
     setShowSuccessDialog(false);
     // Navigate to assignments list after dialog is confirmed
     router.push("/logistics/assignments");
   };

  return (
    <section className="p-8 bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 pb-10">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-semibold text-gray-800 ">
          Create Service Assignment
        </h1>
      </div>

      <div className="relative w-full h-screen">
        {isPreview && (
        <div
          style={{
            display: 'flex',
            position: 'fixed',
            bottom: '20px',
            left: '60%',
            transform: 'translateX(-50%)',
            width: '300px',
            height: '67px',
            flexShrink: 0,
            borderRadius: '50px',
            border: '1.5px solid var(--GREY, #C4C4C4)',
            background: '#FFF',
            boxShadow: '-2px 4px 10.5px -2px rgba(0, 0, 0, 0.25)',
            zIndex: 10,
          }}
        >
          <div className="flex justify-center items-center" style={{ width: '100%', gap: '10px' }}>
            <Button
              variant="ghost"
              onClick={handleSaveAsDraft}
              disabled={creatingAssignment}
              style={{
                height: '27px',
                color: 'var(--Standard-Font-Color, #333)',
                textAlign: 'center',
                fontFamily: 'Inter',
                fontSize: '16px',
                fontStyle: 'normal',
                fontWeight: 700,
                lineHeight: '100%',
                textDecorationLine: 'underline',
                textDecorationStyle: 'solid',
                textDecorationSkipInk: 'auto',
                textDecorationThickness: 'auto',
                textUnderlineOffset: 'auto',
                textUnderlinePosition: 'from-font',
                padding: 0
              }}
            >
              Save as Draft
            </Button>
            <Button
              onClick={handleConfirmAndCreate}
              disabled={creatingAssignment}
              style={{
                width: '126px',
                height: '27px',
                flexShrink: 0,
                borderRadius: '10px',
                background: '#1D0BEB',
                color: 'var(--Color, #FFF)',
                textAlign: 'center',
                fontFamily: 'Inter',
                fontSize: '16px',
                fontStyle: 'normal',
                fontWeight: 700,
                lineHeight: '100%'
              }}
            >
              {creatingAssignment ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              {creatingAssignment ? "Creating SA..." : "Send SA"}
            </Button>
          </div>
        </div>
      )}

      {/* PDF Viewer */}
      <div className="w-full h-screen flex justify-center">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading PDF...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-red-500 mb-4">{error}</p>
              <Button onClick={() => router.back()}>Go Back</Button>
            </div>
          </div>
        ) : pdfData ? (
            iframeError ? (
              // Fallback display when iframe fails
              <div className="w-[210mm] min-h-[297mm] bg-white shadow-md rounded-sm overflow-hidden flex flex-col items-center justify-center p-8">
                <div className="text-center">
                  <div className="mb-4">
                    <svg className="mx-auto h-16 w-16 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">PDF Display Error</h3>
                  <p className="text-gray-600 mb-4">
                    The PDF cannot be displayed inline. This may be due to browser limitations or corrupted PDF data.
                  </p>
                  <div className="space-y-2">
                    <Button
                      onClick={() => {
                        // Create a download link for the PDF
                        const link = document.createElement('a');
                        link.href = `data:application/pdf;base64,${pdfData}`;
                        link.download = `service-assignment-${Date.now()}.pdf`;
                        link.click();
                      }}
                      className="mr-2"
                    >
                      Download PDF
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        // Try to reload the page to attempt iframe again
                        window.location.reload();
                      }}
                    >
                      Try Again
                    </Button>
                  </div>
                  <div className="mt-4 text-sm text-gray-500">
                    <p>If the problem persists, try opening the downloaded PDF in an external PDF viewer.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-[400mm] min-h-[279mm] bg-white shadow-md rounded-sm overflow-hidden">
                {(() => {
                  console.log('[PDF Loading] Rendering iframe with data length:', pdfData.length);
                  console.log('[PDF Loading] PDF data starts with:', pdfData.substring(0, 50));
                  console.log('[PDF Loading] PDF data ends with:', pdfData.substring(pdfData.length - 50));
                  return null;
                })()}
                <iframe
                  src={`data:application/pdf;base64,${pdfData}#zoom=96&navpanes=0&sidebar=0&scrollbar=0`}
                  className="w-full h-full min-h-[279mm]"
                  title="PDF Viewer"
                  onLoad={() => {
                    console.log('[PDF Loading] Iframe loaded successfully');
                    setIframeError(false);
                  }}
                  onError={(e) => {
                    console.error('[PDF Loading] Iframe failed to load:', e);
                    console.error('[PDF Loading] PDF data that failed:', pdfData?.substring(0, 100));
                    setIframeError(true);
                    setError('Failed to display PDF in iframe. The PDF data may be corrupted or the browser does not support inline PDF viewing.');
                  }}
                />
              </div>
            )
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-gray-500 mb-4">No PDF data available</p>
                <Button onClick={() => router.back()}>Go Back</Button>
              </div>
            </div>
          )}
      </div>
    </div>

    {/* Success Dialog */}
    <GenericSuccessDialog
      isOpen={showSuccessDialog}
      onClose={handleSuccessDialogClose}
      onConfirm={handleSuccessDialogConfirm}
      title={successDialogProps.title}
      message={successDialogProps.message}
      type="general"
    />
    </section>
  );
}