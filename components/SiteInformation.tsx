"use client";

import React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Maximize } from "lucide-react";
import { GoogleMap } from "./GoogleMap";

interface SiteInformationProps {
  product: any;
  activeImageIndex: number;
  setActiveImageIndex: (index: number) => void;
  setImageViewerOpen: (open: boolean) => void;
  handleCalendarOpen: () => void;
  companyName: string;
  companyLoading: boolean;
}

export default function SiteInformation({
  product,
  activeImageIndex,
  setActiveImageIndex,
  setImageViewerOpen,
  handleCalendarOpen,
  companyName,
  companyLoading,
}: SiteInformationProps) {
  return (
    <aside className="lg:col-span-1">
      <Card className="bg-transparent border-none shadow-none">
        <CardContent className="p-0">
          {/* Site Image and Map */}
          <div className="text-xs font-bold">Site Specifications</div>
          <div className="flex border-none">
            {/* Site Image */}
            <div className="relative flex-1 aspect-square overflow-hidden border-none">
              {product?.media && product.media.length > 0 ? (
                <>
                  <Image
                    src={
                      product.media[activeImageIndex]?.url || "/placeholder.svg"
                    }
                    alt={product.name || "Site image"}
                    fill
                    className="object-cover border-none"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "/building-billboard.png";
                      target.className = "object-cover opacity-50 border-none";
                    }}
                  />
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8 bg-white/80 backdrop-blur-sm border border-gray-200 shadow-md rounded-full"
                    onClick={() => {
                      setActiveImageIndex(0);
                      setImageViewerOpen(true);
                    }}
                    aria-label="View image gallery"
                  >
                    <Maximize className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <div className="w-full h-full bg-gray-100 flex items-center justify-center border-none">
                  <Image
                    src="/building-billboard.png"
                    alt="Site placeholder"
                    fill
                    className="object-cover opacity-50 border-none"
                  />
                </div>
              )}
            </div>

            {/* Map View */}
            {(product?.type?.toLowerCase() === "rental"
              ? product.specs_rental?.location
              : product.light?.location) && (
              <div className="relative flex-1 aspect-square overflow-hidden border-none">
                <GoogleMap
                  location={
                    product?.type?.toLowerCase() === "rental"
                      ? product.specs_rental.location
                      : product.light.location
                  }
                  geopoint={product?.specs_rental?.geopoint}
                  className="w-full h-full border-none"
                />
              </div>
            )}
          </div>

          {/* Site Details */}
          <div className="mt-[17px] space-y-3">
            {/* Site Name */}
            <div>
              <div className="text-xs text-gray-900 mb-1">Site</div>
              <div className="text-sm font-bold text-gray-900">
                {product?.name || "Not Set Site"}
              </div>
            </div>
            {/* Location */}
            <div>
              <div className="text-xs text-gray-900 mb-1">Location</div>
              <div className="text-sm font-bold text-gray-800">
                {product?.type?.toLowerCase() === "rental"
                  ? product.specs_rental?.location || "Not Set"
                  : product.light?.location || "Not Set"}
              </div>
            </div>
            {/* Geopoint */}
            <div>
              <div className="text-xs text-gray-900 mb-1">Geopoint</div>
              <div className="text-sm font-bold text-gray-800">
                {product?.specs_rental?.geopoint
                  ? `${product.specs_rental.geopoint.latitude}, ${product.specs_rental.geopoint.longitude}`
                  : "Not Set"}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-900">Type</div>
                <div className="text-sm font-bold text-gray-800">
                  {Array.isArray(product?.categories)
                    ? product.categories.length > 0
                      ? product.categories.join(", ")
                      : "Not Set"
                    : product?.categories
                      ? product.categories
                      : "Not Set"}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-900">Orientation</div>
                <div className="text-sm font-bold text-gray-800">
                  {product?.specs_rental?.orientation || "Not specified"}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-900">Dimension</div>
                <div className="text-sm font-bold text-gray-800">
                  {product?.specs_rental?.height
                    ? `${product.specs_rental.height}${product.specs_rental.dimension_unit}(H) x ${product.specs_rental.width || "N/A"}${product.specs_rental.dimension_unit} (W)`
                    : "Not specified"}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-900">Elevation</div>
                <div className="text-sm font-bold text-gray-800">
                  {product?.specs_rental?.elevation || "Not specified"}
                </div>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-900">Average Daily Traffic</div>
              <div className="text-sm font-bold text-gray-800">
                {product?.specs_rental?.traffic_count || "Not specified"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-900">Site Owner</div>
              <div className="text-sm font-bold text-gray-800">
                {companyLoading ? "Loading..." : companyName || "Not Set"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-900">Land Owner</div>
              <div className="text-sm font-bold text-gray-800">
                {product?.specs_rental?.land_owner || "Not specified"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-900">Partner</div>
              <div className="text-sm font-bold text-gray-800">
                {product?.specs_rental?.partner || "Not specified"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}
