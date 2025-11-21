const fs = require('fs');

let content = fs.readFileSync('components/AddEditSiteDialog.tsx', 'utf8');

// Add the pixel grid overlay after the opening div tag
content = content.replace(
  /(<div\s+className="bg-white border-2 border-gray-400 rounded shadow-sm relative"\s+style=\{[^}]+\}\s*>)/,
  `$1
                              {/* Pixel grid overlay */}
                              {(() => {
                                const resWidth = parseInt(resolutionWidth) || 0;
                                const resHeight = parseInt(resolutionHeight) || 0;
                                
                                if (resWidth > 0 && resHeight > 0 && resWidth <= 50 && resHeight <= 50) {
                                  // Limit to reasonable grid size to avoid performance issues
                                  const pixelSize = Math.min(displayWidth / resWidth, displayHeight / resHeight);
                                  
                                  return (
                                    <div className="absolute inset-0 grid" style={{
                                      gridTemplateColumns: \`repeat(\${resWidth}, 1fr)\`,
                                      gridTemplateRows: \`repeat(\${resHeight}, 1fr)\`
                                    }}>
                                      {Array.from({ length: resWidth * resHeight }).map((_, index) => (
                                        <div
                                          key={index}
                                          className="border border-gray-300 opacity-60"
                                          style={{
                                            width: \`\${pixelSize}px\`,
                                            height: \`\${pixelSize}px\`
                                          }}
                                        />
                                      ))}
                                    </div>
                                  );
                                }
                                return null;
                              })()}`
);

fs.writeFileSync('components/AddEditSiteDialog.tsx', content);
