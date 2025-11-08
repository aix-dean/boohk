"use client"

import type React from "react"
import { useEffect, useState } from "react"
import type { ProposalActivity } from "@/lib/types/proposal-activity"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2 } from "lucide-react"
import { getProposalActivities } from "@/lib/proposal-activity-service"

interface ProposalActivityTimelineProps {
  proposalId: string
  currentUserId: string
  currentUserName: string
}

export function ProposalActivityTimeline({
  proposalId,
  currentUserId,
  currentUserName,
}: ProposalActivityTimelineProps) {
  const [activities, setActivities] = useState<ProposalActivity[]>([])
  const [loadingActivities, setLoadingActivities] = useState(true)

  useEffect(() => {
    const fetchActivities = async () => {
      if (!proposalId) {
        setLoadingActivities(false)
        return
      }
      setLoadingActivities(true)
      try {
        const fetchedActivities = await getProposalActivities(proposalId)
        setActivities(fetchedActivities)
      } catch (error) {
        console.error("Error fetching proposal activities:", error)
      } finally {
        setLoadingActivities(false)
      }
    }
    fetchActivities()
  }, [proposalId])

  if (loadingActivities) {
    return (
      <div className="flex justify-center items-center h-24">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    )
  }

  if (activities.length === 0) {
    return <div className="text-center text-gray-500 py-8">No activities found for this cost estimate.</div>
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 h-full w-[2px] bg-gray-200" />
      {activities.map((activity, index) => (
        <div key={activity.id} className="mb-6 ml-8">
          <span
            className={cn(
              "absolute -left-1 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white ring-2 ring-gray-200",
              index === 0 ? "bg-blue-500 ring-blue-500" : "",
            )}
          >
            {index === 0 && <CheckIcon className="h-3 w-3 text-white" />}
          </span>
          <div className="flex items-center space-x-2">
            <Avatar>
              <AvatarImage src={activity.user?.imageUrl || ""} />
              <AvatarFallback>{activity.user?.name?.charAt(0)}</AvatarFallback>
            </Avatar>
            <h4 className="text-sm font-semibold text-gray-900">{activity.user?.name}</h4>
            <time className="text-sm italic font-normal leading-none text-gray-500">
              {format(activity.timestamp, "MMM dd, yyyy hh:mm a")}
            </time>
          </div>
          <p className="mb-4 text-base font-normal text-gray-500">{activity.description}</p>
        </div>
      ))}
    </div>
  )
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
