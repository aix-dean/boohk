"use client"

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Type,
  Image as ImageIcon,
  Video,
  Trash2,
  Upload,
  Move,
  RotateCcw,
  Save,
  X
} from "lucide-react"
import { uploadFileToFirebaseStorage } from "@/lib/firebase-service"
import { useToast } from "@/hooks/use-toast"
import type { PageElement, CustomPage } from "@/lib/types/proposal"

interface BlankPageEditorProps {
  page: CustomPage
  onSave: (page: CustomPage) => void
  onCancel: () => void
  pageWidth: number
  pageHeight: number
}

export const BlankPageEditor: React.FC<BlankPageEditorProps> = ({
  page,
  onSave,
  onCancel,
  pageWidth,
  pageHeight
}) => {
  const [elements, setElements] = useState<PageElement[]>(page.elements || [])
  const [selectedElement, setSelectedElement] = useState<string | null>(null)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [resizeDirection, setResizeDirection] = useState<string>('')
  const [scale, setScale] = useState(1)
  const canvasRef = useRef<HTMLDivElement>(null)
  const textRefs = useRef<{ [key: string]: HTMLDivElement }>({})
  const { toast } = useToast()

  useEffect(() => {
    const updateScale = () => {
      const containerWidth = window.innerWidth - 32; // account for padding
      const containerHeight = window.innerHeight - 200; // estimate for tabs and padding
      const scaleX = containerWidth / pageWidth;
      const scaleY = containerHeight / pageHeight;
      setScale(Math.min(1, Math.min(scaleX, scaleY)));
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [pageWidth, pageHeight]);

  const handleAddText = () => {
    const newElement: PageElement = {
      id: `text-${Date.now()}`,
      type: 'text',
      content: 'New Text',
      position: { x: 100, y: 100 },
      size: { width: 200, height: 50 },
      style: {
        fontSize: 16,
        fontFamily: 'Arial',
        color: '#000000',
        fontWeight: 'normal',
        textAlign: 'left'
      }
    }
    setElements(prev => [...prev, newElement])
    setSelectedElement(newElement.id)
  }

  const handleAddImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const uploadPath = `proposals/custom-pages/images/${Date.now()}_${file.name}`
      const imageUrl = await uploadFileToFirebaseStorage(file, uploadPath)

      const newElement: PageElement = {
        id: `image-${Date.now()}`,
        type: 'image',
        content: imageUrl,
        position: { x: 100, y: 100 },
        size: { width: 200, height: 150 }
      }
      setElements(prev => [...prev, newElement])
      setSelectedElement(newElement.id)

      toast({
        title: "Image Added",
        description: "Image has been uploaded and added to the page"
      })
    } catch (error) {
      console.error("Error uploading image:", error)
      toast({
        title: "Error",
        description: "Failed to upload image",
        variant: "destructive"
      })
    }
  }

  const handleAddVideo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const uploadPath = `proposals/custom-pages/videos/${Date.now()}_${file.name}`
      const videoUrl = await uploadFileToFirebaseStorage(file, uploadPath)

      const newElement: PageElement = {
        id: `video-${Date.now()}`,
        type: 'video',
        content: videoUrl,
        position: { x: 100, y: 100 },
        size: { width: 300, height: 200 }
      }
      setElements(prev => [...prev, newElement])
      setSelectedElement(newElement.id)

      toast({
        title: "Video Added",
        description: "Video has been uploaded and added to the page"
      })
    } catch (error) {
      console.error("Error uploading video:", error)
      toast({
        title: "Error",
        description: "Failed to upload video",
        variant: "destructive"
      })
    }
  }

  const handleMouseDown = (e: React.MouseEvent, elementId: string, resizeDir?: string) => {
    e.preventDefault()
    const element = elements.find(el => el.id === elementId)
    if (!element) return

    setSelectedElement(elementId)

    if (resizeDir) {
      setIsResizing(true)
      setResizeDirection(resizeDir)
      setDragOffset({ x: e.clientX, y: e.clientY })
    } else {
      setIsDragging(true)
      setDragOffset({
        x: e.clientX - element.position.x * scale,
        y: e.clientY - element.position.y * scale
      })
    }
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!selectedElement) return

    const element = elements.find(el => el.id === selectedElement)
    if (!element) return

    if (isDragging) {
      const newX = Math.max(0, Math.min(pageWidth - element.size.width, (e.clientX - dragOffset.x) / scale))
      const newY = Math.max(0, Math.min(pageHeight - element.size.height, (e.clientY - dragOffset.y) / scale))

      setElements(prev => prev.map(el =>
        el.id === selectedElement
          ? { ...el, position: { x: newX, y: newY } }
          : el
      ))
    } else if (isResizing) {
      const deltaX = (e.clientX - dragOffset.x) / scale
      const deltaY = (e.clientY - dragOffset.y) / scale

      let newWidth = element.size.width
      let newHeight = element.size.height
      let newX = element.position.x
      let newY = element.position.y

      switch (resizeDirection) {
        case 'nw':
          newWidth = Math.max(50, element.size.width - deltaX)
          newHeight = Math.max(30, element.size.height - deltaY)
          newX = element.position.x + (element.size.width - newWidth)
          newY = element.position.y + (element.size.height - newHeight)
          break
        case 'ne':
          newWidth = Math.max(50, element.size.width + deltaX)
          newHeight = Math.max(30, element.size.height - deltaY)
          newY = element.position.y + (element.size.height - newHeight)
          break
        case 'sw':
          newWidth = Math.max(50, element.size.width - deltaX)
          newHeight = Math.max(30, element.size.height + deltaY)
          newX = element.position.x + (element.size.width - newWidth)
          break
        case 'se':
          newWidth = Math.max(50, element.size.width + deltaX)
          newHeight = Math.max(30, element.size.height + deltaY)
          break
        case 'n':
          newHeight = Math.max(30, element.size.height - deltaY)
          newY = element.position.y + (element.size.height - newHeight)
          break
        case 's':
          newHeight = Math.max(30, element.size.height + deltaY)
          break
        case 'w':
          newWidth = Math.max(50, element.size.width - deltaX)
          newX = element.position.x + (element.size.width - newWidth)
          break
        case 'e':
          newWidth = Math.max(50, element.size.width + deltaX)
          break
      }

      // Ensure element stays within bounds
      newX = Math.max(0, Math.min(pageWidth - newWidth, newX))
      newY = Math.max(0, Math.min(pageHeight - newHeight, newY))

      setElements(prev => prev.map(el =>
        el.id === selectedElement
          ? {
              ...el,
              position: { x: newX, y: newY },
              size: { width: newWidth, height: newHeight }
            }
          : el
      ))
    }
  }, [selectedElement, isDragging, isResizing, dragOffset, resizeDirection, elements, pageWidth, pageHeight])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setIsResizing(false)
    setResizeDirection('')
  }, [])

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp])

  const handleDeleteElement = (elementId: string) => {
    setElements(prev => prev.filter(el => el.id !== elementId))
    if (selectedElement === elementId) {
      setSelectedElement(null)
    }
  }

  const handleSave = () => {
    const updatedPage: CustomPage = {
      ...page,
      elements
    }
    onSave(updatedPage)
  }

  const selectedElementData = selectedElement ? elements.find(el => el.id === selectedElement) : null

  return (
    <div className="flex flex-col h-full">
      <Tabs defaultValue="insert" className="w-full">
        <TabsList className="flex w-full">
          <TabsTrigger value="insert" className="flex-1">Insert</TabsTrigger>
          {selectedElementData && <TabsTrigger value="properties" className="flex-1">Properties</TabsTrigger>}
        </TabsList>

        <TabsContent value="insert" className="p-2 sm:p-4 border-b bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleAddText} size="sm" variant="outline">
                <Type className="h-4 w-4 mr-2" />
                Add Text
              </Button>
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAddImage}
                  className="hidden"
                  id="image-upload"
                />
                <Button asChild size="sm" variant="outline">
                  <label htmlFor="image-upload" className="cursor-pointer">
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Add Image
                  </label>
                </Button>
              </div>
              <div>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleAddVideo}
                  className="hidden"
                  id="video-upload"
                />
                <Button asChild size="sm" variant="outline">
                  <label htmlFor="video-upload" className="cursor-pointer">
                    <Video className="h-4 w-4 mr-2" />
                    Add Video
                  </label>
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleSave} size="sm">
                <Save className="h-4 w-4 mr-2" />
                Save Page
              </Button>
              <Button onClick={onCancel} size="sm" variant="outline">
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="properties" className="p-2 sm:p-4 border-b bg-gray-50">
          {selectedElementData && (
            <div className="flex flex-row flex-wrap gap-4 items-end">
              <div>
                <Label className="text-sm font-medium">Type: {selectedElementData.type}</Label>
              </div>

              {selectedElementData.type === 'text' && (
                <>
                  <div>
                    <Label htmlFor="font-size">Font Size</Label>
                    <Input
                      id="font-size"
                      type="number"
                      value={selectedElementData.style?.fontSize || 16}
                      onChange={(e) => setElements(prev => prev.map(el =>
                        el.id === selectedElement
                          ? {
                              ...el,
                              style: {
                                ...el.style,
                                fontSize: parseInt(e.target.value)
                              }
                            }
                          : el
                      ))}
                      className="mt-1 w-20"
                    />
                  </div>
                  <div>
                    <Label htmlFor="font-weight">Weight</Label>
                    <select
                      id="font-weight"
                      value={selectedElementData.style?.fontWeight || 'normal'}
                      onChange={(e) => setElements(prev => prev.map(el =>
                        el.id === selectedElement
                          ? {
                              ...el,
                              style: {
                                ...el.style,
                                fontWeight: e.target.value
                              }
                            }
                          : el
                      ))}
                      className="mt-1 p-2 border rounded w-24"
                    >
                      <option value="normal">Normal</option>
                      <option value="bold">Bold</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="text-color">Color</Label>
                    <Input
                      id="text-color"
                      type="color"
                      value={selectedElementData.style?.color || '#000000'}
                      onChange={(e) => setElements(prev => prev.map(el =>
                        el.id === selectedElement
                          ? {
                              ...el,
                              style: {
                                ...el.style,
                                color: e.target.value
                              }
                            }
                          : el
                      ))}
                      className="mt-1 h-10 w-12"
                    />
                  </div>
                </>
              )}

              <div>
                <Label>Pos X</Label>
                <Input
                  type="number"
                  value={Math.round(selectedElementData.position.x)}
                  onChange={(e) => setElements(prev => prev.map(el =>
                    el.id === selectedElement
                      ? {
                          ...el,
                          position: {
                            ...el.position,
                            x: parseInt(e.target.value) || 0
                          }
                        }
                      : el
                  ))}
                  className="w-16"
                />
              </div>
              <div>
                <Label>Pos Y</Label>
                <Input
                  type="number"
                  value={Math.round(selectedElementData.position.y)}
                  onChange={(e) => setElements(prev => prev.map(el =>
                    el.id === selectedElement
                      ? {
                          ...el,
                          position: {
                            ...el.position,
                            y: parseInt(e.target.value) || 0
                          }
                        }
                      : el
                  ))}
                  className="w-16"
                />
              </div>
              <div>
                <Label>Width</Label>
                <Input
                  type="number"
                  value={Math.round(selectedElementData.size.width)}
                  onChange={(e) => setElements(prev => prev.map(el =>
                    el.id === selectedElement
                      ? {
                          ...el,
                          size: {
                            ...el.size,
                            width: parseInt(e.target.value) || 50
                          }
                        }
                      : el
                  ))}
                  className="w-16"
                />
              </div>
              <div>
                <Label>Height</Label>
                <Input
                  type="number"
                  value={Math.round(selectedElementData.size.height)}
                  onChange={(e) => setElements(prev => prev.map(el =>
                    el.id === selectedElement
                      ? {
                          ...el,
                          size: {
                            ...el.size,
                            height: parseInt(e.target.value) || 30
                          }
                        }
                      : el
                  ))}
                  className="w-16"
                />
              </div>

              <Button
                onClick={() => selectedElement && handleDeleteElement(selectedElement)}
                variant="destructive"
                size="sm"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Canvas */}
      <div className="flex-1 p-2 sm:p-4">
        <div
          ref={canvasRef}
          data-testid="canvas"
          className="relative bg-white border-2 border-gray-200 mx-auto shadow-lg overflow-auto"
          style={{ width: pageWidth * scale, height: pageHeight * scale, maxWidth: '100%', maxHeight: '100%' }}
          onClick={(e) => { if (e.target === e.currentTarget) { setSelectedElement(null); setEditingTextId(null); } }}
        >
          {elements.map((element) => (
            <div
              key={element.id}
              className={`absolute border-2 ${
                selectedElement === element.id ? 'border-blue-500' : 'border-transparent'
              } ${editingTextId === element.id ? 'cursor-text' : 'cursor-move'}`}
              style={{
                left: element.position.x * scale,
                top: element.position.y * scale,
                width: element.size.width * scale,
                height: element.size.height * scale,
                zIndex: selectedElement === element.id ? 10 : 1
              }}
              onMouseDown={(e) => handleMouseDown(e, element.id)}
              {...(element.type !== 'text' && {
                onClick: (e: React.MouseEvent) => { e.stopPropagation(); setSelectedElement(element.id); }
              })}
            >
              {element.type === 'text' && (
                <div
                  ref={(el) => { if (el) textRefs.current[element.id] = el; }}
                  contentEditable={editingTextId === element.id}
                  suppressContentEditableWarning
                  onClick={(e) => { e.stopPropagation(); setSelectedElement(element.id); }}
                  onMouseDown={(e) => { if (editingTextId === element.id) e.stopPropagation(); }}
                  onDoubleClick={() => {
                    setEditingTextId(element.id);
                    setTimeout(() => textRefs.current[element.id]?.focus(), 0);
                  }}
                  onBlur={(e) => {
                    const newContent = e.currentTarget.textContent || '';
                    setElements(prev => prev.map(el =>
                      el.id === element.id ? { ...el, content: newContent } : el
                    ));
                    setEditingTextId(null);
                  }}
                  className="w-full h-full p-2 overflow-hidden outline-none"
                  style={{
                    fontSize: element.style?.fontSize || 16,
                    fontFamily: element.style?.fontFamily || 'Arial',
                    color: element.style?.color || '#000000',
                    fontWeight: element.style?.fontWeight || 'normal',
                    textAlign: element.style?.textAlign as any || 'left'
                  }}
                >
                  {element.content}
                </div>
              )}
              {element.type === 'image' && (
                <img
                  src={element.content}
                  alt="Custom content"
                  className="w-full h-full object-cover"
                />
              )}
              {element.type === 'video' && (
                <video
                  src={element.content}
                  className="w-full h-full object-cover"
                  controls
                />
              )}

              {/* Resize handles */}
              {selectedElement === element.id && (
                <>
                  {/* Corners */}
                  <div
                    className="absolute top-0 left-0 w-4 h-4 bg-blue-500 cursor-nw-resize -translate-x-1/2 -translate-y-1/2"
                    onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, element.id, 'nw'); }}
                    onDoubleClick={(e) => e.stopPropagation()}
                  />
                  <div
                    className="absolute top-0 right-0 w-4 h-4 bg-blue-500 cursor-ne-resize translate-x-1/2 -translate-y-1/2"
                    onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, element.id, 'ne'); }}
                    onDoubleClick={(e) => e.stopPropagation()}
                  />
                  <div
                    className="absolute bottom-0 left-0 w-4 h-4 bg-blue-500 cursor-sw-resize -translate-x-1/2 translate-y-1/2"
                    onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, element.id, 'sw'); }}
                    onDoubleClick={(e) => e.stopPropagation()}
                  />
                  <div
                    className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 cursor-se-resize translate-x-1/2 translate-y-1/2"
                    onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, element.id, 'se'); }}
                    onDoubleClick={(e) => e.stopPropagation()}
                  />
                  {/* Sides */}
                  <div
                    className="absolute top-0 left-1/2 w-4 h-4 bg-blue-500 cursor-n-resize -translate-x-1/2 -translate-y-1/2"
                    onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, element.id, 'n'); }}
                    onDoubleClick={(e) => e.stopPropagation()}
                  />
                  <div
                    className="absolute bottom-0 left-1/2 w-4 h-4 bg-blue-500 cursor-s-resize -translate-x-1/2 translate-y-1/2"
                    onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, element.id, 's'); }}
                    onDoubleClick={(e) => e.stopPropagation()}
                  />
                  <div
                    className="absolute top-1/2 left-0 w-4 h-4 bg-blue-500 cursor-w-resize -translate-x-1/2 -translate-y-1/2"
                    onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, element.id, 'w'); }}
                    onDoubleClick={(e) => e.stopPropagation()}
                  />
                  <div
                    className="absolute top-1/2 right-0 w-4 h-4 bg-blue-500 cursor-e-resize translate-x-1/2 -translate-y-1/2"
                    onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, element.id, 'e'); }}
                    onDoubleClick={(e) => e.stopPropagation()}
                  />
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}